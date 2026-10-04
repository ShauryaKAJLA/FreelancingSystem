const { isString, fail, cleanText } = require('./helpers')

const validateReview = (req, _res, next) => {
  const { rating, comment } = req.body || {}
  const errors = []
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) errors.push('rating must be a whole number from 1 to 5')
  let clean = ''
  if (comment !== undefined && comment !== null) {
    if (!isString(comment)) errors.push('comment must be text')
    else {
      clean = cleanText(comment)
      if (clean.length > 1000) errors.push('comment must be 1000 characters or fewer')
    }
  }
  fail(errors)
  // reviewerId / revieweeId / status in the body are ignored: they are derived server-side.
  req.body = { rating, comment: clean }
  next()
}

module.exports = { validateReview }
