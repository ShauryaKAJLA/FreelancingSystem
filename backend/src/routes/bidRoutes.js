const router = require('express').Router()
const ctrl = require('../controllers/bidController')
const { authenticate, requireRole } = require('../middleware/auth')
const { validateBid } = require('../validators/bidValidators')

// Mounted at /api/bids. (POST /jobs/:jobId/bids and .../accept live in jobRoutes; GET /freelancers/:id/bids in freelancerRoutes.)
router.put('/:bidId', authenticate, requireRole('Freelancer'), validateBid, ctrl.edit)
router.patch('/:bidId/withdraw', authenticate, requireRole('Freelancer'), ctrl.withdraw)

module.exports = router
