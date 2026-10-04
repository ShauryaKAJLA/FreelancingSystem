const asyncHandler = require('../utils/asyncHandler')
const { ok, created } = require('../utils/response')
const svc = require('../services/issueService')

exports.raise = asyncHandler(async (req, res) => created(res, await svc.raise(req.user, req.body), 'Issue reported'))
exports.list = asyncHandler(async (req, res) => ok(res, await svc.list(req.user, req.query)))
exports.resolve = asyncHandler(async (req, res) => ok(res, await svc.resolve(req.user, req.params.issueId, req.body.resolution), 'Issue resolved'))
