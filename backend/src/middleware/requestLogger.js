const morgan = require('morgan')

// One JSON-ish line per request. Deliberately logs method, path WITHOUT the query string (queries can carry
// search terms / emails), status, latency, request id and user id only -- never headers, bodies or tokens.
morgan.token('id', (req) => req.id)
morgan.token('uid', (req) => (req.user ? String(req.user._id) : '-'))
morgan.token('safe-url', (req) => (req.originalUrl || req.url || '').split('?')[0])

const format = ':id :method :safe-url :status :response-time ms uid=:uid'
module.exports = morgan(format)
module.exports.format = format
