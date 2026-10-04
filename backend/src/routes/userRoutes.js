const router = require('express').Router()
const ctrl = require('../controllers/reviewController')
const { authenticate } = require('../middleware/auth')

router.get('/:userId/reviews', authenticate, ctrl.listForUser)

module.exports = router
