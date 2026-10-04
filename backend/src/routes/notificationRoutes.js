const router = require('express').Router()
const ctrl = require('../controllers/notificationController')
const { authenticate } = require('../middleware/auth')

router.patch('/read-all', authenticate, ctrl.markAllRead) // before /:notificationId/read
router.patch('/:notificationId/read', authenticate, ctrl.markRead)
router.get('/:userId', authenticate, ctrl.list)

module.exports = router
