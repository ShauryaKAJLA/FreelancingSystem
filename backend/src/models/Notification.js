const mongoose = require('mongoose')
const { NOTIFICATION_TYPES } = require('./constants')

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    message: { type: String, required: true, trim: true, maxlength: 500 },
    relatedEntityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    relatedEntityType: { type: String, trim: true, maxlength: 30, default: null }, // e.g. 'Milestone', 'Contract'
    isRead: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)
notificationSchema.index({ userId: 1, createdAt: -1 })
notificationSchema.index({ userId: 1, isRead: 1 })

module.exports = mongoose.model('Notification', notificationSchema)
