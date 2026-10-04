const mongoose = require('mongoose')
const Milestone = require('../models/Milestone')
const Contract = require('../models/Contract')
const Payment = require('../models/Payment')
const Job = require('../models/Job')
const ApiError = require('../utils/ApiError')
const notifications = require('./notificationService')
const paymentService = require('./paymentService')
const { toMilestoneDTO, toPaymentDTO, idOf } = require('../utils/dto')
const { EDITABLE_MILESTONE_STATUSES, TERMINAL_CONTRACT_STATUSES } = require('../models/constants')

const assertId = (id, label = 'milestoneId') => {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, `Invalid ${label}`)
}

// ── Pure rules (unit-tested without a database). Messages are the frontend mock's exact strings. ──
const rules = {
  // The mock allows adding to any contract; a finished contract must not grow new work.
  create: (contractStatus) => (TERMINAL_CONTRACT_STATUSES.includes(contractStatus) ? `A milestone cannot be added to a ${contractStatus.toLowerCase()} contract.` : null),
  edit: (status, funded) => {
    if (!EDITABLE_MILESTONE_STATUSES.includes(status)) return `A milestone that is ${status.toLowerCase()} can no longer be edited.`
    if (funded) return 'A funded milestone can no longer be edited.'
    return null
  },
  remove: (status, funded) => {
    if (!EDITABLE_MILESTONE_STATUSES.includes(status)) return `A milestone that is ${status.toLowerCase()} can no longer be deleted.`
    if (funded) return 'A funded milestone can no longer be deleted.'
    return null
  },
  // "not funded" is checked before the status, like the mock.
  submit: (status, funded, contractStatus) => {
    if (!funded) return 'The client has not funded this milestone yet.'
    if (status !== 'Pending') return 'This milestone has already been submitted.'
    if (contractStatus !== 'Active') return 'Only a milestone on an active contract can be submitted.'
    return null
  },
  reject: (status) => (status === 'Submitted' ? null : 'Only a submitted milestone can be rejected.'),
  approve: (status) => (status === 'Submitted' ? null : 'This milestone must be submitted by the freelancer before it can be approved.'),
  approvePaid: (hasHeldPayment) => (hasHeldPayment ? null : 'This milestone has not been paid to the platform yet.'),
}

const BAD_FIELDS = 'A title and a positive amount are required.'

// Validates + normalises the milestone fields (title/amount required; dueDate optional -> Date | null).
function cleanFields({ title, amount, dueDate }) {
  const t = typeof title === 'string' ? title.trim() : ''
  const n = typeof amount === 'boolean' || amount === '' || amount === null ? NaN : Number(amount)
  if (!t || !Number.isFinite(n) || n <= 0) throw new ApiError(400, BAD_FIELDS)
  if (t.length > 100) throw new ApiError(400, 'Milestone title must be 100 characters or fewer.')
  if (n > 1e9) throw new ApiError(400, BAD_FIELDS)
  let due = null
  if (dueDate) {
    due = new Date(dueDate)
    if (Number.isNaN(due.getTime())) throw new ApiError(400, 'Enter a valid due date.')
  }
  return { title: t, amount: n, dueDate: due }
}

// Loads a milestone + its contract and requires the caller to be the right party.
// Anyone who is not a party gets the same 404 as a missing milestone (no id probing).
async function loadWithContract(milestoneId, viewer, requiredRole) {
  assertId(milestoneId)
  const milestone = await Milestone.findById(milestoneId)
  if (!milestone) throw new ApiError(404, 'Milestone not found')
  const contract = await Contract.findById(milestone.contractId)
  if (!contract) throw new ApiError(404, 'Milestone not found')
  const role = idOf(contract.clientId) === idOf(viewer) ? 'Client' : idOf(contract.freelancerId) === idOf(viewer) ? 'Freelancer' : null
  if (!role) throw new ApiError(404, 'Milestone not found')
  if (role !== requiredRole) throw new ApiError(403, `Only the ${requiredRole.toLowerCase()} can do this`)
  return { milestone, contract }
}

const conflict = () => new ApiError(409, 'This milestone was changed by someone else. Refresh and try again.')

// ── Client: manage ─────────────────────────────────────────────────────────────────────────
async function create(client, contractId, body) {
  assertId(contractId, 'contractId')
  const contract = await Contract.findById(contractId)
  if (!contract || idOf(contract.clientId) !== idOf(client)) throw new ApiError(404, 'Contract not found')
  const fields = cleanFields(body)
  const blocked = rules.create(contract.status)
  if (blocked) throw new ApiError(400, blocked)
  const m = await Milestone.create({ contractId: contract._id, ...fields, status: 'Pending', funded: false })
  return toMilestoneDTO(m)
}

async function edit(client, milestoneId, body) {
  const { milestone } = await loadWithContract(milestoneId, client, 'Client')
  const blocked = rules.edit(milestone.status, milestone.funded)
  if (blocked) throw new ApiError(400, blocked)
  const fields = cleanFields(body)
  // Conditional on still being Pending AND unfunded: a payment landing mid-edit wins.
  const updated = await Milestone.findOneAndUpdate({ _id: milestone._id, status: 'Pending', funded: false }, { $set: fields }, { new: true })
  if (!updated) throw conflict()
  return toMilestoneDTO(updated)
}

async function remove(client, milestoneId) {
  const { milestone } = await loadWithContract(milestoneId, client, 'Client')
  const blocked = rules.remove(milestone.status, milestone.funded)
  if (blocked) throw new ApiError(400, blocked)
  const res = await Milestone.deleteOne({ _id: milestone._id, status: 'Pending', funded: false })
  if (res.deletedCount !== 1) throw conflict()
  return { milestoneId: idOf(milestone) }
}

async function reject(client, milestoneId, reason) {
  const { milestone, contract } = await loadWithContract(milestoneId, client, 'Client')
  const blocked = rules.reject(milestone.status)
  if (blocked) throw new ApiError(400, blocked)
  const updated = await Milestone.findOneAndUpdate(
    { _id: milestone._id, status: 'Submitted' },
    { $set: { status: 'Pending', rejectionReason: reason || null } },
    { new: true }
  )
  if (!updated) throw conflict()
  await notifications.notify(contract.freelancerId, {
    type: 'milestone', title: 'Milestone rejected', message: `"${updated.title}" was sent back${reason ? `: ${reason}` : '.'}`,
    relatedEntityId: updated._id, relatedEntityType: 'Milestone',
  })
  return toMilestoneDTO(updated)
}

// ── Freelancer: submit ─────────────────────────────────────────────────────────────────────
async function submit(freelancer, milestoneId) {
  const { milestone, contract } = await loadWithContract(milestoneId, freelancer, 'Freelancer')
  const blocked = rules.submit(milestone.status, milestone.funded, contract.status)
  if (blocked) throw new ApiError(400, blocked)
  const updated = await Milestone.findOneAndUpdate(
    { _id: milestone._id, status: 'Pending', funded: true },
    { $set: { status: 'Submitted', rejectionReason: null } },
    { new: true }
  )
  if (!updated) throw conflict()
  const job = await Job.findById(contract.jobId).select('title')
  await notifications.notify(contract.clientId, {
    type: 'milestone', title: 'Milestone submitted', message: `"${updated.title}"${job ? ` on "${job.title}"` : ''} was submitted for your review.`,
    relatedEntityId: updated._id, relatedEntityType: 'Milestone',
  })
  return toMilestoneDTO(updated)
}

// ── Client: approve (= POST /milestones/:id/release-payment) ───────────────────────────────
// Milestone Submitted -> Completed, and the held payment Held -> Awaiting Payout (paymentService hook).
// The money is NOT sent to the freelancer here: an admin dispatches it afterwards.
async function approve(client, milestoneId) {
  const { milestone, contract } = await loadWithContract(milestoneId, client, 'Client')
  const blocked = rules.approve(milestone.status)
  if (blocked) throw new ApiError(400, blocked)
  const held = await Payment.findOne({ milestoneId: milestone._id, status: 'Held' })
  const unpaid = rules.approvePaid(Boolean(held))
  if (unpaid) throw new ApiError(400, unpaid)

  const done = await Milestone.findOneAndUpdate({ _id: milestone._id, status: 'Submitted' }, { $set: { status: 'Completed' } }, { new: true })
  if (!done) throw conflict()
  const payment = await paymentService.markMilestoneApproved(milestone._id)
  if (!payment) {
    // The payment stopped being "Held" between our check and now (webhook/refund race): undo the state change.
    await Milestone.updateOne({ _id: milestone._id, status: 'Completed' }, { $set: { status: 'Submitted' } })
    throw new ApiError(409, 'This milestone payment changed while approving. Refresh and try again.')
  }
  // "next milestone" = the first one still waiting for funding (same definition as the mock).
  const next = await Milestone.findOne({ contractId: contract._id, funded: false }).sort({ createdAt: 1, _id: 1 })
  return { ...toPaymentDTO(payment), nextMilestone: next ? toMilestoneDTO(next) : null }
}

module.exports = {
  create, edit, remove, submit, reject, approve,
  // exported for unit tests
  rules, cleanFields,
}
