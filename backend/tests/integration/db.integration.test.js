// Real-MongoDB checks (mongodb-memory-server). Run: npm install && npm run test:integration
// SKIPS (does not fail) when mongodb-memory-server or its binary is unavailable. Written in a sandbox without Mongo: UNVERIFIED until you run it.
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test_secret_test_secret_test_secret_123'
const test = require('node:test')
const assert = require('node:assert/strict')

let mongod, mongoose
const oid = () => new (require('mongoose').Types.ObjectId)()

test.before(async () => {
  try {
    const { MongoMemoryServer } = require('mongodb-memory-server')
    mongod = await MongoMemoryServer.create()
    mongoose = require('mongoose')
    await mongoose.connect(mongod.getUri())
    for (const m of Object.values(mongoose.models)) await m.init() // build indexes before asserting on them
  } catch (e) { console.log('SKIP integration:', e.message.split('\n')[0]); mongod = null }
})
test.after(async () => { if (mongoose) await mongoose.disconnect(); if (mongod) await mongod.stop() })

const needDb = (name, fn) => test(name, async (t) => { if (!mongod) return t.skip('no mongodb-memory-server'); await fn(t) })
const models = () => ({
  Job: require('../../src/models/Job'), Bid: require('../../src/models/Bid'), Payment: require('../../src/models/Payment'),
  User: require('../../src/models/User'), FP: require('../../src/models/FreelancerProfile'),
})
const mkUser = (User, role, name) => User.create({ name, email: `${name.replace(/\W/g, '')}${Math.random()}@x.com`.toLowerCase(), passwordHash: 'x', role })

needDb('bids: one ACTIVE bid per (job, freelancer); re-bid allowed after withdrawal (partial unique index)', async () => {
  const { Bid } = models(); const jobId = oid(), fid = oid()
  await Bid.create({ jobId, freelancerId: fid, bidAmount: 10, proposal: 'a' })
  await assert.rejects(Bid.create({ jobId, freelancerId: fid, bidAmount: 11, proposal: 'b' }), /E11000/)
  await Bid.updateOne({ jobId, freelancerId: fid }, { $set: { status: 'Withdrawn', isActive: false } })
  await Bid.create({ jobId, freelancerId: fid, bidAmount: 12, proposal: 'c' }) // allowed
})

needDb('payments: sparse unique providerPaymentId / fundedLock — many unpaid orders, no duplicate paid ids', async () => {
  const { Payment } = models()
  const base = () => ({ milestoneId: oid(), contractId: oid(), clientId: oid(), freelancerId: oid(), amount: 5 })
  await Payment.create({ ...base(), providerOrderId: 'o1' }); await Payment.create({ ...base(), providerOrderId: 'o2' }) // both missing providerPaymentId
  await Payment.create({ ...base(), providerOrderId: 'o3', providerPaymentId: 'p1' })
  await assert.rejects(Payment.create({ ...base(), providerOrderId: 'o4', providerPaymentId: 'p1' }), /E11000/)
})

needDb('client jobs: pendingBids=true + status + paging against real data', async () => {
  const { Job, Bid, User } = models(); const jobs = require('../../src/services/jobService')
  const client = await mkUser(User, 'Client', 'Cli'), other = await mkUser(User, 'Client', 'Oth')
  const mk = (clientId, title, status = 'Published') => Job.create({ clientId, title, description: 'd', budget: 100, status })
  const [a, b, c] = [await mk(client._id, 'A'), await mk(client._id, 'B'), await mk(client._id, 'C', 'Draft')]
  const foreign = await mk(other._id, 'F')
  await Bid.create({ jobId: a._id, freelancerId: oid(), bidAmount: 1, proposal: 'p' })                      // Pending
  await Bid.create({ jobId: b._id, freelancerId: oid(), bidAmount: 1, proposal: 'p', status: 'Rejected' })    // not open
  await Bid.create({ jobId: foreign._id, freelancerId: oid(), bidAmount: 1, proposal: 'p' })                 // someone else's job
  const pend = await jobs.listForClient(String(client._id), { pendingBids: 'true', page: '1', limit: '10' })
  assert.deepEqual(pend.map((j) => j.title), ['A']); assert.equal(pend.pageInfo.total, 1)
  const all = await jobs.listForClient(String(client._id), { page: '1', limit: '2' })
  assert.equal(all.length, 2); assert.equal(all.pageInfo.total, 3); assert.equal(all.pageInfo.totalPages, 2)
  const drafts = await jobs.listForClient(String(client._id), { status: 'Draft', page: '1', limit: '10' })
  assert.deepEqual(drafts.map((j) => j.title), ['C'])
  assert.ok(c)
})

needDb('discovery: $facet paging returns stable, non-overlapping pages with the right total', async () => {
  const { User, FP } = models(); const discovery = require('../../src/services/freelancerService'); const { optPagination } = require('../../src/utils/pagination')
  for (let i = 0; i < 5; i++) { const u = await mkUser(User, 'Freelancer', `Free${i}`); await FP.create({ userId: u._id, hourlyRate: 10, rating: 4 }) } // all tie on rating
  const p1 = await discovery.search({}, optPagination({ page: '1', limit: '2' }))
  const p2 = await discovery.search({}, optPagination({ page: '2', limit: '2' }))
  const p3 = await discovery.search({}, optPagination({ page: '3', limit: '2' }))
  const ids = [...p1, ...p2, ...p3].map((r) => r.freelancerId)
  assert.equal(new Set(ids).size, 5); assert.equal(p1.pageInfo.total, 5); assert.equal(p3.length, 1)
  assert.equal((await discovery.search({})).pageInfo, undefined) // legacy mode untouched
})
