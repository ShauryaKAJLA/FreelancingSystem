const mongoose = require('mongoose')
const Issue = require('../models/Issue')
const Contract = require('../models/Contract')
const Job = require('../models/Job')
const User = require('../models/User')
const ApiError = require('../utils/ApiError')
const notifications = require('./notificationService')
const adminActions = require('./adminActionService')
const { toIssueDTO, idOf } = require('../utils/dto')
const { optPagination, withPageInfo } = require('../utils/pagination')

const MAX_LIST = 500
const assertId = (id, label) => { if (!mongoose.isValidObjectId(id)) throw new ApiError(400, `Invalid ${label}`) }

// Only a party of the contract can report on it. Strangers get the same 404 as a missing contract (no id probing).
async function raise(user, { contractId, subject }) {
  assertId(contractId, 'contractId')
  const contract = await Contract.findById(contractId)
  const isParty = contract && [contract.clientId, contract.freelancerId].some((id) => idOf(id) === idOf(user))
  if (!isParty) throw new ApiError(404, 'Contract not found')
  // raisedBy is the token's user - never taken from the body.
  const issue = await Issue.create({ contractId: contract._id, raisedBy: user._id, subject })
  await notifications.notifyAdmins({
    type: 'issue', title: 'New issue reported', message: `${user.name} raised a new issue: "${issue.subject}".`,
    relatedEntityId: issue._id, relatedEntityType: 'Issue',
  })
  return toIssueDTO(issue)
}

// Joined fields the admin Reports page reads: jobTitle, raisedByName, clientName, freelancerName, contractStatus.
async function enrich(issues) {
  if (!issues.length) return []
  const contracts = await Contract.find({ _id: { $in: issues.map((i) => i.contractId) } })
  const [jobs, users] = await Promise.all([
    Job.find({ _id: { $in: contracts.map((c) => c.jobId) } }).select('title'),
    User.find({ _id: { $in: [...issues.map((i) => i.raisedBy), ...contracts.flatMap((c) => [c.clientId, c.freelancerId])] } }).select('name'),
  ])
  const contractBy = new Map(contracts.map((c) => [idOf(c), c]))
  const jobBy = new Map(jobs.map((j) => [idOf(j), j.title]))
  const nameBy = new Map(users.map((u) => [idOf(u), u.name]))
  return issues.map((i) => {
    const c = contractBy.get(idOf(i.contractId))
    return {
      ...toIssueDTO(i),
      jobTitle: c ? jobBy.get(idOf(c.jobId)) : undefined,
      raisedByName: nameBy.get(idOf(i.raisedBy)) ?? 'Unknown',
      clientName: c ? nameBy.get(idOf(c.clientId)) ?? 'Unknown' : 'Unknown',
      freelancerName: c ? nameBy.get(idOf(c.freelancerId)) ?? 'Unknown' : 'Unknown',
      contractStatus: c?.status,
    }
  })
}

// Admins see every issue; everyone else only their own.
async function list(viewer, query = {}) {
  const filter = {}
  if (viewer.role !== 'Admin') filter.raisedBy = viewer._id
  if (['Open', 'Resolved'].includes(query.status)) filter.status = query.status
  // Opt-in paging (?page/&limit): skip+limit and a count; without it the legacy 500 cap applies.
  const pg = optPagination(query)
  const q = Issue.find(filter).sort({ createdAt: -1, _id: -1 })
  const issues = await (pg ? q.skip(pg.skip).limit(pg.limit) : q.limit(MAX_LIST))
  const total = pg ? await Issue.countDocuments(filter) : null
  return withPageInfo(await enrich(issues), pg, total)
}

async function resolve(admin, issueId, resolution) {
  assertId(issueId, 'issueId')
  const existing = await Issue.findById(issueId)
  if (!existing) throw new ApiError(404, 'Issue not found')
  if (existing.status === 'Resolved') throw new ApiError(400, 'This issue has already been resolved.')
  // Conditional update: two admins cannot both resolve (and double-notify) the same issue.
  const issue = await Issue.findOneAndUpdate(
    { _id: issueId, status: 'Open' },
    { $set: { status: 'Resolved', resolution: resolution || null, resolvedBy: admin._id, resolvedAt: new Date() } },
    { new: true }
  )
  if (!issue) throw new ApiError(400, 'This issue has already been resolved.')
  await adminActions.log(admin, 'Dispute Resolution', `Resolved reported issue "${issue.subject}" (${idOf(issue)}).`)
  await notifications.notify(issue.raisedBy, {
    type: 'issue', title: 'Issue resolved', message: `Your reported issue "${issue.subject}" was resolved.`,
    relatedEntityId: issue.contractId, relatedEntityType: 'Contract',
  })
  return toIssueDTO(issue)
}

module.exports = { raise, list, resolve, enrich }
