const { isString, isObjectId, fail, cleanText } = require('./helpers')
const ApiError = require('../utils/ApiError')

// The mock's exact message for an empty subject; contractId problems are 400 with a plain message.
const validateRaiseIssue = (req, _res, next) => {
  const { contractId, subject } = req.body || {}
  const text = isString(subject) ? cleanText(subject) : ''
  if (!text) throw new ApiError(400, 'Describe the issue before submitting.')
  const errors = []
  if (!isObjectId(contractId)) errors.push('contractId must be a valid id')
  if (text.length > 1000) errors.push('subject must be 1000 characters or fewer')
  fail(errors)
  // raisedBy in the body is dropped on purpose: the reporter is always the token's user.
  req.body = { contractId, subject: text }
  next()
}

const validateResolveIssue = (req, _res, next) => {
  const { resolution } = req.body || {}
  const errors = []
  if (resolution !== undefined && (!isString(resolution) || resolution.length > 1000)) errors.push('resolution must be text up to 1000 characters')
  fail(errors)
  req.body = resolution ? { resolution: cleanText(resolution) } : {}
  next()
}

module.exports = { validateRaiseIssue, validateResolveIssue }
