const ApiError = require('../utils/ApiError')
const { isString, cleanText } = require('./helpers')

// Single-message 400 whose text is EXACTLY what the UI shows (fail() would prefix "Validation failed:").
const fail = (errors) => { if (errors.length) throw new ApiError(400, errors[0]) }

// Error strings deliberately match the frontend's wording. Only bidAmount + proposal are accepted from the body:
// freelancerId, status, jobId, bidDate ... are NEVER taken from the client (the caller and the URL decide them).
const MSG = { amount: 'Enter a valid bid amount.', proposal: 'Write a proposal before submitting.' }

const validateBid = (req, _res, next) => {
  const b = req.body || {}
  const errors = []
  const n = typeof b.bidAmount === 'boolean' || b.bidAmount === '' || b.bidAmount === null || b.bidAmount === undefined ? NaN : Number(b.bidAmount)
  if (!Number.isFinite(n) || n <= 0 || n > 1e9) errors.push(MSG.amount)
  const proposal = isString(b.proposal) ? cleanText(b.proposal) : ''
  if (!proposal) errors.push(MSG.proposal)
  else if (proposal.length > 5000) errors.push('Proposal must be 5000 characters or fewer.')
  fail(errors)
  req.body = { bidAmount: n, proposal }
  next()
}

module.exports = { validateBid }
