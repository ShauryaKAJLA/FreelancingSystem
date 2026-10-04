// Phase 9: admin server-side filters + paging for actions log, issues, open jobs; API contract audit.
// Stubbed models only (no MongoDB). Run: node --test tests/phase9.admin-filters.test.js
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test_secret_test_secret_test_secret_123'

const test = require('node:test')
const assert = require('node:assert/strict')
const Job = require('../src/models/Job')
const User = require('../src/models/User')
const Issue = require('../src/models/Issue')
const Contract = require('../src/models/Contract')
const AdminAction = require('../src/models/AdminAction')
const bids = require('../src/services/bidService')
const admin = require('../src/services/adminService')
const issues = require('../src/services/issueService')
const { audit } = require('../scripts/audit-routes')

const A = 'a'.repeat(24), B = 'b'.repeat(24)
const date = new Date('2025-10-01T10:00:00Z')
const chain = (rows, spy = {}) => { const p = Promise.resolve(rows); const c = { sort: (s) => { spy.sort = s; return c }, skip: (n) => { spy.skip = n; return c }, limit: (n) => { spy.limit = n; return c }, select: () => c, then: p.then.bind(p), catch: p.catch.bind(p) }; return c }

test('actions log: actionType + search build the filter; paging adds skip/limit + pageInfo', async (t) => {
  const spy = {}
  let usedFilter
  t.mock.method(AdminAction, 'find', (f) => { usedFilter = f; return chain([{ _id: A, adminId: B, actionType: 'Refund', actionDescription: 'Refunded x', createdAt: date }], spy) })
  t.mock.method(AdminAction, 'countDocuments', async (f) => { assert.deepEqual(f, usedFilter); return 31 })
  t.mock.method(User, 'find', () => chain([{ _id: B, name: 'Root' }]))
  const rows = await admin.actionsLog({ actionType: 'Refund', search: 'a.b(c', page: '2', limit: '10' })
  assert.equal(usedFilter.actionType, 'Refund')
  assert.equal(usedFilter.$or.length, 2)
  assert.equal(usedFilter.$or[0].actionDescription.$regex, 'a\\.b\\(c') // regex-escaped
  assert.equal(spy.skip, 10); assert.equal(spy.limit, 10)
  assert.deepEqual(rows.pageInfo, { page: 2, limit: 10, total: 31, totalPages: 4 })
  assert.equal(rows[0].adminName, 'Root')
})

test('actions log: no params => empty filter, legacy cap, no pageInfo', async (t) => {
  const spy = {}
  let usedFilter
  t.mock.method(AdminAction, 'find', (f) => { usedFilter = f; return chain([], spy) })
  t.mock.method(AdminAction, 'countDocuments', async () => { throw new Error('count must not run without paging') })
  const rows = await admin.actionsLog({})
  assert.deepEqual(usedFilter, {})
  assert.equal(spy.limit, 500)
  assert.equal(rows.pageInfo, undefined)
})

test('issues.list: admin paging uses skip/limit + count and keeps status filter; non-admin stays scoped', async (t) => {
  const spy = {}
  let usedFilter
  t.mock.method(Issue, 'find', (f) => { usedFilter = f; return chain([], spy) })
  t.mock.method(Issue, 'countDocuments', async () => 7)
  const rows = await issues.list({ role: 'Admin', _id: A }, { status: 'Open', page: '1', limit: '5' })
  assert.deepEqual(usedFilter, { status: 'Open' })
  assert.equal(spy.limit, 5)
  assert.deepEqual(rows.pageInfo, { page: 1, limit: 5, total: 7, totalPages: 2 })
  await issues.list({ role: 'Client', _id: B }, { status: 'bogus' })
  assert.deepEqual(usedFilter, { raisedBy: B }) // own issues only, invalid status ignored
  assert.equal(spy.limit, 500)
})

test('admin open jobs: sanitises filters, always Published only, pages with count', async (t) => {
  const spy = {}
  let usedFilter
  const job = { _id: A, clientId: B, title: 'T', description: 'd', budget: 100, status: 'Published', category: 'Design', experienceLevel: 'Entry', requiredSkillIds: [], createdAt: date }
  t.mock.method(Job, 'find', (f) => { usedFilter = f; return chain([job], spy) })
  t.mock.method(Job, 'countDocuments', async () => 12)
  t.mock.method(User, 'find', () => chain([{ _id: B, name: 'Acme' }]))
  t.mock.method(require('../src/models/ClientProfile'), 'find', () => chain([]))
  t.mock.method(bids, 'countsForJobs', async () => new Map())
  const rows = await admin.openJobs({ search: 'Redes', budgetMin: '50', budgetMax: 'abc', status: 'Draft', page: '2', limit: '5' })
  assert.equal(usedFilter.status, 'Published') // a caller-supplied status can never widen the list
  assert.equal(usedFilter.budget.$gte, 50)
  assert.equal(usedFilter.budget.$lte, undefined) // junk number ignored
  assert.equal(spy.skip, 5)
  assert.deepEqual(rows.pageInfo, { page: 2, limit: 5, total: 12, totalPages: 3 })
  assert.equal(rows[0].clientName, 'Acme')
})

test('API contract: all 80 PDF endpoints are routed; the 3 frontend-only names resolve to live equivalents', () => {
  const { pdf, extra } = audit()
  assert.deepEqual(pdf.filter((x) => !x.found).map((x) => x.endpoint), [])
  assert.equal(pdf.length, 80)
  assert.deepEqual(extra.filter((x) => !x.found).map((x) => x.endpoint), [])
})
