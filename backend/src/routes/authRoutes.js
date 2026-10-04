const router = require('express').Router()
const rateLimit = require('express-rate-limit')
const ctrl = require('../controllers/authController')
const { authenticate } = require('../middleware/auth')
const { validateRegister, validateLogin } = require('../validators/authValidators')

// Brute-force protection on credential endpoints.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again later.' },
})

router.post('/register', authLimiter, validateRegister, ctrl.register)
router.post('/login', authLimiter, validateLogin, ctrl.login)
router.get('/me', authenticate, ctrl.me)

module.exports = router
