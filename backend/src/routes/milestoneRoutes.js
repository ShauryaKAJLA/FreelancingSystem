const router = require('express').Router()
const ctrl = require('../controllers/milestoneController')
const { authenticate, requireRole } = require('../middleware/auth')
const { validateMilestoneBody, validateRejectMilestone } = require('../validators/milestoneValidators')

// Mounted at /api/milestones. (POST /contracts/:contractId/milestones lives in contractRoutes.)
// Admins are read-only (Phase 6), so every mutation is role-locked to the party that owns the action.
router.put('/:milestoneId', authenticate, requireRole('Client'), validateMilestoneBody, ctrl.edit)
router.delete('/:milestoneId', authenticate, requireRole('Client'), ctrl.remove)
router.patch('/:milestoneId/submit', authenticate, requireRole('Freelancer'), ctrl.submit)
router.patch('/:milestoneId/reject', authenticate, requireRole('Client'), validateRejectMilestone, ctrl.reject)
// "Approve" (frontend: releaseMilestonePayment). Funding itself is Phase 4.
router.post('/:milestoneId/release-payment', authenticate, requireRole('Client'), ctrl.approve)

module.exports = router
