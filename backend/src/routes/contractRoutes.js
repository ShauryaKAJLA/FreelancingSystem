const router = require('express').Router()
const ctrl = require('../controllers/contractController')
const reviewCtrl = require('../controllers/reviewController')
const { authenticate, requireRole } = require('../middleware/auth')
const { validateReview } = require('../validators/reviewValidators')
const { validateCancelContract, validateTerminationRequest, validateTerminationResponse } = require('../validators/contractValidators')
const { validateMilestoneBody } = require('../validators/milestoneValidators')

const party = ['Client', 'Freelancer'] // admins are read-only and get their own routes in Phase 6

// Non-parties always get 404 (checked in the service), so contract ids can't be probed.
router.get('/:contractId', authenticate, requireRole(...party), ctrl.get)
router.patch('/:contractId/start', authenticate, requireRole('Client'), ctrl.start)
router.patch('/:contractId/complete', authenticate, requireRole('Client'), ctrl.complete)
router.patch('/:contractId/cancel', authenticate, requireRole('Client'), validateCancelContract, ctrl.cancel)
router.post('/:contractId/termination-request', authenticate, requireRole(...party), validateTerminationRequest, ctrl.requestTermination)
router.post('/:contractId/termination-response', authenticate, requireRole(...party), validateTerminationResponse, ctrl.respondToTermination)
router.post('/:contractId/milestones', authenticate, requireRole('Client'), validateMilestoneBody, ctrl.createMilestone)
router.post('/:contractId/reviews', authenticate, validateReview, reviewCtrl.submit)

module.exports = router
