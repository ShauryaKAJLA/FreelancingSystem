const mongoose = require('mongoose')
const User = require('../models/User')
const ApiError = require('../utils/ApiError')
const asyncHandler = require('../utils/asyncHandler')
const { verifyToken } = require('../utils/jwt')

// Verifies the Bearer token, then reloads the user so role/status changes
// (e.g. an admin flagging an account) take effect immediately, not at token expiry.
const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || ''
  const [scheme, token] = header.split(' ')
  if (scheme !== 'Bearer' || !token) throw new ApiError(401, 'Authentication required')

  let payload
  try {
    payload = verifyToken(token)
  } catch {
    throw new ApiError(401, 'Invalid or expired token')
  }

  const user = await User.findById(payload.sub)
  if (!user) throw new ApiError(401, 'Account no longer exists')
  if (user.status !== 'Active') throw new ApiError(403, 'Account is not active')

  req.user = user
  next()
})

const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) return next(new ApiError(401, 'Authentication required'))
  if (!roles.includes(req.user.role)) return next(new ApiError(403, 'You do not have permission to perform this action'))
  next()
}

// The :param must be the caller's own user id (profile ids == user ids). Admins may act on anyone.
const requireOwnership = (param) => (req, _res, next) => {
  if (!req.user) return next(new ApiError(401, 'Authentication required'))
  const target = req.params[param]
  if (!mongoose.isValidObjectId(target)) return next(new ApiError(400, `Invalid ${param}`))
  if (req.user.role === 'Admin' || String(req.user._id) === target) return next()
  next(new ApiError(403, 'You can only modify your own resources'))
}

module.exports = { authenticate, requireRole, requireOwnership }
