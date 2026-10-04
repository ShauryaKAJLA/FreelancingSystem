const asyncHandler = require('../utils/asyncHandler')
const ApiError = require('../utils/ApiError')
const { ok } = require('../utils/response')
const svc = require('../services/notificationService')

exports.list = asyncHandler(async (req, res) => {
  // Notifications are personal: even admins only read their own.
  if (req.params.userId !== String(req.user._id)) throw new ApiError(403, 'You can only read your own notifications')
  ok(res, await svc.list(req.params.userId, req.query, req.user))
})
exports.markRead = asyncHandler(async (req, res) => ok(res, await svc.markRead(req.params.notificationId, req.user), 'Marked as read'))
exports.markAllRead = asyncHandler(async (req, res) => ok(res, await svc.markAllRead(req.user), 'All notifications marked as read'))
