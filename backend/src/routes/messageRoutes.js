const router = require('express').Router()
const rateLimit = require('express-rate-limit')
const ctrl = require('../controllers/messageController')
const { authenticate } = require('../middleware/auth')
const { validateSendMessage } = require('../validators/messageValidators')

const sendLimiter = rateLimit({
  windowMs: 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'You are sending messages too quickly.' },
})

router.post('/', authenticate, sendLimiter, validateSendMessage, ctrl.send)
router.get('/conversation/:otherUserId', authenticate, ctrl.conversation) // before /:userId
router.get('/:userId', authenticate, ctrl.listForUser)

module.exports = router
