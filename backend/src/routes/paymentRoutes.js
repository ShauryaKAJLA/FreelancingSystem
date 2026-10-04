const router = require('express').Router()
const rateLimit = require('express-rate-limit')
const ctrl = require('../controllers/paymentController')
const { authenticate, requireRole } = require('../middleware/auth')
const { validateCreateOrder, validateVerify, validatePayout, validateRefund } = require('../validators/paymentValidators')

// Tighter cap on the money endpoints (on top of the global limiter).
const payLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many payment requests. Please try again later.' },
})

// POST /api/payments/webhook is mounted in app.js (needs the raw body, before express.json).
router.post('/create-order', authenticate, requireRole('Client'), payLimiter, validateCreateOrder, ctrl.createOrder)
router.post('/verify', authenticate, requireRole('Client'), payLimiter, validateVerify, ctrl.verify)
router.get('/', authenticate, requireRole('Admin'), ctrl.listAll)
router.post('/:paymentId/payout', authenticate, requireRole('Admin'), validatePayout, ctrl.payout)
router.post('/:paymentId/refund', authenticate, requireRole('Admin'), payLimiter, validateRefund, ctrl.refund)
router.post('/:paymentId/verify-admin', authenticate, requireRole('Admin'), ctrl.verifyByAdmin)
router.get('/:paymentId', authenticate, ctrl.get)

module.exports = router
