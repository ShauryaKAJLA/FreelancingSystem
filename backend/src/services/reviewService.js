const mongoose = require('mongoose')
const Review = require('../models/Review')
const Contract = require('../models/Contract')
const User = require('../models/User')
const FreelancerProfile = require('../models/FreelancerProfile')
const ApiError = require('../utils/ApiError')
const notifications = require('./notificationService')
const { parsePagination, pageMeta } = require('../utils/pagination')
const { toReviewDTO } = require('../utils/dto')

const sid = (v) => String(v?._id ?? v)
const assertId = (id, label) => {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, `Invalid ${label}`)
}

// Keeps FreelancerProfile.rating in sync (server-controlled field). Hidden reviews don't count.
async function recomputeFreelancerRating(userId) {
  const [agg] = await Review.aggregate([
    { $match: { revieweeId: new mongoose.Types.ObjectId(String(userId)), status: { $ne: 'Hidden' } } },
    { $group: { _id: null, avg: { $avg: '$rating' } } },
  ])
  const rating = agg ? Math.round(agg.avg * 10) / 10 : 0
  await FreelancerProfile.updateOne({ userId }, { $set: { rating } })
  return rating
}

async function submit(reviewer, contractId, { rating, comment }) {
  assertId(contractId, 'contractId')
  const contract = await Contract.findById(contractId)
  const isClient = contract && sid(contract.clientId) === sid(reviewer._id)
  const isFreelancer = contract && sid(contract.freelancerId) === sid(reviewer._id)
  // Non-participants get the same 404 as a missing contract.
  if (!isClient && !isFreelancer) throw new ApiError(404, 'Contract not found')
  if (contract.status !== 'Completed') throw new ApiError(409, 'Reviews can only be submitted after the contract is completed')

  // The reviewee is derived from the contract -- the caller can't choose who they're reviewing.
  const revieweeId = isClient ? contract.freelancerId : contract.clientId

  let review
  try {
    review = await Review.create({ contractId: contract._id, reviewerId: reviewer._id, revieweeId, rating, comment: comment || '' })
  } catch (err) {
    if (err.code === 11000) throw new ApiError(409, 'You have already reviewed this contract')
    throw err
  }

  const reviewee = await User.findById(revieweeId).select('role')
  if (reviewee?.role === 'Freelancer') await recomputeFreelancerRating(revieweeId)
  await notifications.notify(revieweeId, {
    type: 'review', title: 'New review', message: `${reviewer.name} left you a ${rating}-star review.`, relatedEntityId: contract._id, relatedEntityType: 'Contract',
  })
  // Frontend shape: { reviewId, contractId, reviewerId, revieweeId, rating, comment, reviewDate }
  return toReviewDTO(review)
}

async function listForUser(userId, viewer, query) {
  assertId(userId, 'userId')
  const p = parsePagination(query, { defaultLimit: 10 })
  const filter = { revieweeId: userId }
  if (viewer.role !== 'Admin') filter.status = { $ne: 'Hidden' }
  const publicFilter = { revieweeId: new mongoose.Types.ObjectId(String(userId)), status: { $ne: 'Hidden' } }

  const [items, total, [summary]] = await Promise.all([
    Review.find(filter).sort({ createdAt: -1, _id: -1 }).skip(p.skip).limit(p.limit).populate('reviewerId', 'name role'),
    Review.countDocuments(filter),
    Review.aggregate([{ $match: publicFilter }, { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }]),
  ])
  return {
    items: items.map((r) => ({
      id: r._id,
      reviewId: r._id,
      contractId: r.contractId,
      reviewerId: sid(r.reviewerId),
      reviewerName: r.reviewerId?.name,
      revieweeId: r.revieweeId,
      rating: r.rating,
      comment: r.comment,
      // Moderation state is only exposed to admins.
      ...(viewer.role === 'Admin' && { status: r.status }),
      createdAt: r.createdAt,
      reviewDate: r.createdAt,
    })),
    summary: { averageRating: summary ? Math.round(summary.avg * 10) / 10 : 0, reviewCount: summary?.count ?? 0 },
    pagination: pageMeta(p, total),
  }
}

module.exports = { submit, listForUser, recomputeFreelancerRating }
