const asyncHandler = require('../utils/asyncHandler')
const { ok, created } = require('../utils/response')
const authService = require('../services/authService')

exports.register = asyncHandler(async (req, res) => {
  created(res, await authService.register(req.body), 'Registration successful')
})

exports.login = asyncHandler(async (req, res) => {
  ok(res, await authService.login(req.body), 'Login successful')
})

// Convenience for the frontend to restore a session from a stored token.
exports.me = asyncHandler(async (req, res) => {
  ok(res, { user: authService.safeUser(req.user) })
})
