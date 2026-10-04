const router = require('express').Router()

const mongoose = require('mongoose')
// Liveness: the process is up. Readiness: it can actually serve (Mongo connected; readyState 1 = connected).
router.get('/health', (_req, res) => res.status(200).json({ success: true, message: 'FreelanceFlow API is running' }))
router.get('/health/ready', (_req, res) => {
  const ready = mongoose.connection.readyState === 1
  res.status(ready ? 200 : 503).json({ success: ready, message: ready ? 'ready' : 'database not connected' })
})
router.use('/auth', require('./authRoutes'))
router.use('/freelancers', require('./freelancerRoutes'))
router.use('/clients', require('./clientRoutes'))
router.use('/users', require('./userRoutes'))
router.use('/jobs', require('./jobRoutes'))
router.use('/skills', require('./skillRoutes'))
router.use('/bids', require('./bidRoutes'))
router.use('/contracts', require('./contractRoutes'))
router.use('/milestones', require('./milestoneRoutes'))
router.use('/payments', require('./paymentRoutes'))
router.use('/payment-methods', require('./paymentMethodRoutes'))
router.use('/messages', require('./messageRoutes'))
router.use('/notifications', require('./notificationRoutes'))
router.use('/admin', require('./adminRoutes'))
router.use('/issues', require('./issueRoutes'))
router.use('/search', require('./searchRoutes'))

module.exports = router
