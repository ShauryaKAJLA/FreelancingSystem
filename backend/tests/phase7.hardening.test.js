// Phase 7: env validation, request ids, readiness, refund rules + service (models/Razorpay stubbed), admin-script input.
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test_secret_test_secret_test_secret_123'
process.env.RAZORPAY_KEY_ID = 'rzp_test_key'
process.env.RAZORPAY_KEY_SECRET = 'test_key_secret_value'
process.env.RAZORPAY_WEBHOOK_SECRET = 'test_webhook_secret_value'

const test = require('node:test')
const assert = require('node:assert/strict')
const { findEnvProblems, validateEnv } = require('../src/config/env')
const { validateAdminInput } = require('../src/utils/createAdmin')
const Payment = require('../src/models/Payment')
const notifications = require('../src/services/notificationService')
const rzp = require('../src/services/razorpayService')
const svc = require('../src/services/paymentService')

const goodProd = {
  nodeEnv: 'production', jwtSecret: 'x'.repeat(40), mongoUri: 'mongodb+srv://u:p@cluster.mongodb.net/ff',
  razorpayKeyId: 'rzp_live_a', razorpayKeySecret: 'b', razorpayWebhookSecret: 'c', clientUrl: 'https://app.example.com',
}
const goodProcessEnv = { MONGODB_URI: 'set', CLIENT_URL: 'set' }

test('env: non-production never fails; a complete production config passes', () => {
  assert.deepEqual(findEnvProblems({ nodeEnv: 'development', jwtSecret: 'change_this_secret' }, {}), [])
  assert.deepEqual(findEnvProblems(goodProd, goodProcessEnv), [])
  assert.doesNotThrow(() => validateEnv(goodProd, goodProcessEnv))
})

test('env: production reports every problem at once', () => {
  const bad = { nodeEnv: 'production', jwtSecret: 'change_this_secret', mongoUri: 'mongodb://127.0.0.1/x', razorpayKeyId: '', razorpayKeySecret: '', razorpayWebhookSecret: '', clientUrl: '*' }
  const problems = findEnvProblems(bad, { MONGODB_URI: 'x', CLIENT_URL: '*' })
  assert.ok(problems.length >= 5)
  assert.throws(() => validateEnv(bad, { MONGODB_URI: 'x', CLIENT_URL: '*' }), /Invalid production configuration/)
  assert.ok(findEnvProblems(goodProd, {}).some((p) => /MONGODB_URI is required/.test(p)))
})

test('create-admin input validation', () => {
  assert.deepEqual(validateAdminInput({ name: 'Ops', email: 'ops@example.com', password: 'LongPassword123' }), [])
  assert.equal(validateAdminInput({}).length, 3)
  assert.ok(validateAdminInput({ name: 'Ops', email: 'ops@example.com', password: 'short1' }).length === 1)
})

test('refundRules', () => {
  const ok = { status: 'Held', providerPaymentId: 'pay_1', refundRequestedAt: null }
  assert.equal(svc.refundRules.status(ok), null)
  assert.match(svc.refundRules.status({ ...ok, status: 'Awaiting Payout' }), /still held in escrow/)
  assert.match(svc.refundRules.status({ ...ok, status: 'Paid' }), /still held in escrow/)
  assert.match(svc.refundRules.status({ ...ok, status: 'Refunded' }), /already been refunded/)
  assert.match(svc.refundRules.status({ ...ok, refundRequestedAt: new Date() }), /already been requested/)
  assert.match(svc.refundRules.status({ ...ok, providerPaymentId: undefined }), /no captured/)
})

const ID = 'a'.repeat(24)
const doc = (o = {}) => ({ _id: ID, milestoneId: 'b'.repeat(24), contractId: 'c'.repeat(24), clientId: 'd'.repeat(24), freelancerId: 'e'.repeat(24), amount: 500, status: 'Held', providerPaymentId: 'pay_1', refundRequestedAt: null, ...o })
const admin = { _id: 'f'.repeat(24), role: 'Admin' }

test('refundPayment: claims atomically, calls Razorpay once, stores refund id', async (t) => {
  let claimFilter, refundedId
  t.mock.method(Payment, 'findById', async () => doc())
  t.mock.method(Payment, 'findOneAndUpdate', async (filter, update) => {
    if (update.$set.refundRequestedAt) { claimFilter = filter; return doc({ refundRequestedAt: new Date() }) }
    return doc({ refundId: update.$set.refundId, refundRequestedAt: new Date() })
  })
  t.mock.method(rzp, 'refundPayment', async (id) => { refundedId = id; return { id: 'rfnd_1' } })
  t.mock.method(notifications, 'notifyMany', async () => null)
  const out = await svc.refundPayment(admin, ID, 'client cancelled')
  assert.deepEqual({ status: claimFilter.status, refundRequestedAt: claimFilter.refundRequestedAt }, { status: 'Held', refundRequestedAt: null })
  assert.equal(refundedId, 'pay_1')
  assert.ok(out)
})

test('refundPayment: Razorpay failure releases the claim so it can be retried', async (t) => {
  const updates = []
  t.mock.method(Payment, 'findById', async () => doc())
  t.mock.method(Payment, 'findOneAndUpdate', async () => doc({ refundRequestedAt: new Date() }))
  t.mock.method(Payment, 'updateOne', async (f, u) => { updates.push(u); return {} })
  t.mock.method(rzp, 'refundPayment', async () => { throw Object.assign(new Error('boom'), { statusCode: 502 }) })
  await assert.rejects(() => svc.refundPayment(admin, ID), /boom/)
  assert.equal(updates.length, 1)
  assert.equal(updates[0].$set.refundRequestedAt, null)
})

test('refundPayment: not-held, missing and lost-race cases are rejected without calling Razorpay', async (t) => {
  let called = 0
  t.mock.method(rzp, 'refundPayment', async () => { called++; return {} })
  t.mock.method(Payment, 'findById', async () => null)
  await assert.rejects(() => svc.refundPayment(admin, ID), (e) => e.statusCode === 404)
  await assert.rejects(() => svc.refundPayment(admin, 'nope'), (e) => e.statusCode === 400)
  t.mock.method(Payment, 'findById', async () => doc({ status: 'Paid' }))
  await assert.rejects(() => svc.refundPayment(admin, ID), (e) => e.statusCode === 400)
  t.mock.method(Payment, 'findById', async () => doc())
  t.mock.method(Payment, 'findOneAndUpdate', async () => null) // someone else claimed it first
  await assert.rejects(() => svc.refundPayment(admin, ID), (e) => e.statusCode === 400)
  assert.equal(called, 0)
})
