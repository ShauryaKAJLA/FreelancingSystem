const mongoose = require('mongoose')

// Append-only audit trail of admin writes (AdminActions table: action_id, admin_id, action_type, action_description, action_date).
const adminActionSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    actionType: { type: String, required: true, trim: true, maxlength: 60 },
    actionDescription: { type: String, required: true, trim: true, maxlength: 500 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)
adminActionSchema.index({ createdAt: -1 })

module.exports = mongoose.model('AdminAction', adminActionSchema)
