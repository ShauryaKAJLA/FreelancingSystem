const mongoose = require('mongoose')

const clientProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    companyName: { type: String, trim: true, maxlength: 120, default: '' },
    website: { type: String, trim: true, maxlength: 200, default: '' },
  },
  { timestamps: true }
)

module.exports = mongoose.model('ClientProfile', clientProfileSchema)
