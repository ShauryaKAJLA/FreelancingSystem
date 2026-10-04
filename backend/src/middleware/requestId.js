const crypto = require('crypto')

// Attaches a request id (honours a sane incoming X-Request-Id, else generates one) and echoes it back,
// so a user-reported error can be matched to a log line.
const SAFE = /^[A-Za-z0-9._-]{8,64}$/
module.exports = function requestId(req, res, next) {
  const incoming = req.get('x-request-id')
  req.id = incoming && SAFE.test(incoming) ? incoming : crypto.randomUUID()
  res.setHeader('X-Request-Id', req.id)
  next()
}
