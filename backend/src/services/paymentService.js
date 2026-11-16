const mongoose = require('mongoose')
const Payment = require('../models/Payment')
const Milestone = require('../models/Milestone')
const Contract = require('../models/Contract')
const Job = require('../models/Job')
const User = require('../models/User')
const ClientProfile = require('../models/ClientProfile')
const FreelancerProfile = require('../models/FreelancerProfile')
const WebhookEvent = require('../models/WebhookEvent')
const ApiError = require('../utils/ApiError')
const rzp = require('./razorpayService')
const notifications = require('./notificationService')
const env = require('../config/env')
const crypto = require('crypto')
const { FUNDED_PAYMENT_STATUSES, VISIBLE_PAYMENT_STATUSES, ENFORCE_SEQUENTIAL_FUNDING } = require('../models/constants')
const { toPaymentDTO, toMilestoneDTO, toContractDTO } = require('../utils/dto')
const { parsePagination, pageMeta, withPageInfo, findPaged } = require('../utils/pagination')

const sid = (v) => String(v?._id ?? v)
const assertId = (id, label) => {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, `Invalid ${label}`)
}

// ---------------------------------------------------------------- output shaping
// The frontend is the source of truth: every payment leaves through toPaymentDTO (utils/dto.js).
// Razorpay order/payment identifiers are not exposed beyond razorpayPaymentId (which the UI shows).
const shape = (p) => toPaymentDTO(p)

// Pure: the milestones that must be approved before `milestone` may be funded ("earlier" milestones).
// Ordered by creation (createdAt, then _id as a total-order tie-break). dueDate is NOT used: contract-start
// milestones have dueDate null, and a nullable field cannot define an order.
function earlierMilestoneFilter(milestone) {
  return {
    contractId: milestone.contractId,
    _id: { $ne: milestone._id },
    status: { $ne: 'Completed' },
    $or: [
      { createdAt: { $lt: milestone.createdAt } },
      { createdAt: milestone.createdAt, _id: { $lt: milestone._id } },
    ],
  }
}

// Pure: where a payout goes, shown to admins/freelancers ("payoutTo" in the UI).
const payoutDestination = (acct) => (acct && (acct.upiId || acct.accountNumber) ? acct.upiId || `A/c ****${String(acct.accountNumber).slice(-4)}` : null)

// Pure: dispatch preconditions, with the frontend mock's exact messages. Returns an error string or null.
const dispatchRules = {
  status: (status) => {
    if (status === 'Paid') return 'This payment has already been dispatched.'
    if (status !== 'Awaiting Payout') return 'Funds can only be dispatched after the client approves the milestone.'
    return null
  },
  account: (acct) => (payoutDestination(acct) ? null : 'The freelancer has not added a payout account (bank/UPI) yet.'),
}

// ---------------------------------------------------------------- create order
async function createOrder(client, milestoneId) {
  assertId(milestoneId, 'milestoneId')
  if (!rzp.isConfigured()) throw new ApiError(503, 'Payments are not configured on this server')

  const milestone = await Milestone.findById(milestoneId)
  if (!milestone) throw new ApiError(404, 'Milestone not found')
  const contract = await Contract.findById(milestone.contractId)
  // Same 404 for "not your contract" so milestone ids can't be probed.
  if (!contract || sid(contract.clientId) !== sid(client._id)) throw new ApiError(404, 'Milestone not found')

  if (contract.status !== 'Active') throw new ApiError(409, `Contract is ${contract.status}; it cannot be funded`)
  if (milestone.status !== 'Pending') throw new ApiError(409, `Milestone is ${milestone.status}; only Pending milestones can be funded`)
  if (milestone.funded) throw new ApiError(409, 'Milestone is already funded')

  if (ENFORCE_SEQUENTIAL_FUNDING) {
    const earlierOpen = await Milestone.exists(earlierMilestoneFilter(milestone))
    if (earlierOpen) throw new ApiError(409, 'Earlier milestones must be approved before this one can be funded')
  }

  if (await Payment.exists({ milestoneId: milestone._id, status: { $in: FUNDED_PAYMENT_STATUSES } })) {
    throw new ApiError(409, 'Milestone is already funded')
  }

  // Amount ALWAYS comes from the trusted milestone record, never from the request.
  const amountPaise = rzp.toPaise(milestone.amount)
  if (!Number.isInteger(amountPaise) || amountPaise < 100) throw new ApiError(400, 'Milestone amount must be at least ₹1')

  // Retry-friendly: reuse an unpaid order for the same amount instead of piling up orders.
  const reusable = await Payment.findOne({ milestoneId: milestone._id, clientId: client._id, status: { $in: ['Pending', 'Failed'] }, amount: milestone.amount }).sort({ createdAt: -1 })
  if (reusable) return orderResponse(reusable)

  console.log("RAZORPAY AMOUNT DEBUG:", {
    milestoneAmount: milestone.amount,
    amountPaise,
    amountInRupees: amountPaise / 100,
  });
  const order = await rzp.createOrder({
    amountPaise,
    receipt: `ms_${milestone._id}`,
    notes: { milestoneId: sid(milestone._id), contractId: sid(contract._id), clientId: sid(client._id) },
  })
  if (!order?.id || order.amount !== amountPaise) throw new ApiError(502, 'Unexpected response from the payment provider')
  const payment = await Payment.create({
    milestoneId: milestone._id,
    contractId: contract._id,
    clientId: contract.clientId,
    freelancerId: contract.freelancerId,
    amount: milestone.amount,
    currency: 'INR',
    providerOrderId: order.id,
    status: 'Pending',
  })
  return orderResponse(payment)
}

function orderResponse(payment) {
  return {
    paymentId: payment._id,
    orderId: payment.providerOrderId,
    amount: rzp.toPaise(payment.amount), // paise, what Checkout expects
    currency: payment.currency,
    keyId: env.razorpayKeyId, // public key id only
    milestoneId: payment.milestoneId,
  }
}

// ---------------------------------------------------------------- mark funded (shared by verify + webhook)
// Atomically moves Pending/Failed -> Held. Safe to call repeatedly / concurrently: only one caller wins.
async function applyCaptured(payment, providerPaymentId) {
  let updated
  try {
    updated = await Payment.findOneAndUpdate(
      { _id: payment._id, status: { $in: ['Pending', 'Failed'] } },
      { $set: { status: 'Held', providerPaymentId, paidAt: new Date(), failureReason: null, fundedLock: payment.milestoneId } },
      { new: true }
    )
  } catch (err) {
    if (err.code === 11000) {
      // Another payment already funded this milestone (or this provider payment id is reused).
      console.error(`DUPLICATE FUNDING: order ${payment.providerOrderId} paid ${providerPaymentId} but milestone ${payment.milestoneId} is already funded -- needs a manual refund`)
      throw new ApiError(409, 'This milestone has already been funded by another payment')
    }
    throw err
  }
  if (!updated) return { payment: await Payment.findById(payment._id), changed: false }

  await Milestone.updateOne({ _id: updated.milestoneId }, { $set: { funded: true } })
  const msg = `₹${updated.amount} was paid and is held securely for a milestone.`
  await notifications.notifyMany([updated.clientId, updated.freelancerId], {
    type: 'payment', title: 'Milestone funded', message: msg, relatedEntityId: updated.milestoneId, relatedEntityType: 'Milestone',
  })
  return { payment: updated, changed: true }
}

// ---------------------------------------------------------------- verify (called by the browser after Checkout)
async function verifyPayment(client, body) {
  const orderId = body.razorpay_order_id
  const paymentId = body.razorpay_payment_id
  const signature = body.razorpay_signature

  const payment = await Payment.findOne({ providerOrderId: orderId })
  if (!payment || sid(payment.clientId) !== sid(client._id)) throw new ApiError(404, 'Payment order not found')

  // A bad signature is rejected but NOT recorded as a failed payment: anyone could forge one.
  if (!rzp.verifyPaymentSignature({ orderId, paymentId, signature })) throw new ApiError(400, 'Payment signature verification failed')

  if (FUNDED_PAYMENT_STATUSES.includes(payment.status)) {
    // Duplicate verification with the same identifiers is a harmless replay; anything else is a conflict.
    if (payment.providerPaymentId === paymentId) return { payment: shape(payment), alreadyProcessed: true }
    throw new ApiError(409, 'This order has already been paid')
  }
  if (payment.status === 'Refunded') throw new ApiError(409, 'This payment was refunded')

  const { payment: result, changed } = await applyCaptured(payment, paymentId)
  return { payment: shape(result), alreadyProcessed: !changed }
}

// ---------------------------------------------------------------- webhook
async function handleWebhook(rawBody, signature, eventIdHeader) {
  if (!signature || !rzp.verifyWebhookSignature(rawBody, signature)) throw new ApiError(400, 'Invalid webhook signature')

  let payload
  try {
    payload = JSON.parse(rawBody.toString('utf8'))
  } catch {
    throw new ApiError(400, 'Malformed webhook body')
  }
  const eventId = eventIdHeader || `body_${crypto.createHash('sha256').update(rawBody).digest('hex')}`

  // Idempotency: first writer wins; a duplicate delivery is acknowledged without reprocessing.
  try {
    await WebhookEvent.create({ eventId, event: payload.event })
  } catch (err) {
    if (err.code === 11000) return { duplicate: true }
    throw err
  }

  try {
    await processEvent(payload)
  } catch (err) {
    // Release the claim so Razorpay's retry can be processed (we answer 5xx below via the error handler).
    await WebhookEvent.deleteOne({ eventId }).catch(() => { })
    throw err
  }
  return { duplicate: false }
}

async function processEvent(payload) {
  const paymentEntity = payload?.payload?.payment?.entity
  switch (payload.event) {
    case 'payment.captured':
    case 'order.paid': {
      if (!paymentEntity?.order_id) return
      const payment = await Payment.findOne({ providerOrderId: paymentEntity.order_id })
      if (!payment) return console.warn(`webhook: unknown order ${paymentEntity.order_id}`)
      if (paymentEntity.amount !== rzp.toPaise(payment.amount) || paymentEntity.currency !== payment.currency) {
        return console.error(`webhook: AMOUNT MISMATCH for order ${payment.providerOrderId} (got ${paymentEntity.amount} ${paymentEntity.currency})`)
      }
      if (FUNDED_PAYMENT_STATUSES.includes(payment.status)) return // already funded via /verify
      try {
        await applyCaptured(payment, paymentEntity.id)
      } catch (err) {
        if (err.statusCode === 409) return // logged in applyCaptured; retrying can never succeed
        throw err
      }
      return
    }
    case 'payment.failed': {
      if (!paymentEntity?.order_id) return
      // Only unpaid orders can fail; the order stays retryable (Checkout allows more attempts on it).
      const reason = String(paymentEntity.error_description || paymentEntity.error_code || 'Payment failed').slice(0, 300)
      const payment = await Payment.findOneAndUpdate(
        { providerOrderId: paymentEntity.order_id, status: { $in: ['Pending', 'Failed'] } },
        { $set: { status: 'Failed', failureReason: reason }, $inc: { failedAttempts: 1 } },
        { new: true }
      )
      if (payment) {
        await notifications.notify(payment.clientId, {
          type: 'payment', title: 'Payment failed', message: `Your payment of ₹${payment.amount} did not go through. You can retry from the milestone.`,
          relatedEntityId: payment.milestoneId, relatedEntityType: 'Milestone',
        })
      }
      return
    }
    case 'refund.processed': {
      const providerPaymentId = payload?.payload?.refund?.entity?.payment_id
      if (!providerPaymentId) return
      const payment = await Payment.findOneAndUpdate(
        { providerPaymentId, status: { $in: ['Held', 'Awaiting Payout'] } },
        { $set: { status: 'Refunded', refundedAt: new Date() }, $unset: { fundedLock: 1 } },
        { new: true }
      )
      if (payment) {
        await Milestone.updateOne({ _id: payment.milestoneId, status: { $ne: 'Completed' } }, { $set: { funded: false } })
        await notifications.notifyMany([payment.clientId, payment.freelancerId], {
          type: 'payment', title: 'Payment refunded', message: `A payment of ₹${payment.amount} was refunded.`, relatedEntityId: payment.milestoneId, relatedEntityType: 'Milestone',
        })
      }
      return
    }
    default:
      return // unsubscribed / informational events are acknowledged and ignored
  }
}

// ---------------------------------------------------------------- lifecycle hooks
// Phase 4 (milestone approval) must call this in the same request that sets Milestone.status = 'Completed'.
// Held -> Awaiting Payout; makes the admin's payout queue.
async function markMilestoneApproved(milestoneId) {
  const payment = await Payment.findOneAndUpdate(
    { milestoneId, status: 'Held' },
    { $set: { status: 'Awaiting Payout', approvedAt: new Date() } },
    { new: true }
  )
  if (!payment) return null
  await notifications.notify(payment.freelancerId, {
    type: 'payment', title: 'Milestone approved', message: `Your ₹${payment.amount} payment was approved and will be dispatched by an admin.`,
    relatedEntityId: payment.milestoneId, relatedEntityType: 'Milestone',
  })
  await notifications.notifyAdmins({
    type: 'payment', title: 'Payout pending', message: `A ₹${payment.amount} payout is awaiting dispatch.`, relatedEntityId: payment._id, relatedEntityType: 'Payment',
  })
  return payment
}

// Admin records that the freelancer has been paid out. (Sending money out needs RazorpayX Payouts, a
// separate product/account; this records the dispatch, its destination and an external reference.)
// Mirrors the frontend mock: status checks first, then the freelancer's payout account (FreelancerProfile.paymentAccount).
async function dispatchPayout(admin, paymentId, payoutReference) {
  assertId(paymentId, 'paymentId')
  const existing = await Payment.findById(paymentId)
  if (!existing) throw new ApiError(404, 'Payment not found')
  const statusError = dispatchRules.status(existing.status)
  if (statusError) throw new ApiError(400, statusError)

  const profile = await FreelancerProfile.findOne({ userId: existing.freelancerId }).select('paymentAccount')
  const acctError = dispatchRules.account(profile?.paymentAccount)
  if (acctError) throw new ApiError(400, acctError)

  const payoutId = payoutReference || `pout_${Date.now().toString(36)}${sid(existing._id)}`
  const payment = await Payment.findOneAndUpdate(
    { _id: paymentId, status: 'Awaiting Payout' },
    { $set: { status: 'Paid', payoutAt: new Date(), payoutReference: payoutId, payoutTo: payoutDestination(profile.paymentAccount), dispatchedBy: admin._id, adminVerified: true, adminVerifiedAt: new Date() } },
    { new: true }
  )
  // Lost a race with another dispatch: report it like the mock would for an already-paid row.
  if (!payment) throw new ApiError(400, dispatchRules.status('Paid'))

  const milestone = await Milestone.findById(payment.milestoneId).select('title')
  await notifications.notify(payment.freelancerId, {
    type: 'payment', title: 'Payout sent', message: `₹${payment.amount} for "${milestone?.title ?? 'a milestone'}" was dispatched to your account.`,
    relatedEntityId: payment._id, relatedEntityType: 'Payment',
  })
  await notifications.notify(payment.clientId, {
    type: 'payment', title: 'Payment dispatched', message: `Payment for "${milestone?.title ?? 'a milestone'}" was dispatched to the freelancer.`,
    relatedEntityId: payment._id, relatedEntityType: 'Payment',
  })
  return shape(payment)
}

// Pure: refund preconditions. Only money still held by the platform can be refunded; once approved
// (Awaiting Payout) or paid out the freelancer has a claim, so that needs a dispute decision, not a button.
const refundRules = {
  status: (p) => {
    if (p.status === 'Refunded') return 'This payment has already been refunded.'
    if (p.status !== 'Held') return 'Only a payment still held in escrow (milestone not yet approved) can be refunded.'
    if (p.refundRequestedAt) return 'A refund has already been requested for this payment; waiting for Razorpay to confirm.'
    if (!p.providerPaymentId) return 'This payment has no captured Razorpay payment to refund.'
    return null
  },
}

// Admin-initiated full refund. Claim first (atomic), call Razorpay second, release the claim if Razorpay fails,
// so two admins clicking at once cannot trigger two refunds. The status becomes Refunded via the webhook.
async function refundPayment(admin, paymentId, reason) {
  assertId(paymentId, 'paymentId')
  const existing = await Payment.findById(paymentId)
  if (!existing) throw new ApiError(404, 'Payment not found')
  const ruleError = refundRules.status(existing)
  if (ruleError) throw new ApiError(400, ruleError)

  const claimed = await Payment.findOneAndUpdate(
    { _id: paymentId, status: 'Held', refundRequestedAt: null },
    { $set: { refundRequestedAt: new Date(), refundReason: reason || null, refundedBy: admin._id } },
    { new: true }
  )
  if (!claimed) throw new ApiError(400, refundRules.status({ ...existing.toObject?.() ?? existing, refundRequestedAt: new Date() }))

  let refund
  try {
    refund = await rzp.refundPayment(claimed.providerPaymentId, { notes: { paymentId: sid(claimed._id), reason: reason || '' } })
  } catch (err) {
    await Payment.updateOne({ _id: paymentId, status: 'Held' }, { $set: { refundRequestedAt: null, refundReason: null, refundedBy: null } })
    throw err
  }
  const updated = await Payment.findOneAndUpdate({ _id: paymentId }, { $set: { refundId: refund?.id ?? null } }, { new: true })
  await notifications.notifyMany([claimed.clientId, claimed.freelancerId], {
    type: 'payment', title: 'Refund initiated', message: `A refund of ₹${claimed.amount} was initiated and will appear once the provider confirms it.`,
    relatedEntityId: claimed._id, relatedEntityType: 'Payment',
  })
  return shape(updated ?? claimed)
}

// Admin marks a payment as reviewed (idempotent).
async function verifyByAdmin(paymentId) {
  assertId(paymentId, 'paymentId')
  const payment = await Payment.findOneAndUpdate(
    { _id: paymentId, status: { $in: VISIBLE_PAYMENT_STATUSES } },
    { $set: { adminVerified: true, adminVerifiedAt: new Date() } },
    { new: true }
  )
  if (!payment) throw new ApiError(404, 'Payment not found')
  return shape(payment)
}

// ---------------------------------------------------------------- reads
const MAX_LIST = 200

// Adds the joined display fields the list pages read: milestoneTitle, contractId, jobTitle and the counterparty name.
// counterparty 'freelancer' -> freelancerName (client's view); 'client' -> clientName (company name, else account name).
async function enrichRows(payments, counterparty) {
  if (!payments.length) return []
  const milestones = await Milestone.find({ _id: { $in: payments.map((p) => p.milestoneId) } }).select('title')
  const contracts = await Contract.find({ _id: { $in: payments.map((p) => p.contractId) } }).select('jobId')
  const jobs = await Job.find({ _id: { $in: contracts.map((c) => c.jobId) } }).select('title')
  const otherIds = payments.map((p) => (counterparty === 'freelancer' ? p.freelancerId : p.clientId))
  const [users, profiles] = await Promise.all([
    User.find({ _id: { $in: otherIds } }).select('name'),
    counterparty === 'client' ? ClientProfile.find({ userId: { $in: otherIds } }).select('userId companyName') : [],
  ])
  const msBy = new Map(milestones.map((m) => [sid(m), m.title]))
  const jobOf = new Map(contracts.map((c) => [sid(c), jobs.find((j) => sid(j) === sid(c.jobId))?.title]))
  const nameBy = new Map(users.map((u) => [sid(u), u.name]))
  const companyBy = new Map(profiles.filter((p) => p.companyName).map((p) => [sid(p.userId), p.companyName]))
  return payments.map((p) => {
    const otherId = counterparty === 'freelancer' ? p.freelancerId : p.clientId
    const label = counterparty === 'freelancer' ? { freelancerName: nameBy.get(sid(otherId)) ?? 'Unknown' } : { clientName: companyBy.get(sid(otherId)) ?? nameBy.get(sid(otherId)) ?? 'Unknown' }
    return { ...shape(p), milestoneTitle: msBy.get(sid(p.milestoneId)), jobTitle: jobOf.get(sid(p.contractId)), ...label }
  })
}

// Plain arrays, newest first (the pages map over the array directly). Unpaid orders (Pending/Failed) are not payments.
async function listBy(field, userId, counterparty, query) {
  assertId(userId, field)
  const filter = { [field]: userId, status: { $in: VISIBLE_PAYMENT_STATUSES } }
  if (query?.status && VISIBLE_PAYMENT_STATUSES.includes(String(query.status))) filter.status = String(query.status)
  // Opt-in ?page&limit (with the existing ?status filter); without them the legacy 200-row array.
  const { rows, pg, total } = await findPaged(Payment, filter, { paidAt: -1, createdAt: -1, _id: -1 }, query, MAX_LIST)
  return withPageInfo(await enrichRows(rows, counterparty), pg, total)
}
const listForClient = (clientId, _viewer, query) => listBy('clientId', clientId, 'freelancer', query)
const listForFreelancer = (freelancerId, _viewer, query) => listBy('freelancerId', freelancerId, 'client', query)

async function listAll(_admin, query) {
  const p = parsePagination(query)
  const filter = { status: { $in: VISIBLE_PAYMENT_STATUSES } }
  if (query.status && VISIBLE_PAYMENT_STATUSES.includes(String(query.status))) filter.status = String(query.status)
  const [items, total] = await Promise.all([
    Payment.find(filter).sort({ createdAt: -1, _id: -1 }).skip(p.skip).limit(p.limit),
    Payment.countDocuments(filter),
  ])
  return { items: items.map(shape), pagination: pageMeta(p, total) }
}

// Details = the payment + { milestone, contract, jobTitle, freelancerName, clientName } (both client and freelancer pages).
// A freelancer sees the client's company name; a client/admin sees the account name (same as the mocks).
async function getPayment(paymentId, viewer) {
  assertId(paymentId, 'paymentId')
  const payment = await Payment.findById(paymentId)
  const isParty = payment && [payment.clientId, payment.freelancerId].some((id) => sid(id) === sid(viewer._id))
  if (!payment || !VISIBLE_PAYMENT_STATUSES.includes(payment.status) || !(viewer.role === 'Admin' || isParty)) throw new ApiError(404, 'Payment not found')
  const [milestone, contract, users, clientProfile] = await Promise.all([
    Milestone.findById(payment.milestoneId),
    Contract.findById(payment.contractId),
    User.find({ _id: { $in: [payment.clientId, payment.freelancerId] } }).select('name'),
    ClientProfile.findOne({ userId: payment.clientId }).select('companyName'),
  ])
  const job = contract ? await Job.findById(contract.jobId).select('title') : null
  const nameBy = new Map(users.map((u) => [sid(u), u.name]))
  const clientAccountName = nameBy.get(sid(payment.clientId)) ?? 'Unknown'
  return {
    ...shape(payment),
    milestone: milestone ? toMilestoneDTO(milestone) : null,
    contract: contract ? toContractDTO(contract) : null,
    jobTitle: job?.title,
    freelancerName: nameBy.get(sid(payment.freelancerId)) ?? 'Unknown',
    clientName: viewer.role === 'Freelancer' ? clientProfile?.companyName || clientAccountName : clientAccountName,
  }
}

module.exports = {
  createOrder, verifyPayment, handleWebhook, markMilestoneApproved, dispatchPayout, refundPayment, verifyByAdmin,
  listForClient, listForFreelancer, listAll, getPayment, shape,
  // exported for unit tests
  earlierMilestoneFilter, payoutDestination, dispatchRules, refundRules,
}
