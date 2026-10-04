const router = require('express').Router()
const ctrl = require('../controllers/skillController')
const { authenticate, requireRole } = require('../middleware/auth')
const { validateSkill } = require('../validators/skillValidators')

router.get('/', authenticate, ctrl.list)
router.get('/:skillId', authenticate, ctrl.get)
router.post('/', authenticate, requireRole('Admin'), validateSkill, ctrl.create)
router.put('/:skillId', authenticate, requireRole('Admin'), validateSkill, ctrl.update)
router.delete('/:skillId', authenticate, requireRole('Admin'), ctrl.remove)

module.exports = router
