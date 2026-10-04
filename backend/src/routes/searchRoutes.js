const router = require('express').Router()
const ctrl = require('../controllers/searchController')
const { authenticate, requireRole } = require('../middleware/auth')

router.get('/client', authenticate, requireRole('Client'), ctrl.client)
router.get('/freelancer', authenticate, requireRole('Freelancer'), ctrl.freelancer)
router.get('/admin', authenticate, requireRole('Admin'), ctrl.admin)

module.exports = router
