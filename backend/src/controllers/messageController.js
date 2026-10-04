const asyncHandler = require('../utils/asyncHandler')
const { ok, created } = require('../utils/response')
const svc = require('../services/messageService')

exports.send = asyncHandler(async (req, res) => created(res, await svc.send(req.user, req.body), 'Message sent'))
exports.listForUser = asyncHandler(async (req, res) => ok(res, await svc.listForUser(req.params.userId, req.user, req.query)))
exports.conversation = asyncHandler(async (req, res) => ok(res, await svc.conversation(req.user, req.params.otherUserId, req.query)))
