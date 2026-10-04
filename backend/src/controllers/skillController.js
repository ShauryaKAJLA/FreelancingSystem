const asyncHandler = require('../utils/asyncHandler')
const { ok, created } = require('../utils/response')
const svc = require('../services/skillService')
const adminActions = require('../services/adminActionService')

// ?usage=true adds freelancerCount / jobCount / usageCount per skill. Admin only: other roles silently get the plain list.
exports.list = asyncHandler(async (req, res) => ok(res, await svc.list({ withUsage: req.query.usage === 'true' && req.user?.role === 'Admin' })))
exports.get = asyncHandler(async (req, res) => ok(res, await svc.get(req.params.skillId)))
// Writes are Admin-only (route gate) and land in the audit trail (System Logs). Logging never fails the request.
exports.create = asyncHandler(async (req, res) => {
  const skill = await svc.create(req.body)
  await adminActions.log(req.user, 'Skill Added', `Added skill "${skill.skillName}" (${skill.skillId}).`)
  return created(res, skill, 'Skill added')
})
exports.update = asyncHandler(async (req, res) => {
  const skill = await svc.update(req.params.skillId, req.body)
  await adminActions.log(req.user, 'Skill Renamed', `Renamed skill ${skill.skillId} to "${skill.skillName}".`)
  return ok(res, skill, 'Skill updated')
})
exports.remove = asyncHandler(async (req, res) => {
  const result = await svc.remove(req.params.skillId)
  await adminActions.log(req.user, 'Skill Deleted', `Deleted skill ${result.skillId}.`)
  return ok(res, result, 'Skill deleted')
})
