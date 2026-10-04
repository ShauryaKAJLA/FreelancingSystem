const mongoose = require('mongoose')
const Job = require('../models/Job')
const User = require('../models/User')
const ClientProfile = require('../models/ClientProfile')
const ApiError = require('../utils/ApiError')
const { toJobDTO, idOf } = require('../utils/dto')
const { escapeRegex } = require('../utils/text')
const { withPageInfo, findPaged } = require('../utils/pagination')
const skills = require('./skillService')
const bids = require('./bidService')
const { EDITABLE_JOB_STATUSES, JOB_STATUSES } = require('../models/constants')

const MAX_LIST = 200
const assertId = (id, label = 'jobId') => {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, `Invalid ${label}`)
}
const isOwner = (job, viewer) => idOf(job.clientId) === idOf(viewer)

// ── Pure helpers (unit-tested without a database) ───────────────────────────────────────────
// Lifecycle rules, with the exact error strings the frontend mock produced.
const rules = {
  edit: (status) => (EDITABLE_JOB_STATUSES.includes(status) ? null : `A job that is ${status.toLowerCase()} can no longer be edited.`),
  publish: (status) => (status === 'Draft' ? null : 'Only a draft job can be published.'),
  remove: (status) => (status === 'Draft' ? null : 'Only a draft job with no bids can be deleted — cancel a published job instead.'),
  cancel: (status) => (status === 'Published' ? null : 'Only a published job (not yet in progress) can be cancelled.'),
}

const OPEN_SORTS = {
  newest: { createdAt: -1, _id: -1 },
  oldest: { createdAt: 1, _id: 1 },
  budgetHigh: { budget: -1, _id: -1 },
  budgetLow: { budget: 1, _id: 1 },
}

// filters come from validateOpenJobsQuery (already coerced). Returns { filter, sort }.
function buildOpenJobsQuery(f = {}) {
  const filter = { status: 'Published' }
  if (f.search) filter.title = { $regex: escapeRegex(f.search), $options: 'i' }
  if (f.skillId) filter.requiredSkillIds = new mongoose.Types.ObjectId(f.skillId)
  if (f.category) filter.category = f.category
  if (f.experienceLevel) filter.experienceLevel = f.experienceLevel
  if (f.budgetMin !== undefined || f.budgetMax !== undefined) {
    filter.budget = {}
    if (f.budgetMin !== undefined) filter.budget.$gte = f.budgetMin
    if (f.budgetMax !== undefined) filter.budget.$lte = f.budgetMax
  }
  return { filter, sort: OPEN_SORTS[f.sortBy] ?? OPEN_SORTS.newest }
}

// ── Data access ─────────────────────────────────────────────────────────────────────────────
// Company name if the client set one, otherwise their account name (same fallback as the mock).
async function clientNames(clientIds) {
  const ids = [...new Set(clientIds.map(String))]
  const [users, profiles] = await Promise.all([
    User.find({ _id: { $in: ids } }).select('name'),
    ClientProfile.find({ userId: { $in: ids } }).select('userId companyName'),
  ])
  const map = new Map(users.map((u) => [String(u._id), u.name]))
  for (const p of profiles) if (p.companyName) map.set(String(p.userId), p.companyName)
  return map
}

async function loadJob(jobId) {
  assertId(jobId)
  const job = await Job.findById(jobId)
  if (!job) throw new ApiError(404, 'Job not found')
  return job
}

function assertCanMutate(job, viewer) {
  if (viewer.role !== 'Admin' && !isOwner(job, viewer)) throw new ApiError(403, 'You can only modify your own jobs')
}

// ── Client side ─────────────────────────────────────────────────────────────────────────────
// Opt-in ?page&limit (+ ?status=<job status>, ?pendingBids=true = only jobs with a Pending/Updated bid);
// without paging the legacy 200-row array is returned. The owner id is always part of the filter.
async function listForClient(clientId, query = {}) {
  assertId(clientId, 'clientId')
  const filter = { clientId }
  if (JOB_STATUSES.includes(query.status)) filter.status = query.status
  if (query.pendingBids === 'true' || query.pendingBids === true) {
    const ownIds = await Job.distinct('_id', { ...filter })
    filter._id = { $in: await bids.jobIdsWithOpenBids(ownIds) }
  }
  const { rows: jobs, pg, total } = await findPaged(Job, filter, { createdAt: -1, _id: -1 }, query, MAX_LIST)
  const stats = await bids.statsForJobs(jobs.map((j) => j._id))
  return withPageInfo(jobs.map((j) => ({ ...toJobDTO(j), ...(stats.get(String(j._id)) ?? { bidCount: 0, pendingBidCount: 0, pendingBids: [] }) })), pg, total)
}

async function getForClient(jobId, viewer) {
  const job = await loadJob(jobId)
  // A draft is private to its owner (and admins); other roles get the same 404 as a missing job.
  const allowed = viewer.role === 'Admin' || isOwner(job, viewer) || (viewer.role === 'Freelancer' && job.status !== 'Draft')
  if (!allowed) throw new ApiError(404, 'Job not found')
  return { ...toJobDTO(job), bids: await bids.listForJob(job._id) }
}

async function create(client, body) {
  await skills.assertAllExist(body.requiredSkillIds)
  const job = await Job.create({ ...body, clientId: client._id })
  return toJobDTO(job)
}

async function edit(jobId, updates, viewer) {
  const job = await loadJob(jobId)
  assertCanMutate(job, viewer)
  const blocked = rules.edit(job.status)
  if (blocked) throw new ApiError(400, blocked)
  await skills.assertAllExist(updates.requiredSkillIds)
  job.set(updates)
  await job.save()
  return toJobDTO(job)
}

// Status transitions use a conditional update so two concurrent requests can't both succeed.
async function transition(jobId, viewer, rule, from, set) {
  const job = await loadJob(jobId)
  assertCanMutate(job, viewer)
  const blocked = rule(job.status)
  if (blocked) throw new ApiError(400, blocked)
  const updated = await Job.findOneAndUpdate({ _id: job._id, status: from }, { $set: set }, { new: true })
  if (!updated) throw new ApiError(409, 'This job was changed by someone else. Refresh and try again.')
  return updated
}

async function publish(jobId, viewer) {
  return toJobDTO(await transition(jobId, viewer, rules.publish, 'Draft', { status: 'Published' }))
}

async function cancel(jobId, reason, viewer) {
  const job = await transition(jobId, viewer, rules.cancel, 'Published', { status: 'Cancelled', cancellationReason: reason || null })
  // A cancelled job can no longer be hired for: its Pending/Updated proposals are rejected (same as the mock).
  await bids.rejectAllForJob(job._id)
  return toJobDTO(job)
}

async function remove(jobId, viewer) {
  const job = await loadJob(jobId)
  assertCanMutate(job, viewer)
  const blocked = rules.remove(job.status)
  if (blocked) throw new ApiError(400, blocked)
  const res = await Job.deleteOne({ _id: job._id, status: 'Draft' })
  if (res.deletedCount !== 1) throw new ApiError(409, 'This job was changed by someone else. Refresh and try again.')
  return { jobId: String(job._id) }
}

// ── Freelancer side ─────────────────────────────────────────────────────────────────────────
// `pg` (optional, from optPagination) switches the legacy 500-row cap for skip/limit + a count (admin lists).
async function listOpen(filters, pg = null) {
  const { filter, sort } = buildOpenJobsQuery(filters)
  const q = Job.find(filter).sort(sort)
  const jobs = await (pg ? q.skip(pg.skip).limit(pg.limit) : q.limit(MAX_LIST))
  const total = pg ? await Job.countDocuments(filter) : null
  const names = await clientNames(jobs.map((j) => j.clientId))
  const counts = await bids.countsForJobs(jobs.map((j) => j._id))
  return withPageInfo(
    jobs.map((j) => ({ ...toJobDTO(j), clientName: names.get(String(j.clientId)) ?? 'Unknown', bidCount: counts.get(String(j._id)) ?? 0 })),
    pg,
    total
  )
}

async function getForFreelancer(jobId, viewer) {
  const job = await loadJob(jobId)
  if (job.status === 'Draft') throw new ApiError(404, 'Job not found')
  const names = await clientNames([job.clientId])
  // myBid = the caller's own non-withdrawn bid (admins have none). The path's :freelancerId is checked against the token upstream.
  const myBid = viewer?.role === 'Freelancer' ? await bids.myBid(job._id, viewer._id) : null
  return { ...toJobDTO(job), clientName: names.get(String(job.clientId)) ?? 'Unknown', myBid }
}

module.exports = {
  listForClient, getForClient, create, edit, publish, cancel, remove, listOpen, getForFreelancer,
  // exported for unit tests
  rules, buildOpenJobsQuery,
}
