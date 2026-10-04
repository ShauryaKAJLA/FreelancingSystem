const mongoose = require('mongoose')
const { MILESTONE_STATUSES } = require('./constants')

// Lifecycle: Pending -> Submitted -> Completed (reject sends Submitted back to Pending).
// amount is in rupees; it is converted to paise only at the Razorpay boundary.
// `funded` is flipped ONLY by paymentService once a Razorpay payment is verified (Phase 4) - never by a request body.
const milestoneSchema = new mongoose.Schema(
  {
    contractId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contract', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    taskSpec: { type: String, trim: true, maxlength: 1000, default: null },
    amount: { type: Number, required: true, min: 0.01 },
    status: { type: String, enum: MILESTONE_STATUSES, default: 'Pending' },
    dueDate: { type: Date, default: null }, // optional, like the mock
    rejectionReason: { type: String, trim: true, maxlength: 500, default: null },
    funded: { type: Boolean, default: false },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Milestone', milestoneSchema)
