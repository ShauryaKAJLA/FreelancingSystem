const mongoose = require('mongoose')

// Skills master list. Admin-managed (POST/PUT/DELETE /api/skills); everyone can read.
const skillSchema = new mongoose.Schema(
  { name: { type: String, required: true, unique: true, trim: true, maxlength: 60 } },
  { timestamps: true }
)

module.exports = mongoose.model('Skill', skillSchema)
