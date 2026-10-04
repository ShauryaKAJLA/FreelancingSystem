const env = require('../config/env')
const ApiError = require('../utils/ApiError')

const notFound = (req, _res, next) => next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`))

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  let status = err.statusCode || 500
  let message = err.message || 'Internal server error'
  let details = err.details

  if (err.name === 'ValidationError' && err.errors) {
    status = 400
    message = 'Validation failed'
    details = Object.values(err.errors).map((e) => e.message)
  } else if (err.name === 'CastError') {
    status = 400
    message = `Invalid ${err.path}`
  } else if (err.code === 11000) {
    status = 409
    message = 'A record with that value already exists'
  } else if (err.type === 'entity.parse.failed') {
    status = 400
    message = 'Malformed JSON body'
  } else if (err.type === 'entity.too.large') {
    status = 413
    message = 'Request body too large'
  }

  if (status >= 500) {
    console.error(`[${req.id ?? '-'}] ${req.method} ${(req.originalUrl || '').split('?')[0]}`, err)
    if (env.nodeEnv === 'production') message = 'Internal server error'
  }

  const body = { success: false, message }
  if (req.id) body.requestId = req.id
  if (details) body.errors = details
  if (env.nodeEnv !== 'production' && status >= 500) body.stack = err.stack
  res.status(status).json(body)
}

module.exports = { notFound, errorHandler }
