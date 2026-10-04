const asyncHandler = require('../utils/asyncHandler')
const { ok, okPaged } = require('../utils/response')
const { optPagination } = require('../utils/pagination')
const svc = require('../services/profileService')
const discovery = require('../services/freelancerService')

exports.getFreelancer = asyncHandler(async (req, res) => ok(res, await svc.getFreelancerProfile(req.params.freelancerId, req.user)))
exports.updateFreelancer = asyncHandler(async (req, res) =>
  ok(res, await svc.updateFreelancerProfile(req.params.freelancerId, req.body, req.user), 'Profile updated'))
exports.updateFreelancerExtras = asyncHandler(async (req, res) =>
  ok(res, await svc.updateFreelancerExtras(req.params.freelancerId, req.body, req.user), 'Profile updated'))
exports.searchFreelancers = asyncHandler(async (req, res) => okPaged(res, await discovery.search(req.filters, optPagination(req.query))))
exports.getClient = asyncHandler(async (req, res) => ok(res, await svc.getClientProfile(req.params.clientId, req.user)))
exports.updateClient = asyncHandler(async (req, res) =>
  ok(res, await svc.updateClientProfile(req.params.clientId, req.body, req.user), 'Profile updated'))
