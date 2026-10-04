const mongoose = require('mongoose')
const { ROLES, USER_STATUSES } = require('./constants')

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true },
    status: { type: String, enum: USER_STATUSES, default: 'Active' },
  },
  { timestamps: true }
)

// Defence in depth: passwordHash never leaves the server even if a query selects it.
userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash
    delete ret.__v
    return ret
  },
})

module.exports = mongoose.model('User', userSchema)

