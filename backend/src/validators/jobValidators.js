const { isString, isObjectId, fail, cleanText } = require('./helpers')
const { JOB_CATEGORIES, EXPERIENCE_LEVELS } = require('../models/constants')

// Error strings deliberately match the frontend mock's messages so the UI text is unchanged.
const MSG = {
  title: 'Job title is required.',
  description: 'Description is required.',
  budget: 'Enter a valid budget amount.',
}

const toMoney = (v) => (typeof v === 'boolean' || v === '' || v === null ? NaN : Number(v))

// Whitelists fields (clientId, status, cancellationReason ... can't be mass-assigned) and normalises them.
// `mode` = 'create' (title/description/budget required) | 'edit' (all optional, at least one present).
const build = (mode) => (req, _res, next) => {
  const b = req.body || {}
  const out = {}
  const errors = []

  if (b.title !== undefined || mode === 'create') {
    const t = isString(b.title) ? cleanText(b.title) : ''
    if (!t) errors.push(MSG.title)
    else if (t.length > 150) errors.push('Job title must be 150 characters or fewer.')
    else out.title = t
  }
  if (b.description !== undefined || mode === 'create') {
    const d = isString(b.description) ? cleanText(b.description) : ''
    if (!d) errors.push(MSG.description)
    else if (d.length > 5000) errors.push('Description must be 5000 characters or fewer.')
    else out.description = d
  }
  if (b.budget !== undefined || mode === 'create') {
    const n = toMoney(b.budget)
    if (!Number.isFinite(n) || n <= 0 || n > 1e9) errors.push(MSG.budget)
    else out.budget = n
  }
  if (b.category !== undefined && b.category !== null && b.category !== '') {
    if (!JOB_CATEGORIES.includes(b.category)) errors.push(`category must be one of: ${JOB_CATEGORIES.join(', ')}`)
    else out.category = b.category
  }
  if (b.experienceLevel !== undefined && b.experienceLevel !== null && b.experienceLevel !== '') {
    if (!EXPERIENCE_LEVELS.includes(b.experienceLevel)) errors.push(`experienceLevel must be one of: ${EXPERIENCE_LEVELS.join(', ')}`)
    else out.experienceLevel = b.experienceLevel
  }
  if (b.requiredSkillIds !== undefined) {
    if (!Array.isArray(b.requiredSkillIds) || b.requiredSkillIds.length > 30 || !b.requiredSkillIds.every(isObjectId)) {
      errors.push('requiredSkillIds must be an array (max 30) of valid skill ids')
    } else out.requiredSkillIds = [...new Set(b.requiredSkillIds)]
  }
  if (b.milestoneTasks !== undefined) {
    if (!Array.isArray(b.milestoneTasks) || b.milestoneTasks.length > 20 || !b.milestoneTasks.every(isString)) {
      errors.push('milestoneTasks must be an array (max 20) of text')
    } else {
      const tasks = b.milestoneTasks.map((t) => cleanText(t))
      if (tasks.some((t) => !t)) errors.push('Enter a task specification for every milestone.')
      else if (tasks.some((t) => t.length > 1000)) errors.push('Each task specification must be 1000 characters or fewer.')
      else { out.milestoneTasks = tasks; out.numberOfMilestones = Math.max(1, tasks.length) }
    }
  }
  if (out.milestoneTasks === undefined && b.numberOfMilestones !== undefined) {
    const n = Number(b.numberOfMilestones)
    if (!Number.isInteger(n) || n < 1 || n > 20) errors.push('numberOfMilestones must be a whole number from 1 to 20')
    else out.numberOfMilestones = n
  }
  // create only: the client chooses Draft or Published; anything else becomes Draft (matches the mock).
  if (mode === 'create') out.status = b.status === 'Published' ? 'Published' : 'Draft'

  if (mode === 'edit' && !errors.length && Object.keys(out).length === 0) errors.push('Provide at least one field to update.')
  fail(errors)
  req.body = out
  next()
}

const validateCreateJob = build('create')
const validateEditJob = build('edit')

const validateCancelJob = (req, _res, next) => {
  const r = (req.body || {}).reason
  if (r !== undefined && r !== null && (!isString(r) || r.length > 500)) fail(['reason must be text up to 500 characters'])
  req.body = { reason: isString(r) && r.trim() ? cleanText(r) : null }
  next()
}

// GET /jobs/open and GET /freelancers query strings: whitelist + coerce, drop empty values.
const numOrUndef = (v, label, errors, { min = 0 } = {}) => {
  if (v === undefined || v === '' || v === null) return undefined
  const n = Number(v)
  if (!Number.isFinite(n) || n < min) { errors.push(`${label} must be a number`); return undefined }
  return n
}
const strOrUndef = (v) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 100) : undefined)

const OPEN_JOB_SORTS = ['newest', 'oldest', 'budgetHigh', 'budgetLow']
const validateOpenJobsQuery = (req, _res, next) => {
  const q = req.query || {}
  const errors = []
  const out = {
    search: strOrUndef(q.search),
    skillId: strOrUndef(q.skillId),
    category: strOrUndef(q.category),
    experienceLevel: strOrUndef(q.experienceLevel),
    budgetMin: numOrUndef(q.budgetMin, 'budgetMin', errors),
    budgetMax: numOrUndef(q.budgetMax, 'budgetMax', errors),
    sortBy: OPEN_JOB_SORTS.includes(q.sortBy) ? q.sortBy : 'newest',
  }
  if (out.skillId && !isObjectId(out.skillId)) errors.push('skillId is invalid')
  fail(errors)
  req.filters = out
  next()
}

const FREELANCER_SORTS = ['ratingHigh', 'rateLow', 'rateHigh']
const validateFreelancerQuery = (req, _res, next) => {
  const q = req.query || {}
  const errors = []
  const out = {
    search: strOrUndef(q.search),
    skillId: strOrUndef(q.skillId),
    minRating: numOrUndef(q.minRating, 'minRating', errors),
    minRate: numOrUndef(q.minRate, 'minRate', errors),
    maxRate: numOrUndef(q.maxRate, 'maxRate', errors),
    sortBy: FREELANCER_SORTS.includes(q.sortBy) ? q.sortBy : 'ratingHigh',
  }
  if (out.skillId && !isObjectId(out.skillId)) errors.push('skillId is invalid')
  fail(errors)
  req.filters = out
  next()
}

module.exports = { validateCreateJob, validateEditJob, validateCancelJob, validateOpenJobsQuery, validateFreelancerQuery, OPEN_JOB_SORTS, FREELANCER_SORTS }
