// Phase 4: payments + payment methods. Pure rules + services with Mongoose models stubbed (no database, no Razorpay).
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test_secret_test_secret_test_secret_123'
process.env.RAZORPAY_KEY_ID = 'rzp_test_key'
process.env.RAZORPAY_KEY_SECRET = 'test_key_secret_value'
process.env.RAZORPAY_WEBHOOK_SECRET = 'test_webhook_secret_value'

const test = require('node:test')
const assert = require('node:assert/strict')
const Payment = require('../src/models/Payment')
const Milestone = require('../src/models/Milestone')
const Contract = require('../src/models/Contract')
const Job = require('../src/models/Job')
const User = require('../src/models/User')
const ClientProfile = require('../src/models/ClientProfile')
const FreelancerProfile = require('../src/models/FreelancerProfile')
const PaymentMethod = require('../src/models/PaymentMethod')
const notifications = require('../src/services/notificationService')
const rzp = require('../src/services/razorpayService')
const svc = require('../src/services/paymentService')
const methods = require('../src/services/paymentMethodService')
const dto = require('../src/utils/dto')
const C = require('../src/models/constants')

const CLIENT = 'a'.repeat(24)
const FREE = 'b'.repeat(24)
const STRANGER = 'c'.repeat(24)
const ADMIN = '9'.repeat(24)
const CT = '1'.repeat(24)
const MS = '2'.repeat(24)
const PAY = '3'.repeat(24)
const JOB = 'd'.repeat(24)

const client = { _id: CLIENT, role: 'Client', name: 'Aisha' }
const freelancer = { _id: FREE, role: 'Freelancer', name: 'Meera' }
const admin = { _id: ADMIN, role: 'Admin', name: 'Admin' }
const stranger = { _id: STRANGER, role: 'Client', name: 'Other' }

const makePay = (o = {}) => ({
  _id: PAY, milestoneId: MS, contractId: CT, clientId: CLIENT, freelancerId: FREE, amount: 500, currency: 'INR',
  providerOrderId: 'order_ABC123456', status: 'Held', paidAt: new Date('2025-03-01T00:00:00Z'), createdAt: new Date('2025-02-28T00:00:00Z'), ...o,
})
const stubNotify = (t) => { const sent = []; t.mock.method(notifications, 'notify', async (to, p) => { sent.push({ to: String(to), ...p }); return null }); t.mock.method(notifications, 'notifyMany', async (ids, p) => { ids.forEach((id) => sent.push({ to: String(id), ...p })) }); return sent }
// Chainable stand-in for Model.find(...).sort().limit().select()
const chain = (rows) => { const c = { sort: () => c, limit: () => c, skip: () => c, select: () => c, then: (res, rej) => Promise.resolve(rows).then(res, rej) }; return c }

// ═══ Pure ═══════════════════════════════════════════════════════════════════════════════════
test('earlierMilestoneFilter orders by createdAt then _id and ignores dueDate (null-safe)', () => {
  const created = new Date('2025-01-05T00:00:00Z')
  const f = svc.earlierMilestoneFilter({ _id: MS, contractId: CT, createdAt: created, dueDate: null })
  assert.deepEqual(f.$or, [{ createdAt: { $lt: created } }, { createdAt: created, _id: { $lt: MS } }])
  assert.deepEqual(f.status, { $ne: 'Completed' })
  assert.deepEqual(f._id, { $ne: MS })
  assert.equal(JSON.stringify(f).includes('dueDate'), false)
})

test('payoutDestination: UPI wins, else masked account, else null', () => {
  assert.equal(svc.payoutDestination({ upiId: 'meera@upi', accountNumber: '1234567890' }), 'meera@upi')
  assert.equal(svc.payoutDestination({ upiId: '', accountNumber: '1234567890' }), 'A/c ****7890')
  assert.equal(svc.payoutDestination({ upiId: '', accountNumber: '' }), null)
  assert.equal(svc.payoutDestination(null), null)
})

test('dispatchRules use the frontend mock strings', () => {
  assert.equal(svc.dispatchRules.status('Paid'), 'This payment has already been dispatched.')
  assert.equal(svc.dispatchRules.status('Held'), 'Funds can only be dispatched after the client approves the milestone.')
  assert.equal(svc.dispatchRules.status('Awaiting Payout'), null)
  assert.equal(svc.dispatchRules.account(null), 'The freelancer has not added a payout account (bank/UPI) yet.')
  assert.equal(svc.dispatchRules.account({ upiId: 'a@b' }), null)
})

test('toPaymentDTO: final frontend shape; Paid rows report the payout date', () => {
  const d = dto.toPaymentDTO(makePay({ status: 'Paid', providerPaymentId: 'pay_1', payoutAt: new Date('2025-04-01T00:00:00Z'), payoutReference: 'pout_x', payoutTo: 'meera@upi', adminVerified: true, approvedAt: new Date('2025-03-10T00:00:00Z') }))
  assert.deepEqual(d, {
    paymentId: PAY, milestoneId: MS, contractId: CT, amount: 500, paymentDate: '2025-04-01T00:00:00.000Z', paymentStatus: 'Paid',
    razorpayPaymentId: 'pay_1', adminVerified: true, adminVerifiedAt: null, approvedAt: '2025-03-10T00:00:00.000Z', payoutTo: 'meera@upi', payoutId: 'pout_x',
  })
  assert.equal(dto.toPaymentDTO(makePay()).paymentDate, '2025-03-01T00:00:00.000Z')
})

test('toPaymentMethodDTO: frontend field names, no internal fields', () => {
  const d = dto.toPaymentMethodDTO({ _id: PAY, clientId: CLIENT, type: 'Card', brand: 'Visa', last4: '4242', expiry: '09/28', holderName: 'Aisha', isDefault: true, __v: 0 })
  assert.deepEqual(d, { paymentMethodId: PAY, clientId: CLIENT, type: 'Card', brand: 'Visa', last4: '4242', expiry: '09/28', holderName: 'Aisha', isDefault: true })
})

test('constants: only paid/held/refunded payments are visible to users', () => {
  assert.deepEqual(C.VISIBLE_PAYMENT_STATUSES, ['Held', 'Awaiting Payout', 'Paid', 'Refunded'])
})

// ═══ createOrder: sequential funding ════════════════════════════════════════════════════════
const makeMs = (o = {}) => ({ _id: MS, contractId: CT, title: 'M1', amount: 500, status: 'Pending', funded: false, dueDate: null, createdAt: new Date('2025-02-01T00:00:00Z'), ...o })
const makeContract = (o = {}) => ({ _id: CT, jobId: JOB, clientId: CLIENT, freelancerId: FREE, status: 'Active', ...o })

test('createOrder: an earlier open milestone (dueDate null on both) blocks funding a later one', async (t) => {
  t.mock.method(Milestone, 'findById', async () => makeMs({ _id: '4'.repeat(24), createdAt: new Date('2025-02-02T00:00:00Z') }))
  t.mock.method(Contract, 'findById', async () => makeContract())
  let seenFilter
  t.mock.method(Milestone, 'exists', async (f) => { seenFilter = f; return { _id: MS } })
  await assert.rejects(() => svc.createOrder(client, '4'.repeat(24)), (e) => e.statusCode === 409 && /Earlier milestones/.test(e.message))
  assert.ok(seenFilter.$or, 'uses the createdAt/_id ordering')
})

test('createOrder: the first milestone (nothing earlier) proceeds and the amount comes from the milestone', async (t) => {
  t.mock.method(Milestone, 'findById', async () => makeMs())
  t.mock.method(Contract, 'findById', async () => makeContract())
  t.mock.method(Milestone, 'exists', async () => null)
  t.mock.method(Payment, 'exists', async () => null)
  t.mock.method(Payment, 'findOne', () => chain(null))
  let orderArgs
  t.mock.method(rzp, 'createOrder', async (a) => { orderArgs = a; return { id: 'order_NEW123456', amount: a.amountPaise } })
  t.mock.method(Payment, 'create', async (d) => makePay({ ...d, status: 'Pending' }))
  const out = await svc.createOrder(client, MS)
  assert.equal(orderArgs.amountPaise, 50000)
  assert.equal(out.orderId, 'order_NEW123456')
  assert.equal(out.amount, 50000)
  assert.equal(out.keyId, 'rzp_test_key')
})

test('createOrder: a stranger gets 404, a non-Active contract 409, an already funded milestone 409', async (t) => {
  t.mock.method(Milestone, 'findById', async () => makeMs())
  t.mock.method(Contract, 'findById', async () => makeContract())
  await assert.rejects(() => svc.createOrder(stranger, MS), (e) => e.statusCode === 404)
  t.mock.method(Contract, 'findById', async () => makeContract({ status: 'Pending Start' }))
  await assert.rejects(() => svc.createOrder(client, MS), (e) => e.statusCode === 409 && /cannot be funded/.test(e.message))
  t.mock.method(Contract, 'findById', async () => makeContract())
  t.mock.method(Milestone, 'findById', async () => makeMs({ funded: true }))
  await assert.rejects(() => svc.createOrder(client, MS), (e) => e.statusCode === 409 && /already funded/.test(e.message))
})

// ═══ verify: replay safety ══════════════════════════════════════════════════════════════════
const signed = (orderId, paymentId) => rzp.hmacHex('test_key_secret_value', `${orderId}|${paymentId}`)

test('verifyPayment: Pending -> Held once; a replay with the same ids is a harmless no-op that returns the payment', async (t) => {
  const sent = stubNotify(t)
  const order = 'order_ABC123456'; const payId = 'pay_XYZ123456'
  const pending = makePay({ status: 'Pending', paidAt: null })
  t.mock.method(Payment, 'findOne', async () => pending)
  let updates = 0
  t.mock.method(Payment, 'findOneAndUpdate', async () => { updates += 1; return makePay({ status: 'Held', providerPaymentId: payId }) })
  t.mock.method(Milestone, 'updateOne', async () => ({}))
  const body = { razorpay_order_id: order, razorpay_payment_id: payId, razorpay_signature: signed(order, payId) }
  const first = await svc.verifyPayment(client, body)
  assert.equal(first.alreadyProcessed, false)
  assert.equal(first.payment.paymentStatus, 'Held')
  assert.equal(first.payment.razorpayPaymentId, 'pay_XYZ123456')
  assert.equal(updates, 1)
  assert.equal(sent.length, 2) // client + freelancer told once

  // Replay: the stored payment is now Held with the same provider payment id.
  t.mock.method(Payment, 'findOne', async () => makePay({ status: 'Held', providerPaymentId: payId }))
  const replay = await svc.verifyPayment(client, body)
  assert.equal(replay.alreadyProcessed, true)
  assert.equal(updates, 1, 'no second write')
  assert.equal(sent.length, 2, 'no second notification')
})

test('verifyPayment: bad signature -> 400 and nothing is written; another user -> 404; different payment id on a paid order -> 409', async (t) => {
  const order = 'order_ABC123456'
  t.mock.method(Payment, 'findOne', async () => makePay({ status: 'Pending' }))
  const write = t.mock.method(Payment, 'findOneAndUpdate', async () => { throw new Error('must not write') })
  await assert.rejects(() => svc.verifyPayment(client, { razorpay_order_id: order, razorpay_payment_id: 'pay_XYZ123456', razorpay_signature: 'f'.repeat(64) }), (e) => e.statusCode === 400)
  await assert.rejects(() => svc.verifyPayment(stranger, { razorpay_order_id: order, razorpay_payment_id: 'pay_XYZ123456', razorpay_signature: signed(order, 'pay_XYZ123456') }), (e) => e.statusCode === 404)
  t.mock.method(Payment, 'findOne', async () => makePay({ status: 'Held', providerPaymentId: 'pay_FIRST12345' }))
  await assert.rejects(() => svc.verifyPayment(client, { razorpay_order_id: order, razorpay_payment_id: 'pay_OTHER12345', razorpay_signature: signed(order, 'pay_OTHER12345') }), (e) => e.statusCode === 409)
  assert.equal(write.mock.callCount(), 0)
})

// ═══ Webhook: raw-body signature ════════════════════════════════════════════════════════════
test('handleWebhook: signature is checked over the raw bytes (a re-serialised body fails)', async (t) => {
  const raw = Buffer.from('{"event":"payment.failed",  "payload":{}}') // odd spacing on purpose
  const good = rzp.hmacHex('test_webhook_secret_value', raw)
  const reserialised = Buffer.from(JSON.stringify(JSON.parse(raw.toString())))
  await assert.rejects(() => svc.handleWebhook(reserialised, good, 'evt_1'), (e) => e.statusCode === 400)
  await assert.rejects(() => svc.handleWebhook(raw, undefined, 'evt_1'), (e) => e.statusCode === 400)
  const WebhookEvent = require('../src/models/WebhookEvent')
  t.mock.method(WebhookEvent, 'create', async () => ({}))
  const res = await svc.handleWebhook(raw, good, 'evt_1')
  assert.equal(res.duplicate, false)
})

test('handleWebhook: a duplicate delivery is acknowledged without reprocessing', async (t) => {
  const raw = Buffer.from('{"event":"payment.captured","payload":{}}')
  const WebhookEvent = require('../src/models/WebhookEvent')
  t.mock.method(WebhookEvent, 'create', async () => { const e = new Error('dup'); e.code = 11000; throw e })
  const res = await svc.handleWebhook(raw, rzp.hmacHex('test_webhook_secret_value', raw), 'evt_dup')
  assert.equal(res.duplicate, true)
})

// ═══ Payout / admin verify ══════════════════════════════════════════════════════════════════
test('dispatchPayout: Awaiting Payout -> Paid with destination, reference, verified; both parties notified', async (t) => {
  const sent = stubNotify(t)
  t.mock.method(Payment, 'findById', async () => makePay({ status: 'Awaiting Payout' }))
  t.mock.method(FreelancerProfile, 'findOne', () => chain({ paymentAccount: { upiId: 'meera@upi' } }))
  t.mock.method(Milestone, 'findById', () => chain({ title: 'Backend' }))
  let update
  t.mock.method(Payment, 'findOneAndUpdate', async (f, u) => { update = { f, u }; return makePay({ status: 'Paid', ...u.$set }) })
  const out = await svc.dispatchPayout(admin, PAY)
  assert.deepEqual(update.f, { _id: PAY, status: 'Awaiting Payout' }) // conditional update
  assert.equal(update.u.$set.payoutTo, 'meera@upi')
  assert.equal(update.u.$set.adminVerified, true)
  assert.match(update.u.$set.payoutReference, /^pout_/)
  assert.equal(out.paymentStatus, 'Paid')
  assert.equal(out.payoutTo, 'meera@upi')
  assert.deepEqual(sent.map((s) => s.to).sort(), [CLIENT, FREE].sort())
})

test('dispatchPayout: mock error strings for Paid / Held / missing account / missing payment', async (t) => {
  t.mock.method(Payment, 'findById', async () => makePay({ status: 'Paid' }))
  await assert.rejects(() => svc.dispatchPayout(admin, PAY), (e) => e.statusCode === 400 && e.message === 'This payment has already been dispatched.')
  t.mock.method(Payment, 'findById', async () => makePay({ status: 'Held' }))
  await assert.rejects(() => svc.dispatchPayout(admin, PAY), (e) => e.statusCode === 400 && e.message === 'Funds can only be dispatched after the client approves the milestone.')
  t.mock.method(Payment, 'findById', async () => makePay({ status: 'Awaiting Payout' }))
  t.mock.method(FreelancerProfile, 'findOne', () => chain({ paymentAccount: null }))
  await assert.rejects(() => svc.dispatchPayout(admin, PAY), (e) => e.statusCode === 400 && e.message === 'The freelancer has not added a payout account (bank/UPI) yet.')
  t.mock.method(Payment, 'findById', async () => null)
  await assert.rejects(() => svc.dispatchPayout(admin, PAY), (e) => e.statusCode === 404 && e.message === 'Payment not found')
})

test('dispatchPayout: losing the race to another dispatch reports "already dispatched", never double-pays', async (t) => {
  stubNotify(t)
  t.mock.method(Payment, 'findById', async () => makePay({ status: 'Awaiting Payout' }))
  t.mock.method(FreelancerProfile, 'findOne', () => chain({ paymentAccount: { upiId: 'meera@upi' } }))
  t.mock.method(Payment, 'findOneAndUpdate', async () => null)
  await assert.rejects(() => svc.dispatchPayout(admin, PAY), (e) => e.message === 'This payment has already been dispatched.')
})

test('verifyByAdmin: marks verified; unknown / unpaid order -> 404', async (t) => {
  t.mock.method(Payment, 'findOneAndUpdate', async (f, u) => makePay({ ...u.$set }))
  const out = await svc.verifyByAdmin(PAY)
  assert.equal(out.adminVerified, true)
  t.mock.method(Payment, 'findOneAndUpdate', async () => null)
  await assert.rejects(() => svc.verifyByAdmin(PAY), (e) => e.statusCode === 404)
})

// ═══ Reads ══════════════════════════════════════════════════════════════════════════════════
test('listForClient: plain array, only visible statuses, joined display fields, no Razorpay order ids', async (t) => {
  let seen
  t.mock.method(Payment, 'find', (f) => { seen = f; return chain([makePay({ providerPaymentId: 'pay_1' })]) })
  t.mock.method(Milestone, 'find', () => chain([{ _id: MS, title: 'Backend' }]))
  t.mock.method(Contract, 'find', () => chain([{ _id: CT, jobId: JOB }]))
  t.mock.method(Job, 'find', () => chain([{ _id: JOB, title: 'Mobile API' }]))
  t.mock.method(User, 'find', () => chain([{ _id: FREE, name: 'Meera' }]))
  const rows = await svc.listForClient(CLIENT, client, {})
  assert.deepEqual(seen.status, { $in: C.VISIBLE_PAYMENT_STATUSES })
  assert.ok(Array.isArray(rows))
  assert.equal(rows[0].milestoneTitle, 'Backend')
  assert.equal(rows[0].jobTitle, 'Mobile API')
  assert.equal(rows[0].freelancerName, 'Meera')
  assert.equal(rows[0].contractId, CT)
  assert.equal('providerOrderId' in rows[0], false)
})

test('listForFreelancer: counterparty is the client (company name preferred)', async (t) => {
  t.mock.method(Payment, 'find', () => chain([makePay()]))
  t.mock.method(Milestone, 'find', () => chain([{ _id: MS, title: 'Backend' }]))
  t.mock.method(Contract, 'find', () => chain([{ _id: CT, jobId: JOB }]))
  t.mock.method(Job, 'find', () => chain([{ _id: JOB, title: 'Mobile API' }]))
  t.mock.method(User, 'find', () => chain([{ _id: CLIENT, name: 'Aisha' }]))
  t.mock.method(ClientProfile, 'find', () => chain([{ userId: CLIENT, companyName: 'TechNova' }]))
  const rows = await svc.listForFreelancer(FREE, freelancer, {})
  assert.equal(rows[0].clientName, 'TechNova')
  assert.equal('freelancerName' in rows[0], false)
})

test('getPayment: parties and admins see it; strangers and unpaid orders get 404; details carry milestone/contract/names', async (t) => {
  t.mock.method(Payment, 'findById', async () => makePay())
  t.mock.method(Milestone, 'findById', async () => makeMs({ funded: true }))
  t.mock.method(Contract, 'findById', async () => makeContract())
  t.mock.method(User, 'find', () => chain([{ _id: CLIENT, name: 'Aisha' }, { _id: FREE, name: 'Meera' }]))
  t.mock.method(ClientProfile, 'findOne', () => chain({ companyName: 'TechNova' }))
  t.mock.method(Job, 'findById', () => chain({ title: 'Mobile API' }))
  const asClient = await svc.getPayment(PAY, client)
  assert.equal(asClient.clientName, 'Aisha')
  assert.equal(asClient.freelancerName, 'Meera')
  assert.equal(asClient.jobTitle, 'Mobile API')
  assert.equal(asClient.milestone.milestoneId, MS)
  assert.equal(asClient.contract.contractId, CT)
  const asFreelancer = await svc.getPayment(PAY, freelancer)
  assert.equal(asFreelancer.clientName, 'TechNova')
  await svc.getPayment(PAY, admin)
  await assert.rejects(() => svc.getPayment(PAY, stranger), (e) => e.statusCode === 404)
  t.mock.method(Payment, 'findById', async () => makePay({ status: 'Pending' }))
  await assert.rejects(() => svc.getPayment(PAY, client), (e) => e.statusCode === 404)
})

// ═══ Payment methods ════════════════════════════════════════════════════════════════════════
test('paymentMethods: list/add return DTOs; first method becomes default', async (t) => {
  t.mock.method(PaymentMethod, 'find', () => chain([{ _id: PAY, clientId: CLIENT, type: 'Card', brand: 'Visa', last4: '4242', expiry: '09/28', holderName: 'Aisha', isDefault: true }]))
  const list = await methods.list(CLIENT)
  assert.equal(list[0].paymentMethodId, PAY)
  assert.equal(list[0].last4, '4242')

  t.mock.method(User, 'findById', async () => ({ _id: CLIENT, role: 'Client' }))
  t.mock.method(PaymentMethod, 'countDocuments', async () => 0)
  t.mock.method(PaymentMethod, 'exists', async () => null)
  let saved
  t.mock.method(PaymentMethod, 'create', async (d) => { saved = d; return { _id: PAY, ...d } })
  const added = await methods.add(CLIENT, { type: 'Card', brand: 'Visa', last4: '4242', expiry: '09/28', holderName: 'Aisha' })
  assert.equal(saved.isDefault, true)
  assert.equal(added.paymentMethodId, PAY)
  assert.equal('cardNumber' in saved, false)
})

test('paymentMethods: remove/setDefault are owner-only (foreign id looks missing) and remove promotes a new default', async (t) => {
  t.mock.method(PaymentMethod, 'findOne', async (f) => (String(f.clientId) === CLIENT ? { _id: PAY, clientId: CLIENT, isDefault: true, deleteOne: async () => {}, save: async () => {}, type: 'Card' } : null))
  await assert.rejects(() => methods.remove(PAY, stranger), (e) => e.statusCode === 404 && e.message === 'Payment method not found')
  await assert.rejects(() => methods.setDefault(PAY, stranger), (e) => e.statusCode === 404)
  let promoted
  t.mock.method(PaymentMethod, 'updateOne', async (f, u) => { promoted = { f, u } })
  const NEXT = '7'.repeat(24)
  t.mock.method(PaymentMethod, 'findOne', (f) => (f._id ? Promise.resolve({ _id: PAY, clientId: CLIENT, isDefault: true, deleteOne: async () => {} }) : chain({ _id: NEXT })))
  const out = await methods.remove(PAY, client)
  assert.deepEqual(out, { paymentMethodId: PAY })
  assert.equal(String(promoted.f._id), NEXT)
})
