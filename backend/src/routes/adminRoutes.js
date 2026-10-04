const router = require('express').Router()
const ctrl = require('../controllers/adminController')
const { authenticate, requireRole } = require('../middleware/auth')
const { validateModerateReview, validateAdminProfile } = require('../validators/adminValidators')
const { validateResolveIssue } = require('../validators/issueValidators')

// Everything under /api/admin is Admin-only (the role check runs before any handler or validator).
router.use(authenticate, requireRole('Admin'))

router.get('/dashboard', ctrl.dashboard)
router.get('/users', ctrl.users)
router.get('/users/:userId', ctrl.user)
router.patch('/users/:userId/status', ctrl.toggleStatus)
router.get('/transactions', ctrl.transactions)
router.get('/payments/:paymentId', ctrl.payment)
router.get('/contracts', ctrl.contracts)
router.get('/contracts/:contractId', ctrl.contract)
router.get('/reviews', ctrl.reviews)
router.patch('/reviews/:reviewId', validateModerateReview, ctrl.moderateReview)
router.get('/issues', ctrl.issues)
router.patch('/issues/:issueId/resolve', validateResolveIssue, ctrl.resolveIssue)
router.get('/actions', ctrl.actions)
router.get('/jobs/open', ctrl.openJobs)
router.get('/profile/:adminId', ctrl.getProfile)
router.put('/profile/:adminId', validateAdminProfile, ctrl.editProfile)

module.exports = router
