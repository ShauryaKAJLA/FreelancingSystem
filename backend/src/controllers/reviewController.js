const asyncHandler = require('../utils/asyncHandler')
const { ok, created } = require('../utils/response')
const svc = require('../services/reviewService')

exports.submit = asyncHandler(async (req, res) => created(res, await svc.submit(req.user, req.params.contractId, req.body), 'Review submitted'))
exports.listForUser = asyncHandler(async (req, res) => ok(res, await svc.listForUser(req.params.userId, req.user, req.query)))
