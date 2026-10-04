// Phase 12: client jobs ?pendingBids=true, paged freelancer discovery. Stubbed models only (no DB).
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test_secret_test_secret_test_secret_123'
const test = require('node:test')
const assert = require('node:assert/strict')
const Job = require('../src/models/Job')
const Bid = require('../src/models/Bid')
const Contract = require('../src/models/Contract')
const FreelancerProfile = require('../src/models/FreelancerProfile')
const jobs = require('../src/services/jobService')
const discovery = require('../src/services/freelancerService')
const { optPagination } = require('../src/utils/pagination')

const A = 'a'.repeat(24), J1 = '1'.repeat(24), J2 = '2'.repeat(24)
const chain = (rows, spy = {}) => { const p = Promise.resolve(rows); const c = { sort: (s) => { spy.sort = s; return c }, skip: (n) => { spy.skip = n; return c }, limit: (n) => { spy.limit = n; return c }, select: () => c, then: p.then.bind(p), catch: p.catch.bind(p) }; return c }

test('client jobs pendingBids=true: filters to the owner\'s jobs that have an open bid, combined with status + paging', async (t) => {
  let jf, distinctArgs, bidDistinct
  t.mock.method(Job, 'distinct', async (field, f) => { distinctArgs = [field, f]; return [J1, J2] })
  t.mock.method(Bid, 'distinct', async (field, f) => { bidDistinct = [field, f]; return [J2] })
  t.mock.method(Job, 'find', (x) => { jf = x; return chain([]) })
  t.mock.method(Job, 'countDocuments', async () => 1)
  const rows = await jobs.listForClient(A, { status: 'Published', pendingBids: 'true', page: '1', limit: '5' })
  assert.deepEqual(distinctArgs, ['_id', { clientId: A, status: 'Published' }]) // owner scope first
  assert.deepEqual(bidDistinct[0], 'jobId')
  assert.deepEqual(bidDistinct[1].status, { $in: ['Pending', 'Updated'] })
  assert.deepEqual(jf, { clientId: A, status: 'Published', _id: { $in: [J2] } })
  assert.equal(rows.pageInfo.total, 1)
})

test('client jobs pendingBids: absent / other values leave the query untouched; no jobs => empty $in (never widens)', async (t) => {
  let jf; let distinctCalls = 0
  t.mock.method(Job, 'distinct', async () => { distinctCalls++; return [] })
  t.mock.method(Bid, 'distinct', async () => { throw new Error('should not be called for an empty id list') })
  t.mock.method(Job, 'find', (x) => { jf = x; return chain([]) })
  await jobs.listForClient(A, { pendingBids: 'false' })
  assert.deepEqual(jf, { clientId: A }); assert.equal(distinctCalls, 0)
  await jobs.listForClient(A, { pendingBids: 'true' })
  assert.deepEqual(jf, { clientId: A, _id: { $in: [] } })
})

test('discovery: unpaged keeps the 200 cap and a plain array; paged uses $facet skip/limit + total and an _id tiebreak', async (t) => {
  const pipes = []
  const row = { userId: A, hourlyRate: 10, bio: 'b', rating: 4, user: { name: 'N', status: 'Active' }, skillDocs: [{ name: 'React' }] }
  t.mock.method(FreelancerProfile, 'aggregate', async (p) => {
    pipes.push(p)
    return p.some((s) => s.$facet) ? [{ rows: [row], count: [{ n: 7 }] }] : [row]
  })
  t.mock.method(Contract, 'aggregate', async () => [{ _id: A, n: 2 }])
  const all = await discovery.search({ sortBy: 'rateLow' })
  assert.equal(all.pageInfo, undefined)
  assert.ok(pipes[0].some((s) => s.$limit === 200))
  assert.deepEqual(pipes[0].find((s) => s.$sort).$sort, { hourlyRate: 1, 'user.name': 1, _id: 1 })
  const paged = await discovery.search({}, optPagination({ page: '2', limit: '3' }))
  const facet = pipes[1].find((s) => s.$facet).$facet
  assert.deepEqual(facet.rows.slice(0, 3).map((s) => Object.keys(s)[0]), ['$sort', '$skip', '$limit'])
  assert.equal(facet.rows[1].$skip, 3); assert.equal(facet.rows[2].$limit, 3)
  assert.deepEqual(paged.pageInfo, { page: 2, limit: 3, total: 7, totalPages: 3 })
  assert.equal(paged[0].completedContracts, 2)
  assert.deepEqual(paged[0].skills, ['React'])
})

test('discovery paged: empty result => total 0, empty array', async (t) => {
  t.mock.method(FreelancerProfile, 'aggregate', async () => [{ rows: [], count: [] }])
  t.mock.method(Contract, 'aggregate', async () => [])
  const r = await discovery.search({}, optPagination({ page: '1', limit: '10' }))
  assert.deepEqual(r, []); assert.equal(r.pageInfo.total, 0)
})
