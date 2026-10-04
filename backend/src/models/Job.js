const mongoose = require('mongoose')
const { JOB_STATUSES, JOB_CATEGORIES, EXPERIENCE_LEVELS } = require('./constants')

// Job post. clientId is the client's User id. Lifecycle is enforced in services/jobService.js.
const jobSchema = new mongoose.Schema(
  {
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    budget: { type: Number, required: true, min: 0.01 },
    category: { type: String, enum: JOB_CATEGORIES },
    experienceLevel: { type: String, enum: EXPERIENCE_LEVELS },
    requiredSkillIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Skill' }],
    // One task specification per milestone the client wants; contracts create milestones from these (Phase 3).
    numberOfMilestones: { type: Number, min: 1, max: 20, default: 1 },
    milestoneTasks: [{ type: String, trim: true, maxlength: 1000 }],
    status: { type: String, enum: JOB_STATUSES, default: 'Draft' },
    cancellationReason: { type: String, trim: true, maxlength: 500, default: null },
  },
  { timestamps: true }
)
jobSchema.index({ status: 1, createdAt: -1 })
jobSchema.index({ clientId: 1, createdAt: -1 }) // client job list + workspace search
jobSchema.index({ requiredSkillIds: 1 })

module.exports = mongoose.model('Job', jobSchema)
