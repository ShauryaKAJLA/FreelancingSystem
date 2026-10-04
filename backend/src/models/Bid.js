const mongoose = require('mongoose')
const { BID_STATUSES } = require('./constants')

// A freelancer's proposal on a job. Lifecycle (services/bidService.js): Pending -> Updated (edit),
// Pending/Updated -> Withdrawn (freelancer) | Accepted / Rejected (client hires / job closes).
const bidSchema = new mongoose.Schema(
  {
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
    freelancerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    bidAmount: { type: Number, required: true, min: 0.01 },
    proposal: { type: String, required: true, trim: true, maxlength: 5000 },
    status: { type: String, enum: BID_STATUSES, default: 'Pending' },
    bidDate: { type: Date, default: Date.now }, // refreshed when the bid is edited
    // true until the freelancer withdraws. Mongo partial indexes can't express "status != Withdrawn",
    // so this flag carries it: one non-withdrawn bid per (job, freelancer), but re-bidding after a withdrawal is allowed.
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)
bidSchema.index({ freelancerId: 1, bidDate: -1 }) // freelancer My Bids list (paged, sorted by bidDate desc)
bidSchema.index({ jobId: 1, status: 1 }) // pendingBids filter + per-job open-bid stats
bidSchema.index({ jobId: 1, freelancerId: 1 }, { unique: true, partialFilterExpression: { isActive: true } })

module.exports = mongoose.model('Bid', bidSchema)
