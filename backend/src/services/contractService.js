const mongoose = require('mongoose')
const Contract = require('../models/Contract')
const Job = require('../models/Job')
const Milestone = require('../models/Milestone')
const Payment = require('../models/Payment')
const Review = require('../models/Review')
const User = require('../models/User')
const ClientProfile = require('../models/ClientProfile')
const ApiError = require('../utils/ApiError')
const notifications = require('./notificationService')
const { toContractDTO, toJobDTO, toMilestoneDTO, toPaymentDTO, toReviewDTO, idOf } = require('../utils/dto')
const { FUNDED_PAYMENT_STATUSES, TERMINAL_CONTRACT_STATUSES, CONTRACT_STATUSES } = require('../models/constants')
const { withPageInfo, findPaged } = require('../utils/pagination')

const MAX_LIST = 200
const assertId = (id, label = 'contractId') => {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, `Invalid ${label}`)
}

// ── Pure rules (unit-tested without a database). Messages are the frontend mock's exact strings. ──
const rules = {
  start: (status) => (status === 'Pending Start' ? null : 'Only a contract pending start can be started.'),
  complete: (status) => (status === 'Active' ? null : 'Only an active contract can be completed.'),
  // The mock only blocks Completed / Cancelled. A Terminated contract is just as final, so it is blocked with the same text.
  cancel: (status) => (TERMINAL_CONTRACT_STATUSES.includes(status) ? 'A completed or already-cancelled contract cannot be cancelled.' : null),
  requestTermination: (status, alreadyRequestedBy) => {
    if (status !== 'Active') return 'Only an active contract can be terminated.'
    if (alreadyRequestedBy) return 'A termination request is already pending on this contract.'
    return null
  },
  hasPendingRequest: (requestedBy) => (requestedBy ? null : 'There is no pending termination request on this contract.'),
}

// Who may answer a pending termination request?
//  - approve: only the OTHER party (you cannot approve your own request)
//  - decline/withdraw: either party (the UI's "Withdraw termination request" button calls respond(approve:false) as the requester)
const canRespond = (requestedBy, viewerRole, approve) => (approve ? requestedBy !== viewerRole : true)

// Splits the job budget over the milestone tasks: floor(budget/n) each, the last one takes the remainder.
function splitBudget(budget, taskCount) {
  const total = Number(budget)
  if (!taskCount) return []
  const each = Math.floor(total / taskCount)
  return Array.from({ length: taskCount }, (_, i) => (i === taskCount - 1 ? total - each * (taskCount - 1) : each))
}

// 'Client' | 'Freelancer' | null for this viewer on this contract.
function partyRole(contract, viewer) {
  if (idOf(contract.clientId) === idOf(viewer)) return 'Client'
  if (idOf(contract.freelancerId) === idOf(viewer)) return 'Freelancer'
  return null
}

// ── Data access ────────────────────────────────────────────────────────────────────────────
async function loadContract(contractId) {
  assertId(contractId)
  const c = await Contract.findById(contractId)
  if (!c) throw new ApiError(404, 'Contract not found')
  return c
}

// Loads a contract and requires the caller to be a party. Strangers get the same 404 as a missing contract.
async function loadForParty(contractId, viewer, requiredRole) {
  const contract = await loadContract(contractId)
  const role = partyRole(contract, viewer)
  if (!role) throw new ApiError(404, 'Contract not found')
  if (requiredRole && role !== requiredRole) throw new ApiError(403, `Only the ${requiredRole.toLowerCase()} can do this`)
  return { contract, role }
}

async function names(userIds) {
  const ids = [...new Set(userIds.map(String))]
  if (!ids.length) return { users: new Map(), companies: new Map() }
  const [users, profiles] = await Promise.all([
    User.find({ _id: { $in: ids } }).select('name'),
    ClientProfile.find({ userId: { $in: ids } }).select('userId companyName'),
  ])
  const companies = new Map()
  for (const p of profiles) if (p.companyName) companies.set(String(p.userId), p.companyName)
  return { users: new Map(users.map((u) => [String(u._id), u.name])), companies }
}
// Client label for freelancers: company name, else account name (same fallback as the mock).
const clientLabel = (n, id) => n.companies.get(String(id)) ?? n.users.get(String(id)) ?? 'Unknown'

// Ends the job in step with the contract. Conditional so it never resurrects a job someone else moved on.
const settleJob = (jobId, to) => Job.updateOne({ _id: jobId, status: 'In Progress' }, { $set: { status: to } })

// ── Lists ──────────────────────────────────────────────────────────────────────────────────
// Both lists: opt-in ?page&limit (+ ?status=<contract status>); without them the legacy 200-row array.
const listFilter = (field, id, query) => ({ [field]: id, ...(CONTRACT_STATUSES.includes(query?.status) ? { status: query.status } : {}) })

async function listForClient(clientId, query = {}) {
  assertId(clientId, 'clientId')
  const { rows: contracts, pg, total } = await findPaged(Contract, listFilter('clientId', clientId, query), { createdAt: -1, _id: -1 }, query, MAX_LIST)
  const [jobs, n] = await Promise.all([
    contracts.length ? Job.find({ _id: { $in: contracts.map((c) => c.jobId) } }).select('title') : [],
    names(contracts.map((c) => c.freelancerId)),
  ])
  const jobBy = new Map(jobs.map((j) => [String(j._id), j.title]))
  return withPageInfo(contracts.map((c) => ({ ...toContractDTO(c), jobTitle: jobBy.get(String(c.jobId)), freelancerName: n.users.get(String(c.freelancerId)) ?? 'Unknown' })), pg, total)
}

async function listForFreelancer(freelancerId, query = {}) {
  assertId(freelancerId, 'freelancerId')
  const { rows: contracts, pg, total } = await findPaged(Contract, listFilter('freelancerId', freelancerId, query), { createdAt: -1, _id: -1 }, query, MAX_LIST)
  const [jobs, n] = await Promise.all([
    contracts.length ? Job.find({ _id: { $in: contracts.map((c) => c.jobId) } }).select('title') : [],
    names(contracts.map((c) => c.clientId)),
  ])
  const jobBy = new Map(jobs.map((j) => [String(j._id), j.title]))
  return withPageInfo(contracts.map((c) => ({ ...toContractDTO(c), jobTitle: jobBy.get(String(c.jobId)), clientName: clientLabel(n, c.clientId) })), pg, total)
}

// ── Details ────────────────────────────────────────────────────────────────────────────────
// One joined object; the Client gets `reviews`, the Freelancer does not (matches the two mock queries).
async function getDetails(contractId, viewer) {
  const { contract, role } = await loadForParty(contractId, viewer)
  const [job, milestones, n] = await Promise.all([
    Job.findById(contract.jobId),
    Milestone.find({ contractId: contract._id }).sort({ createdAt: 1, _id: 1 }),
    names([contract.clientId, contract.freelancerId]),
  ])
  const payments = milestones.length
    ? await Payment.find({ milestoneId: { $in: milestones.map((m) => m._id) }, status: { $in: FUNDED_PAYMENT_STATUSES } }).sort({ createdAt: -1 })
    : []
  const payBy = new Map()
  for (const p of payments) if (!payBy.has(String(p.milestoneId))) payBy.set(String(p.milestoneId), toPaymentDTO(p))
  const base = {
    ...toContractDTO(contract),
    job: job ? toJobDTO(job) : null,
    freelancerName: n.users.get(String(contract.freelancerId)) ?? 'Unknown',
    milestones: milestones.map((m) => ({ ...toMilestoneDTO(m), payment: payBy.get(String(m._id)) ?? null })),
  }
  if (role === 'Freelancer') return { ...base, clientName: clientLabel(n, contract.clientId) }
  const reviews = await Review.find({ contractId: contract._id }).sort({ createdAt: 1, _id: 1 })
  return { ...base, clientName: n.users.get(String(contract.clientId)) ?? 'Unknown', reviews: reviews.map(toReviewDTO) }
}

// ── Lifecycle ──────────────────────────────────────────────────────────────────────────────
// Conditional update: two concurrent requests can't both move the same contract.
async function moveContract(contract, from, set, message) {
  const updated = await Contract.findOneAndUpdate({ _id: contract._id, status: from }, { $set: set }, { new: true })
  if (!updated) throw new ApiError(409, message ?? 'This contract was changed by someone else. Refresh and try again.')
  return updated
}

async function start(client, contractId) {
  const { contract } = await loadForParty(contractId, client, 'Client')
  const blocked = rules.start(contract.status)
  if (blocked) throw new ApiError(400, blocked)
  // Validate the milestone split BEFORE flipping the status so a bad budget can't leave a half-started contract.
  const job = await Job.findById(contract.jobId)
  const tasks = job?.milestoneTasks ?? []
  const amounts = splitBudget(job?.budget, tasks.length)
  if (amounts.some((a) => !(a >= 0.01))) {
    throw new ApiError(400, 'The job budget is too small to split across its milestones. Add milestones manually.')
  }
  const started = await moveContract(contract, 'Pending Start', { status: 'Active', startDate: new Date() })

  // One milestone per task the client wrote when posting the job (skipped if any already exist).
  if (tasks.length && !(await Milestone.exists({ contractId: contract._id }))) {
    await Milestone.insertMany(tasks.map((t, i) => ({
      contractId: contract._id, title: `Milestone ${i + 1}`, taskSpec: t, amount: amounts[i], status: 'Pending', dueDate: null, funded: false,
    })))
  }
  const first = await Milestone.findOne({ contractId: contract._id, funded: false }).sort({ createdAt: 1, _id: 1 })
  await notifications.notify(started.freelancerId, {
    type: 'contract', title: 'Contract started', message: `Your contract for "${job?.title ?? 'a job'}" has started.`,
    relatedEntityId: started._id, relatedEntityType: 'Contract',
  })
  return { ...toContractDTO(started), firstMilestone: first ? toMilestoneDTO(first) : null }
}

async function complete(client, contractId) {
  const { contract } = await loadForParty(contractId, client, 'Client')
  const blocked = rules.complete(contract.status)
  if (blocked) throw new ApiError(400, blocked)
  const done = await moveContract(contract, 'Active', { status: 'Completed', endDate: new Date() })
  await settleJob(done.jobId, 'Completed')
  await notifications.notify(done.freelancerId, {
    type: 'contract', title: 'Contract completed', message: 'Your contract was marked completed. You can now leave a review.',
    relatedEntityId: done._id, relatedEntityType: 'Contract',
  })
  return toContractDTO(done)
}

async function cancel(client, contractId, reason) {
  const { contract } = await loadForParty(contractId, client, 'Client')
  const blocked = rules.cancel(contract.status)
  if (blocked) throw new ApiError(400, blocked)
  const cancelled = await moveContract(contract, contract.status, { status: 'Cancelled', endDate: new Date(), cancellationReason: reason || null })
  await settleJob(cancelled.jobId, 'Closed') // the hire did not work out; the job is closed, not re-opened
  await notifications.notify(cancelled.freelancerId, {
    type: 'contract', title: 'Contract cancelled', message: reason ? `The client cancelled the contract: ${reason}` : 'The client cancelled the contract.',
    relatedEntityId: cancelled._id, relatedEntityType: 'Contract',
  })
  return toContractDTO(cancelled)
}

// The requester's role comes from the authenticated user, never from the body (`requestedByRole` is ignored).
async function requestTermination(viewer, contractId, reason) {
  const { contract, role } = await loadForParty(contractId, viewer)
  const blocked = rules.requestTermination(contract.status, contract.terminationRequestedBy)
  if (blocked) throw new ApiError(400, blocked)
  const updated = await Contract.findOneAndUpdate(
    { _id: contract._id, status: 'Active', terminationRequestedBy: null },
    { $set: { terminationRequestedBy: role, terminationReason: reason || null } },
    { new: true }
  )
  if (!updated) throw new ApiError(409, 'This contract was changed by someone else. Refresh and try again.')
  const other = role === 'Client' ? updated.freelancerId : updated.clientId
  await notifications.notify(other, {
    type: 'contract', title: 'Termination requested', message: `The ${role.toLowerCase()} asked to terminate the contract${reason ? `: ${reason}` : '.'}`,
    relatedEntityId: updated._id, relatedEntityType: 'Contract',
  })
  return toContractDTO(updated)
}

async function respondToTermination(viewer, contractId, approve) {
  const { contract, role } = await loadForParty(contractId, viewer)
  const none = rules.hasPendingRequest(contract.terminationRequestedBy)
  if (none) throw new ApiError(400, none)
  if (contract.status !== 'Active') throw new ApiError(400, 'Only an active contract can be terminated.')
  if (!canRespond(contract.terminationRequestedBy, role, approve)) throw new ApiError(403, 'The other party must approve a termination request.')

  const filter = { _id: contract._id, status: 'Active', terminationRequestedBy: contract.terminationRequestedBy }
  const set = approve
    ? { status: 'Terminated', endDate: new Date() }
    : { terminationRequestedBy: null, terminationReason: null }
  const updated = await Contract.findOneAndUpdate(filter, { $set: set }, { new: true })
  if (!updated) throw new ApiError(409, 'This contract was changed by someone else. Refresh and try again.')
  if (approve) await settleJob(updated.jobId, 'Closed')
  const other = role === 'Client' ? updated.freelancerId : updated.clientId
  await notifications.notify(other, {
    type: 'contract', title: approve ? 'Contract terminated' : 'Termination request declined',
    message: approve ? 'The contract was terminated by mutual agreement.' : 'The termination request was declined or withdrawn.',
    relatedEntityId: updated._id, relatedEntityType: 'Contract',
  })
  return toContractDTO(updated)
}

module.exports = {
  listForClient, listForFreelancer, getDetails, start, complete, cancel, requestTermination, respondToTermination,
  // shared with milestoneService
  loadForParty, partyRole,
  // exported for unit tests
  rules, canRespond, splitBudget,
}
