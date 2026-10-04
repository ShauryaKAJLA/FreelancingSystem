const mongoose = require('mongoose')
const { CONTRACT_STATUSES, TERMINATION_ROLES } = require('./constants')

// Party ids are User ids. Lifecycle (services/contractService.js):
//   Pending Start -> Active -> Completed | Terminated (mutual) ; Pending Start/Active -> Cancelled (client)
const contractSchema = new mongoose.Schema(
  {
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    freelancerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    startDate: { type: Date, default: null }, // null while Pending Start
    endDate: { type: Date, default: null },
    status: { type: String, enum: CONTRACT_STATUSES, default: 'Pending Start' },
    cancellationReason: { type: String, trim: true, maxlength: 500, default: null },
    terminationRequestedBy: { type: String, enum: [...TERMINATION_ROLES, null], default: null },
    terminationReason: { type: String, trim: true, maxlength: 500, default: null },
  },
  { timestamps: true }
)
contractSchema.index({ jobId: 1, freelancerId: 1 }, { unique: true })
contractSchema.index({ clientId: 1, createdAt: -1 }) // client contract list
contractSchema.index({ freelancerId: 1, createdAt: -1 }) // freelancer contract list
contractSchema.index({ status: 1, createdAt: -1 }) // admin filter by status

module.exports = mongoose.model('Contract', contractSchema)
