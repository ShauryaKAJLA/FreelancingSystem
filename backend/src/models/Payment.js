const mongoose = require('mongoose')
const { PAYMENT_STATUSES } = require('./constants')

// One document per Razorpay order. amount is rupees (matches Milestone.amount);
// paise is derived at the provider boundary. Raw card data is never stored.
const paymentSchema = new mongoose.Schema(
  {
    milestoneId: { type: mongoose.Schema.Types.ObjectId, ref: 'Milestone', required: true, index: true },
    contractId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contract', required: true, index: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    freelancerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    currency: { type: String, default: 'INR', enum: ['INR'] },
    provider: { type: String, default: 'razorpay' },
    providerOrderId: { type: String, required: true, unique: true },
    // No default (not null): the sparse unique index below must skip unpaid orders, and sparse only skips MISSING fields.
    providerPaymentId: { type: String, default: undefined },
    status: { type: String, enum: PAYMENT_STATUSES, default: 'Pending', index: true },
    failureReason: { type: String, default: null },
    failedAttempts: { type: Number, default: 0 },
    paidAt: { type: Date, default: null }, // when the client's money was captured/held
    approvedAt: { type: Date, default: null }, // when the milestone was approved (Held -> Awaiting Payout)
    payoutAt: { type: Date, default: null },
    payoutReference: { type: String, default: null },
    refundedAt: { type: Date, default: null },
    // Phase 7: admin-initiated refund. refundRequestedAt is the atomic claim that makes double-refund impossible;
    // the refund.processed webhook flips status to Refunded.
    refundRequestedAt: { type: Date, default: null },
    refundId: { type: String, default: null },
    refundReason: { type: String, default: null },
    refundedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // Phase 4: admin review + payout details (frontend: adminVerified, payoutTo, payoutId)
    adminVerified: { type: Boolean, default: false },
    adminVerifiedAt: { type: Date, default: null },
    payoutTo: { type: String, default: null }, // masked destination, e.g. a UPI id or "A/c ****1234"
    dispatchedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // Set to milestoneId while the payment holds/has paid the milestone's money. The sparse unique
    // index makes "two funded payments for one milestone" impossible even under races.
    fundedLock: { type: mongoose.Schema.Types.ObjectId, default: undefined },
  },
  { timestamps: true }
)
paymentSchema.index({ status: 1, createdAt: -1 }) // admin transactions / payout queue
// user payment lists sort by paidAt desc (then createdAt/_id); the owner id is always in the filter
paymentSchema.index({ clientId: 1, paidAt: -1, createdAt: -1 })
paymentSchema.index({ freelancerId: 1, paidAt: -1, createdAt: -1 })
paymentSchema.index({ fundedLock: 1 }, { unique: true, sparse: true })
paymentSchema.index({ providerPaymentId: 1 }, { unique: true, sparse: true })

module.exports = mongoose.model('Payment', paymentSchema)
