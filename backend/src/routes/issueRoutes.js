const router = require('express').Router()
const rateLimit = require('express-rate-limit')
const ctrl = require('../controllers/issueController')
const { authenticate, requireRole } = require('../middleware/auth')
const { validateRaiseIssue, validateResolveIssue } = require('../validators/issueValidators')

const raiseLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'You are reporting issues too quickly. Please try again later.' },
})

router.post('/', authenticate, requireRole('Client', 'Freelancer'), raiseLimiter, validateRaiseIssue, ctrl.raise)
router.get('/', authenticate, ctrl.list) // admin: all; others: their own
router.patch('/:issueId/resolve', authenticate, requireRole('Admin'), validateResolveIssue, ctrl.resolve)

module.exports = router
