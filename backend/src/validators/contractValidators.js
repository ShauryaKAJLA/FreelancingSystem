const ApiError = require('../utils/ApiError')
const { isString, fail, cleanText } = require('./helpers')

// Optional free-text reason (cancel / termination request). Anything else in the body is dropped.
// NOTE: `requestedByRole` sent by the frontend is deliberately ignored - the role comes from the JWT.
const reasonOnly = (req, _res, next) => {
  const r = (req.body || {}).reason
  if (r !== undefined && r !== null && (!isString(r) || r.length > 500)) fail(['reason must be text up to 500 characters'])
  req.body = { reason: isString(r) && cleanText(r) ? cleanText(r) : null }
  next()
}

// approve must be a real boolean: "false" / 0 / "no" must never be read as truthy.
const validateTerminationResponse = (req, _res, next) => {
  const a = (req.body || {}).approve
  if (typeof a !== 'boolean') throw new ApiError(400, 'Validation failed', ['approve must be true or false'])
  req.body = { approve: a }
  next()
}

module.exports = { validateCancelContract: reasonOnly, validateTerminationRequest: reasonOnly, validateTerminationResponse }
