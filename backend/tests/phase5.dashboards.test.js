// Phase 5 (slice 2): dashboards. Real Express app over HTTP; only Mongoose models stubbed.
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test_secret_test_secret_test_secret_123'

const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')
const app = require('../src/app')
const User = require('../src/models/User')
const Job = require('../src/models/Job')
const Bid = require('../src/models/Bid')
const Contract = require('../src/models/Contract')
const Payment = require('../src/models/Payment')
const FreelancerProfile = require('../src/models/FreelancerProfile')
const { signToken } = require('../src/utils/jwt')

const ids = { client: 'a'.repeat(24), free: 'b'.repeat(24), other: 'c'.repeat(24), j1: '1'.repeat(24), j2: '2'.repeat(24), b1: '5'.repeat(24) }
const users = {
  [ids.client]: { _id: ids.client, role: 'Client', name: 'Aisha', status: 'Active' },
  [ids.free]: { _id: ids.free, role: 'Freelancer', name: 'Meera', status: 'Active' },
  [ids.other]: { _id: ids.other, role: 'Client', name: 'Rohan', status: 'Active' },
}
const tok = (id) => signToken(users[id])
const chain = (rows) => { const c = { sort: () => c, limit: () => c, select: () => c, then: (res, rej) => Promise.resolve(rows).then(res, rej) }; return c }

let server, base
test.before(async () => { server = http.createServer(app); await new Promise((r) => server.listen(0, r)); base = `http://127.0.0.1:${server.address().port}/api` })
test.after(() => new Promise((r) => server.close(r)))
const get = async (path, token) => {
  const res = await fetch(base + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  return { status: res.status, json: await res.json().catch(() => null) }
}
test.beforeEach((t) => { t.mock.method(User, 'findById', async (id) => users[String(id)] ?? null) })

test('client dashboard: mock output keys, counts scoped to the client, pendingBids counts Pending+Updated', async (t) => {
  const seen = []
  t.mock.method(Job, 'countDocuments', async (f) => { seen.push(f); return f.status === 'Published' ? 3 : 2 })
  t.mock.method(Contract, 'countDocuments', async (f) => { seen.push(f); return 1 })
  let bidFilter
  t.mock.method(Bid, 'countDocuments', async (f) => { bidFilter = f; return 4 })
  const jobDocs = [{ _id: ids.j1, clientId: ids.client, title: 'A', description: 'd', budget: 10, status: 'Published', createdAt: new Date('2025-09-01T00:00:00Z') }]
  t.mock.method(Job, 'find', () => chain(jobDocs))
  const r = await get(`/clients/${ids.client}/dashboard`, tok(ids.client))
  assert.equal(r.status, 200)
  assert.deepEqual(Object.keys(r.json.data).sort(), ['activeContracts', 'draftJobs', 'openJobs', 'pendingBids', 'recentJobs'])
  assert.equal(r.json.data.openJobs, 3)
  assert.equal(r.json.data.draftJobs, 2)
  assert.equal(r.json.data.activeContracts, 1)
  assert.equal(r.json.data.pendingBids, 4)
  assert.deepEqual(bidFilter.status, { $in: ['Pending', 'Updated'] })
  assert.ok(seen.every((f) => String(f.clientId) === ids.client), 'every count is scoped to the requesting client')
  assert.equal(r.json.data.recentJobs[0].jobId, ids.j1)
})

test('dashboards are owner-only', async () => {
  assert.equal((await get(`/clients/${ids.client}/dashboard`)).status, 401)
  assert.equal((await get(`/clients/${ids.client}/dashboard`, tok(ids.other))).status, 403)
  assert.equal((await get(`/clients/${ids.client}/dashboard`, tok(ids.free))).status, 403)
  assert.equal((await get(`/freelancers/${ids.free}/dashboard`, tok(ids.client))).status, 403)
})

test('freelancer dashboard: mock output keys; totalEarned sums Paid payments; rating from the profile; recentBids carry jobTitle', async (t) => {
  t.mock.method(Bid, 'countDocuments', async (f) => { assert.equal(f.status, 'Pending'); return 2 })
  t.mock.method(Contract, 'countDocuments', async () => 1)
  let match
  t.mock.method(Payment, 'aggregate', async (pipe) => { match = pipe[0].$match; return [{ _id: null, total: 36000 }] })
  t.mock.method(FreelancerProfile, 'findOne', () => chain({ rating: 4.8 }))
  t.mock.method(Bid, 'find', () => chain([{ _id: ids.b1, jobId: ids.j2, freelancerId: ids.free, bidAmount: 100, status: 'Pending', bidDate: new Date('2025-09-02T00:00:00Z'), proposal: 'p' }]))
  t.mock.method(Job, 'find', () => chain([{ _id: ids.j2, title: 'Landing page' }]))
  const r = await get(`/freelancers/${ids.free}/dashboard`, tok(ids.free))
  assert.equal(r.status, 200)
  assert.deepEqual(Object.keys(r.json.data).sort(), ['activeContracts', 'pendingBids', 'rating', 'recentBids', 'totalEarned'])
  assert.equal(r.json.data.totalEarned, 36000)
  assert.equal(r.json.data.rating, 4.8)
  assert.equal(r.json.data.recentBids[0].jobTitle, 'Landing page')
  assert.equal(r.json.data.recentBids[0].bidId, ids.b1)
  assert.equal(match.status, 'Paid')
  assert.equal(String(match.freelancerId), ids.free)
})

test('freelancer dashboard with nothing yet: zeros and rating null, no crash', async (t) => {
  t.mock.method(Bid, 'countDocuments', async () => 0)
  t.mock.method(Contract, 'countDocuments', async () => 0)
  t.mock.method(Payment, 'aggregate', async () => [])
  t.mock.method(FreelancerProfile, 'findOne', () => chain(null))
  t.mock.method(Bid, 'find', () => chain([]))
  const r = await get(`/freelancers/${ids.free}/dashboard`, tok(ids.free))
  assert.deepEqual(r.json.data, { pendingBids: 0, activeContracts: 0, totalEarned: 0, rating: null, recentBids: [] })
})
