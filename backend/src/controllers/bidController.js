const asyncHandler = require('../utils/asyncHandler')
const { ok, created, okPaged } = require('../utils/response')
const svc = require('../services/bidService')

// Thin: the authenticated user (req.user) is the actor; ids in the body are never trusted.
exports.submit = asyncHandler(async (req, res) => created(res, await svc.submit(req.user, req.params.jobId, req.body), 'Bid submitted'))
exports.edit = asyncHandler(async (req, res) => ok(res, await svc.edit(req.user, req.params.bidId, req.body), 'Bid updated'))
exports.withdraw = asyncHandler(async (req, res) => ok(res, await svc.withdraw(req.user, req.params.bidId), 'Bid withdrawn'))
exports.listForFreelancer = asyncHandler(async (req, res) => okPaged(res, await svc.listForFreelancer(req.params.freelancerId, req.query)))
exports.accept = asyncHandler(async (req, res) => ok(res, await svc.accept(req.user, req.params.jobId, req.params.bidId), 'Bid accepted'))
