const mongoose = require('mongoose')
const User = require('../models/User')
const ClientProfile = require('../models/ClientProfile')
const FreelancerProfile = require('../models/FreelancerProfile')
const Review = require('../models/Review')
const Payment = require('../models/Payment')
const ApiError = require('../utils/ApiError')
const { idOf, iso, toClientProfileDTO, toFreelancerProfileDTO } = require('../utils/dto')
const { FUNDED_PAYMENT_STATUSES } = require('../models/constants')
const skillSvc = require('./skillService')

const assertId = (id, label) => {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, `Invalid ${label}`)
}
const isOwnerOrAdmin = (user, viewer) => viewer.role === 'Admin' || idOf(viewer) === idOf(user)

async function loadUser(id, role, viewer) {
  const user = await User.findById(id)
  // Same 404 for "no such user" and "wrong role" so ids can't be probed for role information.
  // Flagged accounts are hidden from everyone except admins.
  if (!user || user.role !== role || (user.status !== 'Active' && viewer.role !== 'Admin')) throw new ApiError(404, `${role} not found`)
  return user
}

// Client "total spend" = money the client has actually put in (funded milestones).
async function totalSpendFor(clientId) {
  const [agg] = await Payment.aggregate([
    { $match: { clientId: new mongoose.Types.ObjectId(String(clientId)), status: { $in: FUNDED_PAYMENT_STATUSES } } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ])
  return agg?.total ?? 0
}

// ── Freelancer ──────────────────────────────────────────────────────────────────────────────
async function buildFreelancerDTO(user, viewer) {
  const [profile, reviews] = await Promise.all([
    FreelancerProfile.findOne({ userId: user._id }).populate('skillIds', 'name'),
    Review.find({ revieweeId: user._id, status: { $ne: 'Hidden' } }).sort({ createdAt: -1, _id: -1 }).limit(50).populate('reviewerId', 'name'),
  ])
  if (!profile) throw new ApiError(404, 'Freelancer profile not found')
  return toFreelancerProfileDTO(user, profile, {
    isOwnerOrAdmin: isOwnerOrAdmin(user, viewer),
    // Proficiency isn't captured by the profile form yet (the mock also defaults to Intermediate).
    skills: (profile.skillIds ?? []).map((s) => ({ skillId: idOf(s), skillName: s.name, proficiencyLevel: 'Intermediate' })),
    reviews: reviews.map((r) => ({
      reviewId: idOf(r), contractId: idOf(r.contractId), reviewerId: idOf(r.reviewerId), revieweeId: idOf(r.revieweeId),
      rating: r.rating, comment: r.comment, reviewDate: iso(r.createdAt), reviewerName: r.reviewerId?.name ?? 'Unknown',
    })),
  })
}

async function getFreelancerProfile(freelancerId, viewer) {
  assertId(freelancerId, 'freelancerId')
  return buildFreelancerDTO(await loadUser(freelancerId, 'Freelancer', viewer), viewer)
}

async function updateFreelancerProfile(freelancerId, updates, viewer) {
  assertId(freelancerId, 'freelancerId')
  const user = await loadUser(freelancerId, 'Freelancer', viewer)
  await skillSvc.assertAllExist(updates.skillIds)
  await FreelancerProfile.findOneAndUpdate(
    { userId: user._id }, { $set: updates }, { new: true, runValidators: true, upsert: true, setDefaultsOnInsert: true }
  )
  return buildFreelancerDTO(user, viewer)
}

// Payout account + past projects: each provided key REPLACES the stored value (same as the mock).
async function updateFreelancerExtras(freelancerId, updates, viewer) {
  assertId(freelancerId, 'freelancerId')
  const user = await loadUser(freelancerId, 'Freelancer', viewer)
  await FreelancerProfile.findOneAndUpdate(
    { userId: user._id }, { $set: updates }, { new: true, runValidators: true, upsert: true, setDefaultsOnInsert: true }
  )
  return buildFreelancerDTO(user, viewer)
}

// ── Client ──────────────────────────────────────────────────────────────────────────────────
async function buildClientDTO(user, viewer) {
  const [profile, totalSpend] = await Promise.all([ClientProfile.findOne({ userId: user._id }), totalSpendFor(user._id)])
  if (!profile) throw new ApiError(404, 'Client profile not found')
  return toClientProfileDTO(user, profile, { totalSpend, includeEmail: isOwnerOrAdmin(user, viewer) })
}

async function getClientProfile(clientId, viewer) {
  assertId(clientId, 'clientId')
  return buildClientDTO(await loadUser(clientId, 'Client', viewer), viewer)
}

async function updateClientProfile(clientId, updates, viewer) {
  assertId(clientId, 'clientId')
  const user = await loadUser(clientId, 'Client', viewer)
  const { name, ...profileUpdates } = updates
  if (name !== undefined) {
    user.name = name
    await user.save()
  }
  if (Object.keys(profileUpdates).length) {
    await ClientProfile.findOneAndUpdate(
      { userId: user._id }, { $set: profileUpdates }, { new: true, runValidators: true, upsert: true, setDefaultsOnInsert: true }
    )
  }
  return buildClientDTO(user, viewer)
}

module.exports = { getFreelancerProfile, updateFreelancerProfile, updateFreelancerExtras, getClientProfile, updateClientProfile }
