// Phase 11: opt-in paging on client jobs, contracts, payments, freelancer bids, open jobs. Stubbed models only.
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test_secret_test_secret_test_secret_123'
const test = require('node:test')
const assert = require('node:assert/strict')
const Job = require('../src/models/Job')
const Contract = require('../src/models/Contract')
const Payment = require('../src/models/Payment')
const Bid = require('../src/models/Bid')
const User = require('../src/models/User')
const ClientProfile = require('../src/models/ClientProfile')
const bidService = require('../src/services/bidService')
const jobs = require('../src/services/jobService')
const contracts = require('../src/services/contractService')
const { findPaged } = require('../src/utils/pagination')
const { okPaged } = require('../src/utils/response')

const A = 'a'.repeat(24), B = 'b'.repeat(24)
const chain = (rows, spy = {}) => { const p = Promise.resolve(rows); const c = { sort: (s) => { spy.sort = s; return c }, skip: (n) => { spy.skip = n; return c }, limit: (n) => { spy.limit = n; return c }, select: () => c, then: p.then.bind(p), catch: p.catch.bind(p) }; return c }

test('findPaged: legacy cap vs cap 0 vs paged', async (t) => {
  const spy = {}
  t.mock.method(Job, 'find', () => chain([], spy))
  t.mock.method(Job, 'countDocuments', async () => 41)
  let r = await findPaged(Job, {}, { _id: -1 }, {}, 200)
  assert.equal(spy.limit, 200); assert.equal(r.pg, null); assert.equal(r.total, null)
  delete spy.limit
  r = await findPaged(Job, {}, { _id: -1 }, {}, 0)
  assert.equal(spy.limit, undefined) // no .limit() call at all
  r = await findPaged(Job, {}, { _id: -1 }, { page: '3', limit: '20' }, 200)
  assert.equal(spy.skip, 40); assert.equal(spy.limit, 20); assert.equal(r.total, 41)
})

test('okPaged: sets X-* headers only when pageInfo exists', () => {
  const sent = {}
  const res = { set(h) { Object.assign(sent, h); return this }, status() { return this }, json(b) { sent.body = b; return this } }
  okPaged(res, [1])
  assert.equal(sent['X-Total-Count'], undefined)
  const rows = [1, 2]; Object.defineProperty(rows, 'pageInfo', { value: { page: 2, limit: 2, total: 5, totalPages: 3 } })
  okPaged(res, rows)
  assert.deepEqual([sent['X-Total-Count'], sent['X-Page'], sent['X-Limit'], sent['X-Total-Pages']], ['5', '2', '2', '3'])
  assert.deepEqual(sent.body.data, [1, 2])
})

test('client jobs: status filter validated, paging + count, scoped to the client', async (t) => {
  const spy = {}; let f
  t.mock.method(Job, 'find', (x) => { f = x; return chain([], spy) })
  t.mock.method(Job, 'countDocuments', async () => 9)
  const rows = await jobs.listForClient(A, { status: 'Draft', page: '2', limit: '5' })
  assert.deepEqual(f, { clientId: A, status: 'Draft' })
  assert.equal(spy.skip, 5)
  assert.deepEqual(rows.pageInfo, { page: 2, limit: 5, total: 9, totalPages: 2 })
  await jobs.listForClient(A, { status: 'bogus' })
  assert.deepEqual(f, { clientId: A }) // junk status ignored; legacy path
  assert.equal(spy.limit, 200)
})

test('contracts (client + freelancer): status filter + paging', async (t) => {
  const spy = {}; const seen = []
  t.mock.method(Contract, 'find', (x) => { seen.push(x); return chain([], spy) })
  t.mock.method(Contract, 'countDocuments', async () => 3)
  t.mock.method(Job, 'find', () => chain([]))
  t.mock.method(User, 'find', () => chain([]))
  t.mock.method(ClientProfile, 'find', () => chain([]))
  const a = await contracts.listForClient(A, { status: 'Active', page: '1', limit: '2' })
  const b = await contracts.listForFreelancer(B, { status: 'nope', page: '1', limit: '2' })
  assert.deepEqual(seen, [{ clientId: A, status: 'Active' }, { freelancerId: B }])
  assert.deepEqual(a.pageInfo, { page: 1, limit: 2, total: 3, totalPages: 2 })
  assert.equal(b.pageInfo.total, 3)
})

test('freelancer bids: unbounded without paging (no .limit), paged with status', async (t) => {
  const spy = {}; let f
  t.mock.method(Bid, 'find', (x) => { f = x; return chain([], spy) })
  t.mock.method(Bid, 'countDocuments', async () => 4)
  t.mock.method(Job, 'find', () => chain([]))
  t.mock.method(Contract, 'find', async () => [])
  const all = await bidService.listForFreelancer(A)
  assert.equal(all.pageInfo, undefined); assert.equal(spy.limit, undefined)
  const p = await bidService.listForFreelancer(A, { status: 'Pending', page: '1', limit: '3' })
  assert.deepEqual(f, { freelancerId: A, status: 'Pending' })
  assert.deepEqual(p.pageInfo, { page: 1, limit: 3, total: 4, totalPages: 2 })
})
