const router = require('express').Router()
const ctrl = require('../controllers/paymentController')
const { authenticate, requireRole } = require('../middleware/auth')

router.delete('/:paymentMethodId', authenticate, requireRole('Client'), ctrl.removeMethod)
router.patch('/:paymentMethodId/default', authenticate, requireRole('Client'), ctrl.defaultMethod)

module.exports = router
