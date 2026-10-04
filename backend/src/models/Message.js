const mongoose = require('mongoose')

const messageSchema = new mongoose.Schema(
  {
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    messageText: { type: String, required: true, trim: true, minlength: 1, maxlength: 2000 },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
)
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 })
messageSchema.index({ receiverId: 1, read: 1 })

messageSchema.pre('validate', function (next) {
  if (this.senderId && this.receiverId && this.senderId.equals(this.receiverId)) {
    return next(new Error('Sender and receiver cannot be the same user'))
  }
  next()
})

module.exports = mongoose.model('Message', messageSchema)
