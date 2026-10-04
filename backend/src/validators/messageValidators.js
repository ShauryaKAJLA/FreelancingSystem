const { isString, isObjectId, fail, cleanText } = require('./helpers')

const validateSendMessage = (req, _res, next) => {
  const { receiverId, messageText } = req.body || {}
  const errors = []
  if (!isObjectId(receiverId)) errors.push('receiverId must be a valid id')
  const text = isString(messageText) ? cleanText(messageText) : ''
  if (!text) errors.push('messageText is required')
  else if (text.length > 2000) errors.push('messageText must be 2000 characters or fewer')
  fail(errors)
  // senderId in the body (if any) is deliberately dropped: the sender is always the token's user.
  req.body = { receiverId, messageText: text }
  next()
}

module.exports = { validateSendMessage }
