const ApiError = require('../utils/ApiError')
const { isString, cleanText } = require('./helpers')

// Single-message 400 whose text is EXACTLY what the UI shows (fail() would prefix "Validation failed:").
const fail = ([msg]) => { throw new ApiError(400, msg) }

// title / amount / dueDate only. contractId comes from the URL; status, funded, rejectionReason can never be mass-assigned.
// The mock's message for missing/invalid title+amount is reproduced exactly.
const validateMilestoneBody = (req, _res, next) => {
  const b = req.body || {}
  const title = isString(b.title) ? cleanText(b.title) : ''
  const n = typeof b.amount === 'boolean' || b.amount === '' || b.amount === null || b.amount === undefined ? NaN : Number(b.amount)
  if (!title || !Number.isFinite(n) || n <= 0 || n > 1e9) fail(['A title and a positive amount are required.'])
  if (title.length > 100) fail(['Milestone title must be 100 characters or fewer.'])
  let dueDate = null
  if (b.dueDate !== undefined && b.dueDate !== null && b.dueDate !== '') {
    const d = new Date(b.dueDate)
    if (!isString(b.dueDate) || Number.isNaN(d.getTime())) fail(['Enter a valid due date.'])
    dueDate = b.dueDate
  }
  req.body = { title, amount: n, dueDate }
  next()
}

const validateRejectMilestone = (req, _res, next) => {
  const r = (req.body || {}).reason
  if (r !== undefined && r !== null && (!isString(r) || r.length > 500)) fail(['reason must be text up to 500 characters'])
  req.body = { reason: isString(r) && cleanText(r) ? cleanText(r) : null }
  next()
}

module.exports = { validateMilestoneBody, validateRejectMilestone }
