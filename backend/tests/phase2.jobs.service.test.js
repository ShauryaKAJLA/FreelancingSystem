// Phase 2: job service behaviour with Mongoose models stubbed (no database needed).
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test_secret_test_secret_test_secret_123'

const test = require('node:test')
const assert = require('node:assert/strict')
const Job = require('../src/models/Job')
const Bid = require('../src/models/Bid')
const User = require('../src/models/User')
const Skill = require('../src/models/Skill')
const ClientProfile = require('../src/models/ClientProfile')
const svc = require('../src/services/jobService')

const OWNER = 'a'.repeat(24)
const OTHER = 'b'.repeat(24)
const JOB = 'c'.repeat(24)
const owner = { _id: OWNER, role: 'Client' }
const otherClient = { _id: OTHER, role: 'Client' }
const freelancer = { _id: OTHER, role: 'Freelancer' }
const admin = { _id: 'd'.repeat(24), role: 'Admin' }

const makeJob = (over = {}) => ({
  _id: JOB, clientId: OWNER, title: 'T', description: 'D', budget: 100, status: 'Draft', createdAt: new Date('2025-09-01T00:00:00Z'),
  requiredSkillIds: [], milestoneTasks: [], numberOfMilestones: 1,
  set(u) { Object.assign(this, u) }, async save() { return this }, ...over,
})
const stubFindById = (t, job) => t.mock.method(Job, 'findById', async () => job)
// Phase 3: jobService now reads bids. Empty by default; the Phase 3 tests cover the populated cases.
const stubNoBids = (t) => t.mock.method(Bid, 'find', () => ({ sort: async () => [] }))

test('create: job is owned by the AUTHENTICATED client, never the body', async (t) => {
  let saved
  t.mock.method(Skill, 'countDocuments', async () => 0)
  t.mock.method(Job, 'create', async (doc) => { saved = doc; return makeJob(doc) })
  const out = await svc.create(owner, { title: 'T', description: 'D', budget: 5, clientId: OTHER, status: 'Draft' })
  assert.equal(String(saved.clientId), OWNER)
  assert.equal(out.clientId, OWNER)
  assert.equal(out.jobId, JOB)
})

test('create: unknown required skill ids -> 400', async (t) => {
  t.mock.method(Skill, 'countDocuments', async () => 1)
  await assert.rejects(svc.create(owner, { requiredSkillIds: [OWNER, OTHER] }), { statusCode: 400, message: 'One or more skills do not exist' })
})

test('edit: only the owner (or admin) may edit; others get 403', async (t) => {
  stubFindById(t, makeJob({ status: 'Published' }))
  await assert.rejects(svc.edit(JOB, { title: 'x' }, otherClient), { statusCode: 403 })
  const out = await svc.edit(JOB, { title: 'New' }, owner)
  assert.equal(out.title, 'New')
  assert.equal((await svc.edit(JOB, { budget: 9 }, admin)).budget, 9)
})

test('edit: locked once In Progress / Cancelled (mock message)', async (t) => {
  stubFindById(t, makeJob({ status: 'In Progress' }))
  await assert.rejects(svc.edit(JOB, { title: 'x' }, owner), { statusCode: 400, message: 'A job that is in progress can no longer be edited.' })
})

test('edit/publish/etc: bad id -> 400, missing -> 404', async (t) => {
  await assert.rejects(svc.publish('nope', owner), { statusCode: 400, message: 'Invalid jobId' })
  stubFindById(t, null)
  await assert.rejects(svc.publish(JOB, owner), { statusCode: 404, message: 'Job not found' })
})

test('publish: Draft -> Published via a conditional update; non-drafts rejected', async (t) => {
  stubFindById(t, makeJob({ status: 'Draft' }))
  let filter, update
  t.mock.method(Job, 'findOneAndUpdate', async (f, u) => { filter = f; update = u; return makeJob({ status: 'Published' }) })
  assert.equal((await svc.publish(JOB, owner)).status, 'Published')
  assert.equal(filter.status, 'Draft')
  assert.deepEqual(update.$set, { status: 'Published' })
  await assert.rejects(svc.publish(JOB, otherClient), { statusCode: 403 })

  stubFindById(t, makeJob({ status: 'Published' }))
  await assert.rejects(svc.publish(JOB, owner), { statusCode: 400, message: 'Only a draft job can be published.' })
})

test('publish: lost race (status changed underneath) -> 409', async (t) => {
  stubFindById(t, makeJob({ status: 'Draft' }))
  t.mock.method(Job, 'findOneAndUpdate', async () => null)
  await assert.rejects(svc.publish(JOB, owner), { statusCode: 409 })
})

test('cancel: only Published; stores the reason; cancelled jobs are no longer editable', async (t) => {
  stubFindById(t, makeJob({ status: 'Published' }))
  let update
  t.mock.method(Job, 'findOneAndUpdate', async (_f, u) => { update = u; return makeJob({ status: 'Cancelled', cancellationReason: 'Scope changed' }) })
  t.mock.method(Bid, 'updateMany', async () => ({ modifiedCount: 0 }))
  const out = await svc.cancel(JOB, 'Scope changed', owner)
  assert.deepEqual(update.$set, { status: 'Cancelled', cancellationReason: 'Scope changed' })
  assert.equal(out.status, 'Cancelled')
  assert.equal(out.cancellationReason, 'Scope changed')

  for (const status of ['Draft', 'In Progress', 'Cancelled']) {
    stubFindById(t, makeJob({ status }))
    await assert.rejects(svc.cancel(JOB, null, owner), { statusCode: 400, message: 'Only a published job (not yet in progress) can be cancelled.' })
  }
})

test('remove: only a Draft can be deleted, by its owner', async (t) => {
  stubFindById(t, makeJob({ status: 'Draft' }))
  t.mock.method(Job, 'deleteOne', async () => ({ deletedCount: 1 }))
  assert.deepEqual(await svc.remove(JOB, owner), { jobId: JOB })
  await assert.rejects(svc.remove(JOB, otherClient), { statusCode: 403 })

  stubFindById(t, makeJob({ status: 'Published' }))
  await assert.rejects(svc.remove(JOB, owner), { statusCode: 400 })
})

test('getForClient: drafts are private to owner/admin (others see a 404)', async (t) => {
  stubNoBids(t)
  stubFindById(t, makeJob({ status: 'Draft' }))
  assert.equal((await svc.getForClient(JOB, owner)).jobId, JOB)
  assert.deepEqual((await svc.getForClient(JOB, admin)).bids, [])
  await assert.rejects(svc.getForClient(JOB, otherClient), { statusCode: 404 })
  await assert.rejects(svc.getForClient(JOB, freelancer), { statusCode: 404 })

  stubFindById(t, makeJob({ status: 'Published' }))
  assert.equal((await svc.getForClient(JOB, freelancer)).status, 'Published')
  await assert.rejects(svc.getForClient(JOB, otherClient), { statusCode: 404 })
})

test('listForClient: returns DTOs with the bid-count fields the list page reads', async (t) => {
  stubNoBids(t)
  t.mock.method(Job, 'find', () => ({ sort: () => ({ limit: async () => [makeJob({ status: 'Published' })] }) }))
  const [row] = await svc.listForClient(OWNER)
  assert.equal(row.jobId, JOB)
  assert.deepEqual([row.bidCount, row.pendingBidCount, row.pendingBids], [0, 0, []])
})

test('listOpen: adds clientName (company name wins, account name is the fallback) and queries Published only', async (t) => {
  let filter
  t.mock.method(Bid, 'aggregate', async () => [])
  t.mock.method(Job, 'find', (f) => { filter = f; return { sort: () => ({ limit: async () => [makeJob({ status: 'Published' }), makeJob({ _id: 'e'.repeat(24), clientId: OTHER, status: 'Published' })] }) } })
  t.mock.method(User, 'find', () => ({ select: async () => [{ _id: OWNER, name: 'Aisha' }, { _id: OTHER, name: 'Rohan' }] }))
  t.mock.method(ClientProfile, 'find', () => ({ select: async () => [{ userId: OWNER, companyName: 'TechNova' }, { userId: OTHER, companyName: '' }] }))
  const rows = await svc.listOpen({ sortBy: 'newest' })
  assert.equal(filter.status, 'Published')
  assert.deepEqual(rows.map((r) => r.clientName), ['TechNova', 'Rohan'])
  assert.equal(rows[0].bidCount, 0)
})

test('getForFreelancer: draft jobs are invisible; others include clientName and myBid', async (t) => {
  stubFindById(t, makeJob({ status: 'Draft' }))
  await assert.rejects(svc.getForFreelancer(JOB), { statusCode: 404 })
  stubFindById(t, makeJob({ status: 'Published' }))
  t.mock.method(User, 'find', () => ({ select: async () => [{ _id: OWNER, name: 'Aisha' }] }))
  t.mock.method(ClientProfile, 'find', () => ({ select: async () => [] }))
  const out = await svc.getForFreelancer(JOB)
  assert.equal(out.clientName, 'Aisha')
  assert.equal(out.myBid, null)
})
