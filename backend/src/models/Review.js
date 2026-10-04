const mongoose = require('mongoose')
const { REVIEW_STATUSES } = require('./constants')

const reviewSchema = new mongoose.Schema(
  {
    contractId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contract', required: true },
    reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    revieweeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5, validate: { validator: Number.isInteger, message: 'rating must be a whole number' } },
    comment: { type: String, trim: true, maxlength: 1000, default: '' },
    // Moderation state used by the admin UI. Only 'Hidden' changes public visibility.
    status: { type: String, enum: REVIEW_STATUSES, default: 'Visible' },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
)
// One review per participant per contract (each side reviews the other once).
reviewSchema.index({ contractId: 1, reviewerId: 1 }, { unique: true })
reviewSchema.index({ status: 1, createdAt: -1 }) // admin moderation list

module.exports = mongoose.model('Review', reviewSchema)
