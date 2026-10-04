// Phase 4 HTTP-level wiring: the REAL Express app (routes, auth, validators, raw-body webhook, error handler)
// with only the Mongoose models stubbed. Proves route order, role gates, response envelopes and the no-raw-card rule.
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test_secret_test_secret_test_secret_123'
process.env.RAZORPAY_KEY_ID = 'rzp_test_key'
process.env.RAZORPAY_KEY_SECRET = 'test_key_secret_value'
process.env.RAZORPAY_WEBHOOK_SECRET = 'test_webhook_secret_value'

const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')
const app = require('../src/app')
const User = require('../src/models/User')
const Payment = require('../src/models/Payment')
const Milestone = require('../src/models/Milestone')
const Contract = require('../src/models/Contract')
const Job = require('../src/models/Job')
const PaymentMethod = require('../src/models/PaymentMethod')
const WebhookEvent = require('../src/models/WebhookEvent')
const FreelancerProfile = require('../src/models/FreelancerProfile')
const notifications = require('../src/services/notificationService')
const { signToken } = require('../src/utils/jwt')
const rzp = require('../src/services/razorpayService')

const ids = { client: 'a'.repeat(24), free: 'b'.repeat(24), other: 'c'.repeat(24), admin: '9'.repeat(24), ct: '1'.repeat(24), ms: '2'.repeat(24), pay: '3'.repeat(24), job: 'd'.repeat(24) }
const users = {
  [ids.client]: { _id: ids.client, role: 'Client', name: 'Aisha', status: 'Active' },
  [ids.free]: { _id: ids.free, role: 'Freelancer', name: 'Meera', status: 'Active' },
  [ids.other]: { _id: ids.other, role: 'Client', name: 'Rohan', status: 'Active' },
  [ids.admin]: { _id: ids.admin, role: 'Admin', name: 'Admin', status: 'Active' },
}
const tok = (id) => signToken(users[id])
const chain = (rows) => { const c = { sort: () => c, limit: () => c, skip: () => c, select: () => c, then: (res, rej) => Promise.resolve(rows).then(res, rej) }; return c }
const pay = (o = {}) => ({ _id: ids.pay, milestoneId: ids.ms, contractId: ids.ct, clientId: ids.client, freelancerId: ids.free, amount: 500, currency: 'INR', providerOrderId: 'order_ABC123456', status: 'Awaiting Payout', paidAt: new Date('2025-03-01T00:00:00Z'), ...o })

let server, base
test.before(async () => {
  server = http.createServer(app)
  await new Promise((r) => server.listen(0, r))
  base = `http://127.0.0.1:${server.address().port}/api`
})
test.after(() => new Promise((r) => server.close(r)))

const req = async (method, path, { token, body, raw, headers } = {}) => {
  const res = await fetch(base + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: raw ?? (body ? JSON.stringify(body) : undefined),
  })
  return { status: res.status, json: await res.json().catch(() => null) }
}

test.beforeEach((t) => {
  t.mock.method(User, 'findById', async (id) => users[String(id)] ?? null)
  t.mock.method(notifications, 'notify', async () => null)
  t.mock.method(notifications, 'notifyMany', async () => null)
})

test('auth + role gates on the money routes', async () => {
  assert.equal((await req('GET', `/payments/${ids.pay}`)).status, 401)
  assert.equal((await req('POST', '/payments/create-order', { token: tok(ids.free), body: { milestoneId: ids.ms } })).status, 403)
  assert.equal((await req('POST', `/payments/${ids.pay}/payout`, { token: tok(ids.client), body: {} })).status, 403)
  assert.equal((await req('POST', `/payments/${ids.pay}/verify-admin`, { token: tok(ids.client) })).status, 403)
  assert.equal((await req('POST', `/milestones/${ids.ms}/release-payment`, { token: tok(ids.free) })).status, 403)
  assert.equal((await req('GET', `/clients/${ids.client}/payments`, { token: tok(ids.other) })).status, 403)
  assert.equal((await req('GET', `/freelancers/${ids.free}/payments`, { token: tok(ids.client) })).status, 403)
})

test('GET /clients/:id/payments returns { success, data: [ ...frontend rows ] }', async (t) => {
  t.mock.method(Payment, 'find', () => chain([pay({ status: 'Held', providerPaymentId: 'pay_1' })]))
  t.mock.method(Milestone, 'find', () => chain([{ _id: ids.ms, title: 'Backend' }]))
  t.mock.method(Contract, 'find', () => chain([{ _id: ids.ct, jobId: ids.job }]))
  t.mock.method(Job, 'find', () => chain([{ _id: ids.job, title: 'Mobile API' }]))
  t.mock.method(User, 'find', () => chain([users[ids.free]]))
  const r = await req('GET', `/clients/${ids.client}/payments`, { token: tok(ids.client) })
  assert.equal(r.status, 200)
  assert.equal(r.json.success, true)
  assert.ok(Array.isArray(r.json.data))
  assert.deepEqual(Object.keys(r.json.data[0]).sort(), ['adminVerified', 'adminVerifiedAt', 'amount', 'approvedAt', 'contractId', 'freelancerName', 'jobTitle', 'milestoneId', 'milestoneTitle', 'paymentDate', 'paymentId', 'paymentStatus', 'payoutId', 'payoutTo', 'razorpayPaymentId'])
})

test('POST /payments/:id/verify-admin is routed (not swallowed by /verify or GET /:id) and admin-only', async (t) => {
  t.mock.method(Payment, 'findOneAndUpdate', async (f, u) => pay({ ...u.$set }))
  const r = await req('POST', `/payments/${ids.pay}/verify-admin`, { token: tok(ids.admin) })
  assert.equal(r.status, 200)
  assert.equal(r.json.data.adminVerified, true)
})

test('POST /payments/:id/payout: 400 with the mock string when the freelancer has no payout account', async (t) => {
  t.mock.method(Payment, 'findById', async () => pay())
  t.mock.method(FreelancerProfile, 'findOne', () => chain({ paymentAccount: null }))
  const r = await req('POST', `/payments/${ids.pay}/payout`, { token: tok(ids.admin), body: {} })
  assert.equal(r.status, 400)
  assert.equal(r.json.message, 'The freelancer has not added a payout account (bank/UPI) yet.')
})

test('payment methods: raw card number -> 400, brand/last4 -> 201 with the frontend DTO; other client -> 403', async (t) => {
  const raw = await req('POST', `/clients/${ids.client}/payment-methods`, { token: tok(ids.client), body: { type: 'Card', cardNumber: '4242424242424242', brand: 'Visa', last4: '4242', expiry: '09/40', holderName: 'Aisha' } })
  assert.equal(raw.status, 400)
  assert.match(JSON.stringify(raw.json), /Raw card details/)
  t.mock.method(PaymentMethod, 'countDocuments', async () => 0)
  t.mock.method(PaymentMethod, 'exists', async () => null)
  t.mock.method(PaymentMethod, 'create', async (d) => ({ _id: ids.pay, ...d }))
  const ok = await req('POST', `/clients/${ids.client}/payment-methods`, { token: tok(ids.client), body: { type: 'Card', brand: 'Visa', last4: '4242', expiry: '09/40', holderName: 'Aisha' } })
  assert.equal(ok.status, 201)
  assert.deepEqual(ok.json.data, { paymentMethodId: ids.pay, clientId: ids.client, type: 'Card', brand: 'Visa', last4: '4242', expiry: '09/40', holderName: 'Aisha', isDefault: true })
  assert.equal((await req('POST', `/clients/${ids.client}/payment-methods`, { token: tok(ids.other), body: { type: 'Card', brand: 'Visa', last4: '4242', expiry: '09/40', holderName: 'x' } })).status, 403)
})

test('webhook over HTTP: signature is verified on the raw bytes; duplicate delivery acknowledged', async (t) => {
  const rawBody = '{"event":"payment.failed",  "payload":{"payment":{"entity":{"order_id":"order_none"}}}}'
  const sig = rzp.hmacHex('test_webhook_secret_value', rawBody)
  const hdr = (s, e) => ({ 'Content-Type': 'application/json', 'x-razorpay-signature': s, 'x-razorpay-event-id': e })
  assert.equal((await req('POST', '/payments/webhook', { raw: rawBody, headers: hdr('0'.repeat(64), 'e1') })).status, 400)
  assert.equal((await req('POST', '/payments/webhook', { raw: JSON.stringify(JSON.parse(rawBody)), headers: hdr(sig, 'e1') })).status, 400) // re-serialised body
  let seen = 0
  t.mock.method(WebhookEvent, 'create', async () => { seen += 1; if (seen > 1) { const e = new Error('dup'); e.code = 11000; throw e } return {} })
  t.mock.method(Payment, 'findOneAndUpdate', async () => null)
  assert.equal((await req('POST', '/payments/webhook', { raw: rawBody, headers: hdr(sig, 'e2') })).status, 200)
  assert.equal((await req('POST', '/payments/webhook', { raw: rawBody, headers: hdr(sig, 'e2') })).status, 200)
})

// ---- Phase 7 additions: refund route gate, request id, readiness
test('POST /payments/:id/refund is admin-only, validated, and errors carry a request id', async (t) => {
  assert.equal((await req('POST', `/payments/${ids.pay}/refund`, { body: {} })).status, 401)
  assert.equal((await req('POST', `/payments/${ids.pay}/refund`, { token: tok(ids.client), body: {} })).status, 403)
  assert.equal((await req('POST', `/payments/${ids.pay}/refund`, { token: tok(ids.admin), body: { reason: 'x'.repeat(301) } })).status, 400)
  t.mock.method(Payment, 'findById', async () => null)
  const r = await req('POST', `/payments/${ids.pay}/refund`, { token: tok(ids.admin), body: { reason: 'duplicate' } })
  assert.equal(r.status, 404)
  assert.ok(r.json.requestId)
})

test('X-Request-Id is generated, and a safe incoming one is echoed', async () => {
  const a = await fetch(base + '/health')
  assert.match(a.headers.get('x-request-id'), /^[0-9a-f-]{36}$/)
  const b = await fetch(base + '/health', { headers: { 'X-Request-Id': 'trace-12345678' } })
  assert.equal(b.headers.get('x-request-id'), 'trace-12345678')
  const c = await fetch(base + '/health', { headers: { 'X-Request-Id': 'bad id\twith spaces' } }).catch(() => null)
  if (c) assert.notEqual(c.headers.get('x-request-id'), 'bad id\twith spaces')
})

test('GET /health/ready is 503 when Mongo is not connected; CORS rejects other origins', async () => {
  const r = await fetch(base + '/health/ready')
  assert.equal(r.status, 503)
  const cors = await fetch(base + '/health', { headers: { Origin: 'https://evil.example' } })
  assert.equal(cors.headers.get('access-control-allow-origin'), null)
  const okOrigin = await fetch(base + '/health', { headers: { Origin: 'http://localhost:5173' } })
  assert.equal(okOrigin.headers.get('access-control-allow-origin'), 'http://localhost:5173')
})
