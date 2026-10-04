const asyncHandler = require('../utils/asyncHandler')
const { ok } = require('../utils/response')
const svc = require('../services/dashboardService')

exports.client = asyncHandler(async (req, res) => ok(res, await svc.clientDashboard(req.params.clientId)))
exports.freelancer = asyncHandler(async (req, res) => ok(res, await svc.freelancerDashboard(req.params.freelancerId)))
