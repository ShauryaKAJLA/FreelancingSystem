const mongoose = require('mongoose')
const Job = require('../models/Job')
const Bid = require('../models/Bid')
const Contract = require('../models/Contract')
const Payment = require('../models/Payment')
const FreelancerProfile = require('../models/FreelancerProfile')
const ApiError = require('../utils/ApiError')
const { toJobDTO, toBidDTO } = require('../utils/dto')
const { OPEN_BID_STATUSES } = require('../models/constants')

const assertId = (id, label) => {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, `Invalid ${label}`)
}
const oid = (v) => new mongoose.Types.ObjectId(String(v))

// Client dashboard = the mock's getClientDashboard: { openJobs, draftJobs, activeContracts, pendingBids, recentJobs[3] }.
// pendingBids counts Pending AND Updated bids, matching the Phase 3 decision for the client's job list
// (an edited bid is still waiting for the client's review).
async function clientDashboard(clientId) {
  assertId(clientId, 'clientId')
  const [openJobs, draftJobs, activeContracts, jobIds, recent] = await Promise.all([
    Job.countDocuments({ clientId, status: 'Published' }),
    Job.countDocuments({ clientId, status: 'Draft' }),
    Contract.countDocuments({ clientId, status: 'Active' }),
    Job.find({ clientId }).select('_id'),
    Job.find({ clientId }).sort({ createdAt: -1, _id: -1 }).limit(3),
  ])
  const pendingBids = jobIds.length ? await Bid.countDocuments({ jobId: { $in: jobIds.map((j) => j._id) }, status: { $in: OPEN_BID_STATUSES } }) : 0
  return { openJobs, draftJobs, activeContracts, pendingBids, recentJobs: recent.map(toJobDTO) }
}

// Freelancer dashboard = the mock's getFreelancerDashboard: { pendingBids, activeContracts, totalEarned, rating, recentBids[3] }.
// pendingBids counts status 'Pending' only, like the mock and the "Pending" filter its card links to.
async function freelancerDashboard(freelancerId) {
  assertId(freelancerId, 'freelancerId')
  const [pendingBids, activeContracts, [earned], profile, recent] = await Promise.all([
    Bid.countDocuments({ freelancerId, status: 'Pending' }),
    Contract.countDocuments({ freelancerId, status: 'Active' }),
    Payment.aggregate([{ $match: { freelancerId: oid(freelancerId), status: 'Paid' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    FreelancerProfile.findOne({ userId: freelancerId }).select('rating'),
    Bid.find({ freelancerId }).sort({ bidDate: -1, _id: -1 }).limit(3),
  ])
  const jobs = recent.length ? await Job.find({ _id: { $in: recent.map((b) => b.jobId) } }).select('title') : []
  const titleBy = new Map(jobs.map((j) => [String(j._id), j.title]))
  return {
    pendingBids,
    activeContracts,
    totalEarned: earned?.total ?? 0,
    rating: profile?.rating ?? null,
    recentBids: recent.map((b) => ({ ...toBidDTO(b), jobTitle: titleBy.get(String(b.jobId)) })),
  }
}

module.exports = { clientDashboard, freelancerDashboard }
