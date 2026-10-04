const router = require('express').Router()
const ctrl = require('../controllers/profileController')
const pay = require('../controllers/paymentController')
const { authenticate, requireRole, requireOwnership } = require('../middleware/auth')
const { validateClientProfile } = require('../validators/profileValidators')
const jobCtrl = require('../controllers/jobController')
const contractCtrl = require('../controllers/contractController')
const dash = require('../controllers/dashboardController')
const { validatePaymentMethod } = require('../validators/paymentValidators')

const own = [authenticate, requireRole('Client', 'Admin'), requireOwnership('clientId')]

router.get('/:clientId/profile', authenticate, ctrl.getClient)
router.get('/:clientId/dashboard', ...own, dash.client)
router.get('/:clientId/jobs', ...own, jobCtrl.listForClient)
router.put('/:clientId/profile', ...own, validateClientProfile, ctrl.updateClient)
router.get('/:clientId/contracts', ...own, contractCtrl.listForClient)

// Phase 5
router.get('/:clientId/payments', ...own, pay.listForClient)
router.get('/:clientId/payment-methods', ...own, pay.listMethods)
router.post('/:clientId/payment-methods', authenticate, requireRole('Client'), requireOwnership('clientId'), validatePaymentMethod, pay.addMethod)

module.exports = router
