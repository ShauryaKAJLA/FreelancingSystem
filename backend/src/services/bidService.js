const mongoose = require('mongoose')
const Bid = require('../models/Bid')
const Job = require('../models/Job')
const Contract = require('../models/Contract')
const User = require('../models/User')
const FreelancerProfile = require('../models/FreelancerProfile')
const ApiError = require('../utils/ApiError')
const notifications = require('./notificationService')
const { toBidDTO, toContractDTO, idOf } = require('../utils/dto')
const { OPEN_BID_STATUSES, BID_STATUSES } = require('../models/constants')
const { withPageInfo, findPaged } = require('../utils/pagination')

const assertId = (id, label) => {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, `Invalid ${label}`)
}
const isDuplicateKey = (err) => err && (err.code === 11000 || err.code === 11001)

// ── Pure rules (unit-tested without a database). Messages are the frontend mock's exact strings. ──
const rules = {
  submit: (jobStatus) => (jobStatus === 'Published' ? null : 'This job is no longer open for bidding.'),
  edit: (bidStatus) => (bidStatus === 'Pending' ? null : 'Only a pending proposal can be edited.'),
  withdraw: (bidStatus) => (['Accepted', 'Rejected', 'Withdrawn'].includes(bidStatus) ? `A ${bidStatus.toLowerCase()} proposal cannot be withdrawn.` : null),
  // Job is checked first, then the bid - same order as the mock.
  accept: (jobStatus, bidStatus) => {
    if (jobStatus !== 'Published') return 'This job is no longer open for hiring.'
    if (!OPEN_BID_STATUSES.includes(bidStatus)) return `This proposal is ${bidStatus.toLowerCase()} and can no longer be accepted.`
    return null
  },
}

// Amount/proposal validation lives here (not only in the validator) so the service is safe on its own.
const cleanAmount = (v) => (typeof v === 'boolean' || v === '' || v === null ? NaN : Number(v))

// ── Lookups shared with jobService / contractService ───────────────────────────────────────
// { freelancerId -> { name, rating, hourlyRate } }
async function freelancerInfo(ids) {
  const unique = [...new Set(ids.map(String))]
  if (!unique.length) return new Map()
  const [users, profiles] = await Promise.all([
    User.find({ _id: { $in: unique } }).select('name'),
    FreelancerProfile.find({ userId: { $in: unique } }).select('userId rating hourlyRate'),
  ])
  const map = new Map(users.map((u) => [String(u._id), { name: u.name, rating: undefined, hourlyRate: undefined }]))
  for (const p of profiles) {
    const row = map.get(String(p.userId)) ?? { name: 'Unknown' }
    map.set(String(p.userId), { ...row, rating: p.rating, hourlyRate: p.hourlyRate })
  }
  return map
}

// listForClient placeholders: bidCount (all bids, like the mock), pendingBidCount + pendingBids (Pending|Updated).
async function statsForJobs(jobIds) {
  const out = new Map(jobIds.map((id) => [String(id), { bidCount: 0, pendingBidCount: 0, pendingBids: [] }]))
  if (!jobIds.length) return out
  const bids = await Bid.find({ jobId: { $in: jobIds } }).sort({ bidDate: -1, _id: -1 })
  const info = await freelancerInfo(bids.filter((b) => OPEN_BID_STATUSES.includes(b.status)).map((b) => b.freelancerId))
  for (const b of bids) {
    const row = out.get(String(b.jobId))
    if (!row) continue
    row.bidCount += 1
    if (OPEN_BID_STATUSES.includes(b.status)) {
      const f = info.get(String(b.freelancerId))
      row.pendingBidCount += 1
      row.pendingBids.push({ ...toBidDTO(b), freelancerName: f?.name ?? 'Unknown', freelancerRating: f?.rating })
    }
  }
  return out
}

// Ids (from `jobIds`) that have at least one open (Pending|Updated) bid. Backs the client jobs `?pendingBids=true` filter.
async function jobIdsWithOpenBids(jobIds) {
  if (!jobIds.length) return []
  return Bid.distinct('jobId', { jobId: { $in: jobIds }, status: { $in: OPEN_BID_STATUSES } })
}

// getForClient placeholder: every bid on the job with freelancer name/rating/rate.
async function listForJob(jobId) {
  const bids = await Bid.find({ jobId }).sort({ bidDate: -1, _id: -1 })
  const info = await freelancerInfo(bids.map((b) => b.freelancerId))
  return bids.map((b) => {
    const f = info.get(String(b.freelancerId))
    return { ...toBidDTO(b), freelancerName: f?.name ?? 'Unknown', freelancerRating: f?.rating, freelancerRate: f?.hourlyRate }
  })
}

// listOpen placeholder: real bidCount per job.
async function countsForJobs(jobIds) {
  const map = new Map(jobIds.map((id) => [String(id), 0]))
  if (!jobIds.length) return map
  const rows = await Bid.aggregate([
    { $match: { jobId: { $in: jobIds.map((id) => new mongoose.Types.ObjectId(String(id))) } } },
    { $group: { _id: '$jobId', n: { $sum: 1 } } },
  ])
  for (const r of rows) map.set(String(r._id), r.n)
  return map
}

// getForFreelancer placeholder: this freelancer's non-withdrawn bid, else null.
async function myBid(jobId, freelancerId) {
  const bid = await Bid.findOne({ jobId, freelancerId, status: { $ne: 'Withdrawn' } })
  return bid ? toBidDTO(bid) : null
}

// jobService.cancel hook: a cancelled job rejects its Pending/Updated bids.
async function rejectAllForJob(jobId) {
  const r = await Bid.updateMany({ jobId, status: { $in: OPEN_BID_STATUSES } }, { $set: { status: 'Rejected' } })
  return { rejected: r.modifiedCount ?? 0 }
}

// ── Freelancer operations ──────────────────────────────────────────────────────────────────
async function submit(freelancer, jobId, { bidAmount, proposal }) {
  assertId(jobId, 'jobId')
  const amount = cleanAmount(bidAmount)
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1e9) throw new ApiError(400, 'Enter a valid bid amount.')
  if (typeof proposal !== 'string' || !proposal.trim()) throw new ApiError(400, 'Write a proposal before submitting.')

  const job = await Job.findById(jobId)
  // Drafts are private: same 404 as a missing job.
  if (!job || job.status === 'Draft') throw new ApiError(404, 'Job not found')
  const blocked = rules.submit(job.status)
  if (blocked) throw new ApiError(400, blocked)
  if (idOf(job.clientId) === idOf(freelancer)) throw new ApiError(400, 'You cannot bid on your own job.')

  if (await Bid.exists({ jobId, freelancerId: freelancer._id, status: { $ne: 'Withdrawn' } })) {
    throw new ApiError(409, 'You have already submitted a bid on this job.')
  }
  let bid
  try {
    bid = await Bid.create({ jobId, freelancerId: freelancer._id, bidAmount: amount, proposal: proposal.trim(), status: 'Pending', bidDate: new Date() })
  } catch (err) {
    // Two simultaneous submissions: the partial unique index lets exactly one through.
    if (isDuplicateKey(err)) throw new ApiError(409, 'You have already submitted a bid on this job.')
    throw err
  }
  await notifications.notify(job.clientId, {
    type: 'bid', title: 'New proposal', message: `${freelancer.name ?? 'A freelancer'} bid ₹${amount} on "${job.title}".`,
    relatedEntityId: job._id, relatedEntityType: 'Job',
  })
  return toBidDTO(bid)
}

// Loads a bid and requires the caller to own it. A stranger's bid behaves like a missing one.
async function loadOwnBid(bidId, freelancer) {
  assertId(bidId, 'bidId')
  const bid = await Bid.findById(bidId)
  if (!bid || idOf(bid.freelancerId) !== idOf(freelancer)) throw new ApiError(404, 'Bid not found')
  return bid
}

async function edit(freelancer, bidId, { bidAmount, proposal }) {
  const amount = cleanAmount(bidAmount)
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1e9) throw new ApiError(400, 'Enter a valid bid amount.')
  if (typeof proposal !== 'string' || !proposal.trim()) throw new ApiError(400, 'Write a proposal before submitting.')
  const bid = await loadOwnBid(bidId, freelancer)
  const blocked = rules.edit(bid.status)
  if (blocked) throw new ApiError(400, blocked)
  const updated = await Bid.findOneAndUpdate(
    { _id: bid._id, status: 'Pending' },
    { $set: { bidAmount: amount, proposal: proposal.trim(), status: 'Updated', bidDate: new Date() } },
    { new: true }
  )
  if (!updated) throw new ApiError(409, 'This proposal was changed by someone else. Refresh and try again.')
  return toBidDTO(updated)
}

async function withdraw(freelancer, bidId) {
  const bid = await loadOwnBid(bidId, freelancer)
  const blocked = rules.withdraw(bid.status)
  if (blocked) throw new ApiError(400, blocked)
  const updated = await Bid.findOneAndUpdate(
    { _id: bid._id, status: { $in: OPEN_BID_STATUSES } },
    { $set: { status: 'Withdrawn', isActive: false } },
    { new: true }
  )
  if (!updated) throw new ApiError(409, 'This proposal was changed by someone else. Refresh and try again.')
  return toBidDTO(updated)
}

// Opt-in ?page&limit (+ ?status=<bid status>); without them the full list (unchanged behaviour).
async function listForFreelancer(freelancerId, query = {}) {
  assertId(freelancerId, 'freelancerId')
  const filter = { freelancerId }
  if (BID_STATUSES.includes(query?.status)) filter.status = query.status
  const { rows: bids, pg, total } = await findPaged(Bid, filter, { bidDate: -1, _id: -1 }, query, 0 /* 0 = unbounded, as before */)
  const jobIds = [...new Set(bids.map((b) => String(b.jobId)))]
  const [jobs, contracts] = await Promise.all([
    jobIds.length ? Job.find({ _id: { $in: jobIds } }).select('title budget') : [],
    jobIds.length ? Contract.find({ jobId: { $in: jobIds }, freelancerId }) : [],
  ])
  const jobBy = new Map(jobs.map((j) => [String(j._id), j]))
  const contractBy = new Map(contracts.map((c) => [String(c.jobId), c]))
  return withPageInfo(bids.map((b) => {
    const job = jobBy.get(String(b.jobId))
    const c = contractBy.get(String(b.jobId))
    return {
      ...toBidDTO(b),
      jobTitle: job?.title,
      jobBudget: job?.budget,
      contractId: c ? idOf(c) : undefined,
      contractStatus: c?.status,
      terminationRequestedBy: c?.terminationRequestedBy ?? undefined,
    }
  }), pg, total)
}

// ── Client: hire ───────────────────────────────────────────────────────────────────────────
// Atomic WITHOUT a transaction (standalone Mongo dev servers don't support them): ordered conditional
// updates, each guarded by the expected status, with compensation if a later step fails.
//   1. job Published -> In Progress   (the "lock": only one accept can win)
//   2. bid Pending|Updated -> Accepted
//   3. create the Pending Start contract          (steps 1-2 are undone if this fails)
//   4. reject every other non-withdrawn bid       (idempotent; a failure here leaves harmless stale bids)
async function accept(client, jobId, bidId) {
  assertId(jobId, 'jobId')
  assertId(bidId, 'bidId')
  const [job, bid] = await Promise.all([Job.findById(jobId), Bid.findById(bidId)])
  if (!job || !bid || idOf(bid.jobId) !== idOf(job)) throw new ApiError(404, 'Job or bid not found')
  // Only the job's owner may hire. Anyone else is told the job doesn't exist.
  if (idOf(job.clientId) !== idOf(client)) throw new ApiError(404, 'Job or bid not found')
  const blocked = rules.accept(job.status, bid.status)
  if (blocked) throw new ApiError(400, blocked)

  const lockedJob = await Job.findOneAndUpdate({ _id: job._id, status: 'Published' }, { $set: { status: 'In Progress' } }, { new: true })
  if (!lockedJob) throw new ApiError(400, rules.accept('In Progress', bid.status))

  const acceptedBid = await Bid.findOneAndUpdate({ _id: bid._id, status: { $in: OPEN_BID_STATUSES } }, { $set: { status: 'Accepted' } }, { new: true })
  if (!acceptedBid) {
    await Job.updateOne({ _id: job._id, status: 'In Progress' }, { $set: { status: 'Published' } })
    throw new ApiError(400, 'This proposal is no longer pending and can no longer be accepted.')
  }

  let contract
  try {
    contract = await Contract.create({
      jobId: job._id, clientId: job.clientId, freelancerId: bid.freelancerId, status: 'Pending Start', startDate: null, endDate: null,
    })
  } catch (err) {
    await Bid.updateOne({ _id: bid._id, status: 'Accepted' }, { $set: { status: bid.status } })
    await Job.updateOne({ _id: job._id, status: 'In Progress' }, { $set: { status: 'Published' } })
    if (isDuplicateKey(err)) throw new ApiError(409, 'A contract already exists for this freelancer and job.')
    throw err
  }

  await Bid.updateMany({ jobId: job._id, _id: { $ne: bid._id }, status: { $ne: 'Withdrawn' } }, { $set: { status: 'Rejected' } })

  await notifications.notify(bid.freelancerId, {
    type: 'bid', title: 'Proposal accepted', message: `Your proposal for "${job.title}" was accepted. The client will start the contract soon.`,
    relatedEntityId: contract._id, relatedEntityType: 'Contract',
  })
  return toContractDTO(contract)
}

module.exports = {
  submit, edit, withdraw, listForFreelancer, accept,
  // used by jobService / contractService
  statsForJobs, jobIdsWithOpenBids, listForJob, countsForJobs, myBid, rejectAllForJob, freelancerInfo,
  // exported for unit tests
  rules,
}
