const asyncHandler = require('../utils/asyncHandler')
const { ok, created, okPaged } = require('../utils/response')
const ApiError = require('../utils/ApiError')
const svc = require('../services/paymentService')
const methods = require('../services/paymentMethodService')
const adminActions = require('../services/adminActionService')

exports.createOrder = asyncHandler(async (req, res) => created(res, await svc.createOrder(req.user, req.body.milestoneId), 'Order created'))
exports.verify = asyncHandler(async (req, res) => {
  const result = await svc.verifyPayment(req.user, req.body)
  ok(res, result.payment, result.alreadyProcessed ? 'Payment already verified' : 'Payment verified')
})
// Mounted BEFORE express.json with express.raw: req.body is the untouched Buffer the signature needs.
exports.webhook = asyncHandler(async (req, res) => {
  if (!Buffer.isBuffer(req.body) || !req.body.length) throw new ApiError(400, 'Empty webhook body')
  await svc.handleWebhook(req.body, req.get('x-razorpay-signature'), req.get('x-razorpay-event-id'))
  res.status(200).json({ success: true })
})
exports.get = asyncHandler(async (req, res) => ok(res, await svc.getPayment(req.params.paymentId, req.user)))
exports.listAll = asyncHandler(async (req, res) => ok(res, await svc.listAll(req.user, req.query)))
exports.listForClient = asyncHandler(async (req, res) => okPaged(res, await svc.listForClient(req.params.clientId, req.user, req.query)))
exports.listForFreelancer = asyncHandler(async (req, res) => okPaged(res, await svc.listForFreelancer(req.params.freelancerId, req.user, req.query)))
exports.verifyByAdmin = asyncHandler(async (req, res) => ok(res, await svc.verifyByAdmin(req.params.paymentId), 'Payment marked as verified'))
exports.payout = asyncHandler(async (req, res) => {
  const payment = await svc.dispatchPayout(req.user, req.params.paymentId, req.body.payoutReference)
  await adminActions.logPayout(req.user, payment) // audit trail (never throws)
  ok(res, payment, 'Payout recorded')
})

exports.refund = asyncHandler(async (req, res) => {
  const payment = await svc.refundPayment(req.user, req.params.paymentId, req.body.reason)
  await adminActions.log(req.user, 'Refund Initiated', `Initiated refund of ₹${payment.amount} for payment ${payment.paymentId}${req.body.reason ? ` (${req.body.reason})` : ''}.`)
  ok(res, payment, 'Refund initiated')
})

exports.listMethods = asyncHandler(async (req, res) => ok(res, await methods.list(req.params.clientId)))
exports.addMethod = asyncHandler(async (req, res) => created(res, await methods.add(req.params.clientId, req.body), 'Payment method added'))
exports.removeMethod = asyncHandler(async (req, res) => ok(res, await methods.remove(req.params.paymentMethodId, req.user), 'Payment method removed'))
exports.defaultMethod = asyncHandler(async (req, res) => ok(res, await methods.setDefault(req.params.paymentMethodId, req.user), 'Default payment method updated'))
