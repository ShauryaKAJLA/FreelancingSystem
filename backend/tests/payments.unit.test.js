// Run: npm test   (uses only Node's built-in test runner; no database needed)
process.env.NODE_ENV = 'test'
process.env.RAZORPAY_KEY_ID = 'rzp_test_key'
process.env.RAZORPAY_KEY_SECRET = 'test_key_secret_value'
process.env.RAZORPAY_WEBHOOK_SECRET = 'test_webhook_secret_value'

const test = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const rzp = require('../src/services/razorpayService')
const pv = require('../src/validators/paymentValidators')
const mv = require('../src/validators/messageValidators')
const rv = require('../src/validators/reviewValidators')

const ID = 'a'.repeat(24)
const hmac = (secret, data) => crypto.createHmac('sha256', secret).update(data).digest('hex')
// Runs an express-style validator and returns { error?, body }.
const run = (validator, body) => {
  const req = { body }
  let error
  try { validator(req, {}, () => {}) } catch (e) { error = e }
  return { error, body: req.body }
}

test('toPaise converts rupees to integer paise', () => {
  assert.equal(rzp.toPaise(100), 10000)
  assert.equal(rzp.toPaise(1000), 100000)
  assert.equal(rzp.toPaise(21000), 2100000)
  assert.equal(rzp.toPaise(1.1), 110) // 1.1*100 = 110.00000000000001 in floats
  assert.equal(rzp.toPaise(0.29), 29)
})

test('checkout signature: valid accepted, tampered/malformed rejected', () => {
  const good = hmac('test_key_secret_value', 'order_ABC123|pay_XYZ789')
  assert.equal(rzp.verifyPaymentSignature({ orderId: 'order_ABC123', paymentId: 'pay_XYZ789', signature: good }), true)
  assert.equal(rzp.verifyPaymentSignature({ orderId: 'order_ABC123', paymentId: 'pay_OTHER1', signature: good }), false)
  assert.equal(rzp.verifyPaymentSignature({ orderId: 'order_OTHER1', paymentId: 'pay_XYZ789', signature: good }), false)
  assert.equal(rzp.verifyPaymentSignature({ orderId: 'order_ABC123', paymentId: 'pay_XYZ789', signature: good.slice(0, 40) }), false)
  assert.equal(rzp.verifyPaymentSignature({ orderId: 'order_ABC123', paymentId: 'pay_XYZ789', signature: 'zz'.repeat(32) }), false)
  assert.equal(rzp.verifyPaymentSignature({ orderId: 'order_ABC123', paymentId: 'pay_XYZ789', signature: undefined }), false)
  assert.equal(rzp.verifyPaymentSignature({ orderId: 'order_ABC123', paymentId: 'pay_XYZ789', signature: { $ne: 1 } }), false)
})

test('webhook signature is computed over the raw body bytes', () => {
  const raw = Buffer.from('{"event":"payment.captured"}')
  assert.equal(rzp.verifyWebhookSignature(raw, hmac('test_webhook_secret_value', raw)), true)
  assert.equal(rzp.verifyWebhookSignature(Buffer.from('{"event":"payment.captured" }'), hmac('test_webhook_secret_value', raw)), false)
  assert.equal(rzp.verifyWebhookSignature(raw, hmac('wrong_secret', raw)), false)
})

test('create-order accepts only milestoneId (no amount from the client)', () => {
  const r = run(pv.validateCreateOrder, { milestoneId: ID, amount: 1 })
  assert.equal(r.error, undefined)
  assert.deepEqual(r.body, { milestoneId: ID })
  assert.ok(run(pv.validateCreateOrder, { milestoneId: { $ne: null } }).error)
  assert.ok(run(pv.validateCreateOrder, {}).error)
})

test('verify validator rejects operator injection and bad formats', () => {
  const ok = { razorpay_order_id: 'order_ABC123', razorpay_payment_id: 'pay_XYZ789', razorpay_signature: 'a'.repeat(64) }
  assert.equal(run(pv.validateVerify, ok).error, undefined)
  assert.ok(run(pv.validateVerify, { ...ok, razorpay_order_id: { $ne: null } }).error)
  assert.ok(run(pv.validateVerify, { ...ok, razorpay_signature: 'short' }).error)
  assert.ok(run(pv.validateVerify, { ...ok, razorpay_payment_id: 'x' }).error)
})

test('payment-method validator refuses raw card data and expired cards', () => {
  const card = { type: 'Card', brand: 'Visa', last4: '4242', expiry: '12/99', holderName: 'Aisha Verma' }
  assert.equal(run(pv.validatePaymentMethod, card).error, undefined)
  assert.ok(run(pv.validatePaymentMethod, { ...card, cardNumber: '4242424242424242' }).error)
  assert.ok(run(pv.validatePaymentMethod, { ...card, cvv: '123' }).error)
  assert.ok(run(pv.validatePaymentMethod, { ...card, expiry: '01/20' }).error)
  assert.ok(run(pv.validatePaymentMethod, { ...card, last4: '42424' }).error)
  assert.equal(run(pv.validatePaymentMethod, { type: 'UPI', upiId: 'aisha@okbank' }).error, undefined)
  assert.ok(run(pv.validatePaymentMethod, { type: 'UPI', upiId: 'not-a-upi' }).error)
  assert.ok(run(pv.validatePaymentMethod, { type: 'Crypto' }).error)
})

test('message validator drops senderId and sanitises text', () => {
  const r = run(mv.validateSendMessage, { receiverId: ID, senderId: 'b'.repeat(24), messageText: '  hi <script>alert(1)</script> there\u0000 ' })
  assert.equal(r.error, undefined)
  assert.deepEqual(Object.keys(r.body).sort(), ['messageText', 'receiverId'])
  assert.equal(r.body.messageText, 'hi alert(1) there')
  assert.ok(run(mv.validateSendMessage, { receiverId: ID, messageText: '   ' }).error)
  assert.ok(run(mv.validateSendMessage, { receiverId: ID, messageText: 'x'.repeat(2001) }).error)
  assert.ok(run(mv.validateSendMessage, { receiverId: 'nope', messageText: 'hi' }).error)
})

test('review validator enforces whole-number 1-5 and ignores forged fields', () => {
  const r = run(rv.validateReview, { rating: 5, comment: 'Great <b>work</b>', reviewerId: ID, revieweeId: ID, status: 'Hidden' })
  assert.equal(r.error, undefined)
  assert.deepEqual(r.body, { rating: 5, comment: 'Great work' })
  for (const bad of [0, 6, 4.5, '5', null, undefined]) assert.ok(run(rv.validateReview, { rating: bad }).error, `rating ${bad}`)
  assert.ok(run(rv.validateReview, { rating: 5, comment: 'x'.repeat(1001) }).error)
  assert.ok(run(rv.validateReview, { rating: 5, comment: { a: 1 } }).error)
})
