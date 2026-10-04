const asyncHandler = require('../utils/asyncHandler')
const { ok } = require('../utils/response')
const svc = require('../services/milestoneService')

exports.edit = asyncHandler(async (req, res) => ok(res, await svc.edit(req.user, req.params.milestoneId, req.body), 'Milestone updated'))
exports.remove = asyncHandler(async (req, res) => ok(res, await svc.remove(req.user, req.params.milestoneId), 'Milestone deleted'))
exports.submit = asyncHandler(async (req, res) => ok(res, await svc.submit(req.user, req.params.milestoneId), 'Milestone submitted'))
exports.reject = asyncHandler(async (req, res) => ok(res, await svc.reject(req.user, req.params.milestoneId, req.body.reason), 'Milestone rejected'))
exports.approve = asyncHandler(async (req, res) => ok(res, await svc.approve(req.user, req.params.milestoneId), 'Milestone approved'))
