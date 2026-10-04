const { isString, isEmail, cleanText } = require('./helpers')
const ApiError = require('../utils/ApiError')

const validateModerateReview = (req, _res, next) => {
  const { action } = req.body || {}
  if (!['approve', 'flag', 'hide'].includes(action)) throw new ApiError(400, 'Unknown moderation action.')
  req.body = { action }
  next()
}

// Only name/email are editable (whitelist). Messages match the mock.
const validateAdminProfile = (req, _res, next) => {
  const { name, email } = req.body || {}
  const body = {}
  const errors = []
  if (name !== undefined) {
    const n = isString(name) ? cleanText(name) : ''
    if (!n) errors.push('Name is required.')
    else if (n.length > 100) errors.push('Name must be 100 characters or fewer.')
    else body.name = n
  }
  if (email !== undefined) {
    if (!isString(email) || !email.trim()) errors.push('Email is required.')
    else if (!isEmail(email)) errors.push('Enter a valid email address.')
    else body.email = email.trim()
  }
  if (errors.length) throw new ApiError(400, errors[0]) // single message, no "Validation failed:" prefix (matches the mock)
  req.body = body
  next()
}

module.exports = { validateModerateReview, validateAdminProfile }
