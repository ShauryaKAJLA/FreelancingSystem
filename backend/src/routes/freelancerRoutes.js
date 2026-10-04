const router = require('express').Router()
const ctrl = require('../controllers/profileController')
const { authenticate, requireRole, requireOwnership } = require('../middleware/auth')
const { validateFreelancerProfile, validateFreelancerExtras } = require('../validators/profileValidators')
const { validateFreelancerQuery } = require('../validators/jobValidators')
const jobCtrl = require('../controllers/jobController')
const pay = require('../controllers/paymentController')
const bidCtrl = require('../controllers/bidController')
const contractCtrl = require('../controllers/contractController')
const dash = require('../controllers/dashboardController')

// Discovery (registered before the /:freelancerId routes). Clients hire, admins oversee.
router.get('/', authenticate, requireRole('Client', 'Admin'), validateFreelancerQuery, ctrl.searchFreelancers)
router.get('/:freelancerId', authenticate, ctrl.getFreelancer)
router.get('/:freelancerId/profile', authenticate, ctrl.getFreelancer)
router.put('/:freelancerId/profile', authenticate, requireRole('Freelancer', 'Admin'), requireOwnership('freelancerId'), validateFreelancerProfile, ctrl.updateFreelancer)

router.put('/:freelancerId/extras', authenticate, requireRole('Freelancer', 'Admin'), requireOwnership('freelancerId'), validateFreelancerExtras, ctrl.updateFreelancerExtras)
router.get('/:freelancerId/jobs/:jobId', authenticate, requireRole('Freelancer', 'Admin'), requireOwnership('freelancerId'), jobCtrl.getForFreelancer)

// Phase 5
router.get('/:freelancerId/dashboard', authenticate, requireRole('Freelancer', 'Admin'), requireOwnership('freelancerId'), dash.freelancer)

// Phase 3
router.get('/:freelancerId/bids', authenticate, requireRole('Freelancer', 'Admin'), requireOwnership('freelancerId'), bidCtrl.listForFreelancer)
router.get('/:freelancerId/contracts', authenticate, requireRole('Freelancer', 'Admin'), requireOwnership('freelancerId'), contractCtrl.listForFreelancer)

// Phase 5
router.get('/:freelancerId/payments', authenticate, requireRole('Freelancer', 'Admin'), requireOwnership('freelancerId'), pay.listForFreelancer)

module.exports = router
