const asyncHandler = require('../utils/asyncHandler')
const ApiError = require('../utils/ApiError')
const { ok } = require('../utils/response')
const svc = require('../services/searchService')

// The caller is always the token's user; a clientId/freelancerId that names someone else is refused instead of ignored.
const assertSelf = (param, user) => {
  if (param !== undefined && String(param) !== String(user._id)) throw new ApiError(403, 'You can only search your own workspace')
}
exports.client = asyncHandler(async (req, res) => { assertSelf(req.query.clientId, req.user); ok(res, await svc.forClient(req.user, req.query.query)) })
exports.freelancer = asyncHandler(async (req, res) => { assertSelf(req.query.freelancerId, req.user); ok(res, await svc.forFreelancer(req.user, req.query.query)) })
exports.admin = asyncHandler(async (req, res) => ok(res, await svc.forAdmin(req.query.query)))
