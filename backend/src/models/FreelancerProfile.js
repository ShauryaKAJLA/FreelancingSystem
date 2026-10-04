const mongoose = require('mongoose')

// Payout destination used by admin dispatch (Phase 4). Owner/admin only - masked for everyone else in the DTO.
const paymentAccountSchema = new mongoose.Schema(
  {
    holderName: { type: String, trim: true, maxlength: 100, default: '' },
    bankName: { type: String, trim: true, maxlength: 100, default: '' },
    accountNumber: { type: String, trim: true, maxlength: 34, default: '' },
    ifsc: { type: String, trim: true, uppercase: true, maxlength: 11, default: '' },
    upiId: { type: String, trim: true, maxlength: 100, default: '' },
  },
  { _id: false }
)

const pastProjectSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    year: { type: String, trim: true, maxlength: 10, default: '' },
    link: { type: String, trim: true, maxlength: 300, default: '' },
  },
  { _id: false }
)

const freelancerProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    bio: { type: String, trim: true, maxlength: 2000, default: '' },
    hourlyRate: { type: Number, min: 0, max: 100000, default: 0 },
    skillIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Skill' }],
    paymentAccount: { type: paymentAccountSchema, default: null },
    pastProjects: { type: [pastProjectSchema], default: [] },
    // Server-controlled: derived from reviews, never writable via the profile API.
    rating: { type: Number, min: 0, max: 5, default: 0 },
  },
  { timestamps: true }
)
freelancerProfileSchema.index({ hourlyRate: 1 })
freelancerProfileSchema.index({ rating: -1 })
freelancerProfileSchema.index({ skillIds: 1 })

module.exports = mongoose.model('FreelancerProfile', freelancerProfileSchema)
