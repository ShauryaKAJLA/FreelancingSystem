const mongoose = require('mongoose')

// Reported issue / dispute on a contract (API group 18). Not in the supplied DB schema - a UI-facing addition, same as the mocks.
// Lifecycle: Open -> Resolved (admin only, once).
const issueSchema = new mongoose.Schema(
  {
    contractId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contract', required: true, index: true },
    raisedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subject: { type: String, required: true, trim: true, minlength: 1, maxlength: 1000 },
    status: { type: String, enum: ['Open', 'Resolved'], default: 'Open', index: true },
    resolution: { type: String, trim: true, maxlength: 1000, default: null },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Issue', issueSchema)
