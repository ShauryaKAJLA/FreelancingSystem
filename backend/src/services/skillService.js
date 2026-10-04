const mongoose = require('mongoose')
const Skill = require('../models/Skill')
const Job = require('../models/Job')
const FreelancerProfile = require('../models/FreelancerProfile')
const ApiError = require('../utils/ApiError')
const { toSkillDTO } = require('../utils/dto')
const { escapeRegex } = require('../utils/text')

const assertId = (id) => {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, 'Invalid skillId')
}
const exactName = (name) => new RegExp(`^${escapeRegex(name)}$`, 'i')

// Creation order == the order the UI has always shown (React, Node.js, ...).
async function list({ withUsage = false } = {}) {
  const skills = await Skill.find().sort({ _id: 1 })
  if (!withUsage) return skills.map(toSkillDTO)
  const usage = await usageCounts()
  return skills.map((s) => {
    const u = usage.get(String(s._id)) || { freelancers: 0, jobs: 0 }
    return { ...toSkillDTO(s), freelancerCount: u.freelancers, jobCount: u.jobs, usageCount: u.freelancers + u.jobs }
  })
}

// Admin view: how many freelancer profiles list the skill / how many jobs require it. Two grouped scans, one per collection.
async function usageCounts() {
  const group = (field) => [{ $unwind: `$${field}` }, { $group: { _id: `$${field}`, n: { $sum: 1 } } }]
  const [profiles, jobs] = await Promise.all([
    FreelancerProfile.aggregate(group('skillIds')),
    Job.aggregate(group('requiredSkillIds')),
  ])
  const out = new Map()
  const slot = (id) => out.get(String(id)) || out.set(String(id), { freelancers: 0, jobs: 0 }).get(String(id))
  for (const r of profiles) slot(r._id).freelancers = r.n
  for (const r of jobs) slot(r._id).jobs = r.n
  return out
}

async function get(skillId) {
  assertId(skillId)
  const skill = await Skill.findById(skillId)
  if (!skill) throw new ApiError(404, 'Skill not found')
  return toSkillDTO(skill)
}

async function create({ name }) {
  if (await Skill.exists({ name: exactName(name) })) throw new ApiError(409, 'A skill with that name already exists.')
  try {
    return toSkillDTO(await Skill.create({ name }))
  } catch (err) {
    if (err.code === 11000) throw new ApiError(409, 'A skill with that name already exists.')
    throw err
  }
}

async function update(skillId, { name }) {
  assertId(skillId)
  if (await Skill.exists({ _id: { $ne: skillId }, name: exactName(name) })) throw new ApiError(409, 'A skill with that name already exists.')
  const skill = await Skill.findByIdAndUpdate(skillId, { $set: { name } }, { new: true, runValidators: true })
  if (!skill) throw new ApiError(404, 'Skill not found')
  return toSkillDTO(skill)
}

// A skill in use is not deleted - silently stripping it from profiles/jobs would change other people's data.
async function remove(skillId) {
  assertId(skillId)
  const [inProfiles, inJobs] = await Promise.all([
    FreelancerProfile.exists({ skillIds: skillId }),
    Job.exists({ requiredSkillIds: skillId }),
  ])
  if (inProfiles || inJobs) throw new ApiError(409, 'This skill is used by freelancer profiles or jobs and cannot be deleted.')
  const deleted = await Skill.findByIdAndDelete(skillId)
  if (!deleted) throw new ApiError(404, 'Skill not found')
  return { skillId: String(skillId) }
}

// Throws unless every id exists. Used by job + profile writes.
async function assertAllExist(ids) {
  if (!ids || ids.length === 0) return
  const count = await Skill.countDocuments({ _id: { $in: ids } })
  if (count !== ids.length) throw new ApiError(400, 'One or more skills do not exist')
}

module.exports = { list, get, create, update, remove, assertAllExist }
