// Phase 5 (slice 1): reviews. Real Express app over HTTP, Mongoose models stubbed.
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test_secret_test_secret_test_secret_123'

const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')
const app = require('../src/app')
const User = require('../src/models/User')
const Review = require('../src/models/Review')
const Contract = require('../src/models/Contract')
const FreelancerProfile = require('../src/models/FreelancerProfile')
const notifications = require('../src/services/notificationService')
const { signToken } = require('../src/utils/jwt')

const ids = { client: 'a'.repeat(24), free: 'b'.repeat(24), other: 'c'.repeat(24), ct: '1'.repeat(24), rv: '5'.repeat(24) }
const users = {
  [ids.client]: { _id: ids.client, role: 'Client', name: 'Aisha', status: 'Active' },
  [ids.free]: { _id: ids.free, role: 'Freelancer', name: 'Meera', status: 'Active' },
  [ids.other]: { _id: ids.other, role: 'Client', name: 'Rohan', status: 'Active' },
}
const tok = (id) => signToken(users[id])
const contract = (o = {}) => ({ _id: ids.ct, clientId: ids.client, freelancerId: ids.free, status: 'Completed', ...o })

let server, base
test.before(async () => { server = http.createServer(app); await new Promise((r) => server.listen(0, r)); base = `http://127.0.0.1:${server.address().port}/api` })
test.after(() => new Promise((r) => server.close(r)))
const post = async (token, body, id = ids.ct) => {
  const res = await fetch(`${base}/contracts/${id}/reviews`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) })
  return { status: res.status, json: await res.json().catch(() => null) }
}

test.beforeEach((t) => {
  t.mock.method(User, 'findById', (id) => { const u = users[String(id)] ?? null; const p = Promise.resolve(u); p.select = () => Promise.resolve(u); return p })
  t.mock.method(notifications, 'notify', async () => null)
})

test('client reviews the freelancer: DTO shape, reviewee derived from the contract, forged body ids ignored, rating recomputed', async (t) => {
  t.mock.method(Contract, 'findById', async () => contract())
  let saved
  t.mock.method(Review, 'create', async (d) => { saved = d; return { _id: ids.rv, createdAt: new Date('2025-10-01T00:00:00Z'), ...d } })
  let recomputed = 0
  t.mock.method(Review, 'aggregate', async () => { recomputed += 1; return [{ avg: 4.66 }] })
  let ratingSet
  t.mock.method(FreelancerProfile, 'updateOne', async (f, u) => { ratingSet = u.$set.rating })
  const r = await post(tok(ids.client), { rating: 5, comment: ' Great work ', reviewerId: ids.other, revieweeId: ids.other, status: 'Hidden' })
  assert.equal(r.status, 201)
  assert.deepEqual(r.json.data, { reviewId: ids.rv, contractId: ids.ct, reviewerId: ids.client, revieweeId: ids.free, rating: 5, comment: 'Great work', reviewDate: '2025-10-01T00:00:00.000Z' })
  assert.equal(saved.reviewerId, ids.client)
  assert.equal(saved.revieweeId, ids.free)
  assert.equal('status' in saved, false)
  assert.equal(recomputed, 1)
  assert.equal(ratingSet, 4.7)
})

test('freelancer reviewing the client does not touch any freelancer rating', async (t) => {
  t.mock.method(Contract, 'findById', async () => contract())
  t.mock.method(Review, 'create', async (d) => ({ _id: ids.rv, createdAt: new Date(), ...d }))
  const agg = t.mock.method(Review, 'aggregate', async () => [])
  const r = await post(tok(ids.free), { rating: 4 })
  assert.equal(r.status, 201)
  assert.equal(r.json.data.revieweeId, ids.client)
  assert.equal(agg.mock.callCount(), 0)
})

test('rules: not Completed -> 409, second review -> 409, stranger -> 404, bad rating -> 400', async (t) => {
  t.mock.method(Contract, 'findById', async () => contract({ status: 'Active' }))
  assert.equal((await post(tok(ids.client), { rating: 5 })).status, 409)
  t.mock.method(Contract, 'findById', async () => contract())
  t.mock.method(Review, 'create', async () => { const e = new Error('dup'); e.code = 11000; throw e })
  const dup = await post(tok(ids.client), { rating: 5 })
  assert.equal(dup.status, 409)
  assert.equal(dup.json.message, 'You have already reviewed this contract')
  assert.equal((await post(tok(ids.other), { rating: 5 })).status, 404)
  assert.equal((await post(tok(ids.client), { rating: 6 })).status, 400)
  assert.equal((await post(tok(ids.client), { rating: 4.5 })).status, 400)
  assert.equal((await post(tok(ids.client), { rating: '5' })).status, 400)
})
