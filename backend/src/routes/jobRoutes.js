const router = require('express').Router()
const ctrl = require('../controllers/jobController')
const { authenticate, requireRole } = require('../middleware/auth')
const bidCtrl = require('../controllers/bidController')
const v = require('../validators/jobValidators')
const { validateBid } = require('../validators/bidValidators')

// NOTE: /open must be registered before /:jobId or "open" would be read as a job id.
router.get('/open', authenticate, requireRole('Freelancer', 'Admin'), v.validateOpenJobsQuery, ctrl.listOpen)
router.post('/', authenticate, requireRole('Client'), v.validateCreateJob, ctrl.create)
router.get('/:jobId', authenticate, ctrl.get)
router.put('/:jobId', authenticate, requireRole('Client', 'Admin'), v.validateEditJob, ctrl.edit)
router.patch('/:jobId/publish', authenticate, requireRole('Client', 'Admin'), ctrl.publish)
router.patch('/:jobId/cancel', authenticate, requireRole('Client', 'Admin'), v.validateCancelJob, ctrl.cancel)
router.delete('/:jobId', authenticate, requireRole('Client', 'Admin'), ctrl.remove)

// Phase 3: bidding and hiring
router.post('/:jobId/bids', authenticate, requireRole('Freelancer'), validateBid, bidCtrl.submit)
router.post('/:jobId/bids/:bidId/accept', authenticate, requireRole('Client'), bidCtrl.accept)

module.exports = router
