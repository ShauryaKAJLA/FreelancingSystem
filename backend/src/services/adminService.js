const mongoose = require('mongoose')
const User = require('../models/User')
const Job = require('../models/Job')
const Contract = require('../models/Contract')
const Milestone = require('../models/Milestone')
const Payment = require('../models/Payment')
const Review = require('../models/Review')
const AdminAction = require('../models/AdminAction')
const Issue = require('../models/Issue')
const FreelancerProfile = require('../models/FreelancerProfile')
const ApiError = require('../utils/ApiError')
const { escapeRegex } = require('../utils/text')
const { toUserDTO, toJobDTO, toContractDTO, toMilestoneDTO, toPaymentDTO, toReviewDTO, toAdminActionDTO, idOf } = require('../utils/dto')
const { VISIBLE_PAYMENT_STATUSES, ROLES, USER_STATUSES } = require('../models/constants')
const jobService = require('./jobService')
const profileService = require('./profileService')
const paymentService = require('./paymentService')
const reviewService = require('./reviewService')
const adminActions = require('./adminActionService')

const { optPagination, withPageInfo } = require('../utils/pagination')

const MAX_LIST = 500
// Applies ?page/&limit when asked for (skip+limit + a count), else the legacy MAX_LIST cap. Returns { rows, pg, total }.
async function fetchPage(Model, filter, sort, query) {
  const pg = optPagination(query)
  const q = Model.find(filter).sort(sort)
  const rows = await (pg ? q.skip(pg.skip).limit(pg.limit) : q.limit(MAX_LIST))
  const total = pg ? await Model.countDocuments(filter) : null
  return { rows, pg, total }
}
const assertId = (id, label) => { if (!mongoose.isValidObjectId(id)) throw new ApiError(400, `Invalid ${label}`) }
const nameMap = async (ids) => {
  const unique = [...new Set(ids.filter(Boolean).map(String))]
  const users = unique.length ? await User.find({ _id: { $in: unique } }).select('name') : []
  return new Map(users.map((u) => [idOf(u), u.name]))
}

// ── Dashboard (same keys as the mock getAdminDashboard) ─────────────────────────────────────
async function dashboard() {
  const [totalUsers, totalClients, totalFreelancers, flaggedUsers, openJobs, activeContracts, openIssues, paidAgg, awaitingAgg] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ role: 'Client' }),
    User.countDocuments({ role: 'Freelancer' }),
    User.countDocuments({ status: 'Flagged' }),
    Job.countDocuments({ status: 'Published' }),
    Contract.countDocuments({ status: 'Active' }),
    Issue.countDocuments({ status: 'Open' }),
    Payment.aggregate([{ $match: { status: 'Paid' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Payment.aggregate([{ $match: { status: 'Awaiting Payout' } }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
  ])
  return {
    totalUsers, totalClients, totalFreelancers, openJobs, activeContracts, flaggedUsers, openIssues,
    totalPlatformPayments: paidAgg[0]?.total ?? 0,
    awaitingPayoutCount: awaitingAgg[0]?.count ?? 0,
    awaitingPayoutAmount: awaitingAgg[0]?.total ?? 0,
  }
}

// ── Users ───────────────────────────────────────────────────────────────────────────────────
async function listUsers(query = {}) {
  const filter = {}
  if (ROLES.includes(query.role)) filter.role = query.role
  if (USER_STATUSES.includes(query.status)) filter.status = query.status
  if (query.search) {
    const rx = { $regex: escapeRegex(String(query.search).slice(0, 100)), $options: 'i' }
    filter.$or = [{ name: rx }, { email: rx }]
  }
  const { rows: users, pg, total } = await fetchPage(User, filter, { createdAt: 1, _id: 1 }, query)
  return withPageInfo(users.map(toUserDTO), pg, total)
}

// { ...user, profile } where profile = client profile + jobsPosted, or freelancer profile + contracts (with jobTitle).
async function getUser(userId, admin) {
  assertId(userId, 'userId')
  const user = await User.findById(userId)
  if (!user) throw new ApiError(404, 'User not found')
  let profile = null
  if (user.role === 'Client') {
    const [base, jobs] = await Promise.all([profileService.getClientProfile(userId, admin), Job.find({ clientId: user._id }).sort({ createdAt: -1 }).limit(MAX_LIST)])
    profile = { ...base, jobsPosted: jobs.map(toJobDTO) }
  } else if (user.role === 'Freelancer') {
    const [base, contracts] = await Promise.all([profileService.getFreelancerProfile(userId, admin), Contract.find({ freelancerId: user._id }).sort({ createdAt: -1 }).limit(MAX_LIST)])
    const jobs = contracts.length ? await Job.find({ _id: { $in: contracts.map((c) => c.jobId) } }).select('title') : []
    const titleBy = new Map(jobs.map((j) => [idOf(j), j.title]))
    profile = { ...base, contracts: contracts.map((c) => ({ ...toContractDTO(c), jobTitle: titleBy.get(idOf(c.jobId)) })) }
  }
  return { ...toUserDTO(user), profile }
}

// Flag <-> restore. Conditional on the status we read, so a double click cannot flip it back.
async function toggleStatus(admin, userId) {
  assertId(userId, 'userId')
  if (idOf(admin) === String(userId)) throw new ApiError(400, 'You cannot change the status of your own account.')
  const user = await User.findById(userId)
  if (!user) throw new ApiError(404, 'User not found')
  if (user.role === 'Admin') throw new ApiError(400, 'Admin accounts cannot be flagged.')
  const next = user.status === 'Flagged' ? 'Active' : 'Flagged'
  const updated = await User.findOneAndUpdate({ _id: user._id, status: user.status }, { $set: { status: next } }, { new: true })
  if (!updated) throw new ApiError(409, 'This account was changed by someone else. Refresh and try again.')
  await adminActions.log(admin, next === 'Flagged' ? 'Account Flag' : 'Account Restored', `${next === 'Flagged' ? 'Flagged' : 'Restored'} account for ${updated.name} (${idOf(updated)}).`)
  return toUserDTO(updated)
}

// ── Transactions / payments ─────────────────────────────────────────────────────────────────
async function transactions(query = {}) {
  const filter = { status: { $in: VISIBLE_PAYMENT_STATUSES } }
  if (VISIBLE_PAYMENT_STATUSES.includes(query.status)) filter.status = query.status
  const { rows: payments, pg, total } = await fetchPage(Payment, filter, { createdAt: -1, _id: -1 }, query)
  if (!payments.length) return withPageInfo([], pg, total)
  const [milestones, contracts, names] = await Promise.all([
    Milestone.find({ _id: { $in: payments.map((p) => p.milestoneId) } }).select('title'),
    Contract.find({ _id: { $in: payments.map((p) => p.contractId) } }).select('jobId'),
    nameMap(payments.flatMap((p) => [p.clientId, p.freelancerId])),
  ])
  const jobs = await Job.find({ _id: { $in: contracts.map((c) => c.jobId) } }).select('title')
  const msBy = new Map(milestones.map((m) => [idOf(m), m.title]))
  const jobOfContract = new Map(contracts.map((c) => [idOf(c), jobs.find((j) => idOf(j) === idOf(c.jobId))?.title]))
  const rows = payments.map((p) => ({
    ...toPaymentDTO(p),
    milestoneTitle: msBy.get(idOf(p.milestoneId)),
    jobTitle: jobOfContract.get(idOf(p.contractId)),
    clientName: names.get(idOf(p.clientId)) ?? 'Unknown',
    freelancerName: names.get(idOf(p.freelancerId)) ?? 'Unknown',
  }))
  // Payments waiting for a payout first (stable sort keeps newest-first inside each group).
  return withPageInfo(rows.sort((a, b) => (b.paymentStatus === 'Awaiting Payout') - (a.paymentStatus === 'Awaiting Payout')), pg, total)
}

// Payment details + the freelancer's payout account (admins need it to dispatch).
async function paymentDetails(paymentId, admin) {
  const details = await paymentService.getPayment(paymentId, admin)
  const profile = await FreelancerProfile.findOne({ userId: details.contract?.freelancerId }).select('paymentAccount')
  const account = profile?.paymentAccount
  return { ...details, freelancerAccount: account ? (account.toObject ? account.toObject() : { ...account }) : null }
}

// ── Contracts (read-only) ───────────────────────────────────────────────────────────────────
async function listContracts(query = {}) {
  const filter = {}
  if (query.status) filter.status = String(query.status)
  const { rows: contracts, pg, total } = await fetchPage(Contract, filter, { createdAt: -1, _id: -1 }, query)
  if (!contracts.length) return withPageInfo([], pg, total)
  const [jobs, names] = await Promise.all([
    Job.find({ _id: { $in: contracts.map((c) => c.jobId) } }).select('title'),
    nameMap(contracts.flatMap((c) => [c.clientId, c.freelancerId])),
  ])
  const titleBy = new Map(jobs.map((j) => [idOf(j), j.title]))
  return withPageInfo(contracts.map((c) => ({ ...toContractDTO(c), jobTitle: titleBy.get(idOf(c.jobId)), clientName: names.get(idOf(c.clientId)) ?? 'Unknown', freelancerName: names.get(idOf(c.freelancerId)) ?? 'Unknown' })), pg, total)
}

async function contractDetails(contractId) {
  assertId(contractId, 'contractId')
  const contract = await Contract.findById(contractId)
  if (!contract) throw new ApiError(404, 'Contract not found')
  const [job, milestones, reviews, names] = await Promise.all([
    Job.findById(contract.jobId),
    Milestone.find({ contractId: contract._id }).sort({ createdAt: 1, _id: 1 }),
    Review.find({ contractId: contract._id }).sort({ createdAt: 1, _id: 1 }),
    nameMap([contract.clientId, contract.freelancerId]),
  ])
  const payments = milestones.length
    ? await Payment.find({ milestoneId: { $in: milestones.map((m) => m._id) }, status: { $in: VISIBLE_PAYMENT_STATUSES } }).sort({ createdAt: -1 })
    : []
  const payBy = new Map()
  for (const p of payments) if (!payBy.has(idOf(p.milestoneId))) payBy.set(idOf(p.milestoneId), toPaymentDTO(p))
  const reviewNames = await nameMap(reviews.flatMap((r) => [r.reviewerId, r.revieweeId]))
  return {
    ...toContractDTO(contract),
    job: job ? toJobDTO(job) : null,
    clientName: names.get(idOf(contract.clientId)) ?? 'Unknown',
    freelancerName: names.get(idOf(contract.freelancerId)) ?? 'Unknown',
    milestones: milestones.map((m) => ({ ...toMilestoneDTO(m), payment: payBy.get(idOf(m)) ?? null })),
    reviews: reviews.map((r) => ({ ...toReviewDTO(r), status: r.status, reviewerName: reviewNames.get(idOf(r.reviewerId)) ?? 'Unknown', revieweeName: reviewNames.get(idOf(r.revieweeId)) ?? 'Unknown' })),
  }
}

// ── Reviews + moderation ────────────────────────────────────────────────────────────────────
async function listReviews(query = {}) {
  const filter = {}
  if (['Visible', 'Flagged', 'Hidden'].includes(query.status)) filter.status = query.status
  const { rows: reviews, pg, total } = await fetchPage(Review, filter, { createdAt: -1, _id: -1 }, query)
  if (!reviews.length) return withPageInfo([], pg, total)
  const [contracts, names] = await Promise.all([
    Contract.find({ _id: { $in: reviews.map((r) => r.contractId) } }).select('jobId'),
    nameMap(reviews.flatMap((r) => [r.reviewerId, r.revieweeId])),
  ])
  const jobs = await Job.find({ _id: { $in: contracts.map((c) => c.jobId) } }).select('title')
  const titleOfContract = new Map(contracts.map((c) => [idOf(c), jobs.find((j) => idOf(j) === idOf(c.jobId))?.title]))
  return withPageInfo(reviews.map((r) => ({
    ...toReviewDTO(r), status: r.status,
    jobTitle: titleOfContract.get(idOf(r.contractId)),
    reviewerName: names.get(idOf(r.reviewerId)) ?? 'Unknown',
    revieweeName: names.get(idOf(r.revieweeId)) ?? 'Unknown',
  })), pg, total)
}

const MODERATION = { approve: { status: 'Visible', label: 'Approved' }, flag: { status: 'Flagged', label: 'Flagged' }, hide: { status: 'Hidden', label: 'Hid' } }

async function moderateReview(admin, reviewId, action) {
  assertId(reviewId, 'reviewId')
  const m = MODERATION[action]
  if (!m) throw new ApiError(400, 'Unknown moderation action.')
  const review = await Review.findOneAndUpdate({ _id: reviewId }, { $set: { status: m.status } }, { new: true })
  if (!review) throw new ApiError(404, 'Review not found')
  // Hidden reviews are excluded from the public rating, so recompute it for a freelancer reviewee.
  const reviewee = await User.findById(review.revieweeId).select('role')
  if (reviewee?.role === 'Freelancer') await reviewService.recomputeFreelancerRating(review.revieweeId)
  await adminActions.log(admin, 'Review Moderation', `${m.label} review ${idOf(review)} (contract ${idOf(review.contractId)}).`)
  return { ...toReviewDTO(review), status: review.status }
}

// ── Action log / open jobs / profile ────────────────────────────────────────────────────────
// Filters: ?actionType=<exact> and ?search=<substring of the description or type>.
async function actionsLog(query = {}) {
  const filter = {}
  if (query.actionType) filter.actionType = String(query.actionType).slice(0, 60)
  if (query.search) {
    const rx = { $regex: escapeRegex(String(query.search).slice(0, 100)), $options: 'i' }
    filter.$or = [{ actionDescription: rx }, { actionType: rx }]
  }
  const { rows: actions, pg, total } = await fetchPage(AdminAction, filter, { createdAt: -1, _id: -1 }, query)
  const names = await nameMap(actions.map((a) => a.adminId))
  return withPageInfo(actions.map((a) => ({ ...toAdminActionDTO(a), adminName: names.get(idOf(a.adminId)) ?? 'Unknown' })), pg, total)
}

// Admin open-jobs list: same filters as freelancer browse (search, category, experienceLevel, budget range, sortBy) + opt-in paging.
function openJobs(query = {}) {
  const f = {}
  if (query.search) f.search = String(query.search).slice(0, 100)
  if (query.category) f.category = String(query.category).slice(0, 60)
  if (query.experienceLevel) f.experienceLevel = String(query.experienceLevel).slice(0, 30)
  if (query.sortBy) f.sortBy = String(query.sortBy)
  for (const k of ['budgetMin', 'budgetMax']) {
    if (query[k] !== undefined && query[k] !== '' && Number.isFinite(Number(query[k]))) f[k] = Number(query[k])
  }
  return jobService.listOpen(f, optPagination(query))
}

async function getProfile(adminId, admin) {
  assertId(adminId, 'adminId')
  if (idOf(admin) !== String(adminId)) throw new ApiError(403, 'You can only view your own admin profile')
  return toUserDTO(admin)
}

async function editProfile(adminId, admin, { name, email }) {
  assertId(adminId, 'adminId')
  if (idOf(admin) !== String(adminId)) throw new ApiError(403, 'You can only edit your own admin profile')
  const set = {}
  if (name !== undefined) set.name = name
  if (email !== undefined) set.email = email.toLowerCase()
  try {
    const updated = await User.findOneAndUpdate({ _id: admin._id }, { $set: set }, { new: true, runValidators: true })
    return toUserDTO(updated)
  } catch (err) {
    if (err?.code === 11000) throw new ApiError(409, 'An account with this email already exists.')
    throw err
  }
}

module.exports = { dashboard, listUsers, getUser, toggleStatus, transactions, paymentDetails, listContracts, contractDetails, listReviews, moderateReview, actionsLog, openJobs, getProfile, editProfile, MODERATION }
