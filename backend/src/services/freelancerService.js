const mongoose = require('mongoose')
const FreelancerProfile = require('../models/FreelancerProfile')
const Contract = require('../models/Contract')
const { idOf } = require('../utils/dto')
const { escapeRegex } = require('../utils/text')
const { withPageInfo } = require('../utils/pagination')

const MAX_LIST = 200
const SORTS = {
  ratingHigh: { rating: -1, 'user.name': 1 },
  rateLow: { hourlyRate: 1, 'user.name': 1 },
  rateHigh: { hourlyRate: -1, 'user.name': 1 },
}

// Pure: turns validated filters into the two $match stages + sort. Unit-tested without a database.
function buildDiscoveryQuery(f = {}) {
  const profileMatch = {}
  if (f.minRating !== undefined) profileMatch.rating = { $gte: f.minRating }
  if (f.minRate !== undefined || f.maxRate !== undefined) {
    profileMatch.hourlyRate = {}
    if (f.minRate !== undefined) profileMatch.hourlyRate.$gte = f.minRate
    if (f.maxRate !== undefined) profileMatch.hourlyRate.$lte = f.maxRate
  }
  if (f.skillId) profileMatch.skillIds = new mongoose.Types.ObjectId(f.skillId)

  // Flagged (and non-freelancer) accounts never appear in discovery.
  const userMatch = { 'user.status': 'Active', 'user.role': 'Freelancer' }
  if (f.search) {
    const rx = { $regex: escapeRegex(f.search), $options: 'i' }
    userMatch.$or = [{ 'user.name': rx }, { bio: rx }]
  }
  return { profileMatch, userMatch, sort: SORTS[f.sortBy] ?? SORTS.ratingHigh }
}

// `pg` (optional, from optPagination): skip/limit + total via $facet instead of the legacy 200-row cap.
// `_id` is the final sort tiebreaker so pages never overlap when ratings/rates tie.
async function search(filters, pg = null) {
  const { profileMatch, userMatch, sort } = buildDiscoveryQuery(filters)
  const head = [
    { $match: profileMatch },
    { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
    { $unwind: '$user' },
    { $match: userMatch },
  ]
  const tail = [
    { $lookup: { from: 'skills', localField: 'skillIds', foreignField: '_id', as: 'skillDocs' } },
    { $project: { userId: 1, hourlyRate: 1, bio: 1, rating: 1, 'user.name': 1, 'user.status': 1, 'skillDocs.name': 1 } },
  ]
  const sorted = { $sort: { ...sort, _id: 1 } }
  let rows, total = null
  if (pg) {
    const [res] = await FreelancerProfile.aggregate([
      ...head,
      { $facet: { rows: [sorted, { $skip: pg.skip }, { $limit: pg.limit }, ...tail], count: [{ $count: 'n' }] } },
    ])
    rows = res?.rows ?? []
    total = res?.count?.[0]?.n ?? 0
  } else {
    rows = await FreelancerProfile.aggregate([...head, sorted, { $limit: MAX_LIST }, ...tail])
  }

  const done = await Contract.aggregate([
    { $match: { freelancerId: { $in: rows.map((r) => r.userId) }, status: 'Completed' } },
    { $group: { _id: '$freelancerId', n: { $sum: 1 } } },
  ])
  const doneBy = new Map(done.map((d) => [String(d._id), d.n]))

  return withPageInfo(rows.map((r) => ({
    freelancerId: idOf(r.userId),
    fullName: r.user.name,
    name: r.user.name,
    hourlyRate: r.hourlyRate ?? 0,
    bio: r.bio ?? '',
    rating: r.rating ?? 0,
    skills: (r.skillDocs ?? []).map((s) => s.name),
    status: r.user.status,
    completedContracts: doneBy.get(String(r.userId)) ?? 0,
  })), pg, total)
}

module.exports = { search, buildDiscoveryQuery }
