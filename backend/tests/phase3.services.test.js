// Phase 3: bid / contract / milestone services with Mongoose models stubbed (no database needed).
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test_secret_test_secret_test_secret_123'

const test = require('node:test')
const assert = require('node:assert/strict')
const Bid = require('../src/models/Bid')
const Job = require('../src/models/Job')
const Contract = require('../src/models/Contract')
const Milestone = require('../src/models/Milestone')
const Payment = require('../src/models/Payment')
const Review = require('../src/models/Review')
const User = require('../src/models/User')
const ClientProfile = require('../src/models/ClientProfile')
const FreelancerProfile = require('../src/models/FreelancerProfile')
const notifications = require('../src/services/notificationService')
const paymentService = require('../src/services/paymentService')
const bids = require('../src/services/bidService')
const contracts = require('../src/services/contractService')
const milestones = require('../src/services/milestoneService')

const CLIENT = 'a'.repeat(24)
const FREE = 'b'.repeat(24)
const STRANGER = 'c'.repeat(24)
const JOB = 'd'.repeat(24)
const BID = 'e'.repeat(24)
const BID2 = 'f'.repeat(24)
const CT = '1'.repeat(24)
const MS = '2'.repeat(24)

const client = { _id: CLIENT, role: 'Client', name: 'Aisha' }
const freelancer = { _id: FREE, role: 'Freelancer', name: 'Meera' }
const stranger = { _id: STRANGER, role: 'Client' }
const strangerFreelancer = { _id: STRANGER, role: 'Freelancer', name: 'Other' }

const makeJob = (o = {}) => ({ _id: JOB, clientId: CLIENT, title: 'Site', budget: 45000, status: 'Published', milestoneTasks: ['A', 'B'], requiredSkillIds: [], numberOfMilestones: 2, createdAt: new Date('2025-09-01T00:00:00Z'), ...o })
const makeBid = (o = {}) => ({ _id: BID, jobId: JOB, freelancerId: FREE, bidAmount: 100, proposal: 'p', status: 'Pending', bidDate: new Date('2025-09-02T00:00:00Z'), ...o })
const makeContract = (o = {}) => ({ _id: CT, jobId: JOB, clientId: CLIENT, freelancerId: FREE, status: 'Pending Start', startDate: null, endDate: null, terminationRequestedBy: null, terminationReason: null, ...o })
const makeMs = (o = {}) => ({ _id: MS, contractId: CT, title: 'Milestone 1', amount: 100, status: 'Pending', funded: false, dueDate: null, ...o })

// Every test records notifications instead of touching the Notification model.
const stubNotify = (t) => { const sent = []; t.mock.method(notifications, 'notify', async (to, p) => { sent.push({ to: String(to), ...p }); return null }); return sent }

// ═══ Bids ═══════════════════════════════════════════════════════════════════════════════════
test('submitBid: the bid belongs to the AUTHENTICATED freelancer (body ids ignored) and starts Pending', async (t) => {
  const sent = stubNotify(t)
  t.mock.method(Job, 'findById', async () => makeJob())
  t.mock.method(Bid, 'exists', async () => null)
  let saved
  t.mock.method(Bid, 'create', async (d) => { saved = d; return makeBid({ ...d, _id: BID }) })
  const out = await bids.submit(freelancer, JOB, { bidAmount: 250, proposal: ' hello ', freelancerId: STRANGER, status: 'Accepted' })
  assert.equal(String(saved.freelancerId), FREE)
  assert.equal(saved.status, 'Pending')
  assert.equal(saved.proposal, 'hello')
  assert.equal(out.bidId, BID)
  assert.equal(sent[0].to, CLIENT) // the client is told about the new proposal
  assert.equal(sent[0].type, 'bid')
})

test('submitBid: closed job -> 400, draft -> 404, duplicate -> 409 (mock strings)', async (t) => {
  stubNotify(t)
  t.mock.method(Bid, 'exists', async () => null)
  t.mock.method(Job, 'findById', async () => makeJob({ status: 'In Progress' }))
  await assert.rejects(bids.submit(freelancer, JOB, { bidAmount: 5, proposal: 'x' }), { statusCode: 400, message: 'This job is no longer open for bidding.' })
  t.mock.method(Job, 'findById', async () => makeJob({ status: 'Draft' }))
  await assert.rejects(bids.submit(freelancer, JOB, { bidAmount: 5, proposal: 'x' }), { statusCode: 404 })
  t.mock.method(Job, 'findById', async () => makeJob())
  t.mock.method(Bid, 'exists', async () => ({ _id: BID }))
  await assert.rejects(bids.submit(freelancer, JOB, { bidAmount: 5, proposal: 'x' }), { statusCode: 409, message: 'You have already submitted a bid on this job.' })
})

test('submitBid: a race lost to the partial unique index (E11000) is reported as the same 409', async (t) => {
  stubNotify(t)
  t.mock.method(Job, 'findById', async () => makeJob())
  t.mock.method(Bid, 'exists', async () => null)
  t.mock.method(Bid, 'create', async () => { throw Object.assign(new Error('dup'), { code: 11000 }) })
  await assert.rejects(bids.submit(freelancer, JOB, { bidAmount: 5, proposal: 'x' }), { statusCode: 409, message: 'You have already submitted a bid on this job.' })
})

test('submitBid: bad id -> 400; a client cannot bid on their own job', async (t) => {
  await assert.rejects(bids.submit(freelancer, 'nope', { bidAmount: 5, proposal: 'x' }), { statusCode: 400, message: 'Invalid jobId' })
  t.mock.method(Job, 'findById', async () => makeJob({ clientId: FREE }))
  await assert.rejects(bids.submit(freelancer, JOB, { bidAmount: 5, proposal: 'x' }), { statusCode: 400 })
})

test('editBid: owner only (stranger sees 404); Pending -> Updated with a fresh bidDate; others 400', async (t) => {
  t.mock.method(Bid, 'findById', async () => makeBid())
  await assert.rejects(bids.edit(strangerFreelancer, BID, { bidAmount: 5, proposal: 'x' }), { statusCode: 404, message: 'Bid not found' })
  let update
  t.mock.method(Bid, 'findOneAndUpdate', async (f, u) => { update = { f, u }; return makeBid({ status: 'Updated', bidAmount: 300, proposal: 'new' }) })
  const out = await bids.edit(freelancer, BID, { bidAmount: 300, proposal: 'new' })
  assert.equal(update.f.status, 'Pending') // conditional on the expected status
  assert.equal(update.u.$set.status, 'Updated')
  assert.ok(update.u.$set.bidDate instanceof Date)
  assert.equal(out.status, 'Updated')
  t.mock.method(Bid, 'findById', async () => makeBid({ status: 'Accepted' }))
  await assert.rejects(bids.edit(freelancer, BID, { bidAmount: 5, proposal: 'x' }), { statusCode: 400, message: 'Only a pending proposal can be edited.' })
})

test('editBid: a lost race (status changed underneath) -> 409, never a silent overwrite', async (t) => {
  t.mock.method(Bid, 'findById', async () => makeBid())
  t.mock.method(Bid, 'findOneAndUpdate', async () => null)
  await assert.rejects(bids.edit(freelancer, BID, { bidAmount: 5, proposal: 'x' }), { statusCode: 409 })
})

test('withdrawBid: sets Withdrawn + isActive=false (re-bidding allowed); Accepted/Rejected refused', async (t) => {
  t.mock.method(Bid, 'findById', async () => makeBid({ status: 'Updated' }))
  let set
  t.mock.method(Bid, 'findOneAndUpdate', async (_f, u) => { set = u.$set; return makeBid({ status: 'Withdrawn' }) })
  const out = await bids.withdraw(freelancer, BID)
  assert.deepEqual(set, { status: 'Withdrawn', isActive: false })
  assert.equal(out.status, 'Withdrawn')
  await assert.rejects(bids.withdraw(strangerFreelancer, BID), { statusCode: 404 })
  t.mock.method(Bid, 'findById', async () => makeBid({ status: 'Rejected' }))
  await assert.rejects(bids.withdraw(freelancer, BID), { statusCode: 400, message: 'A rejected proposal cannot be withdrawn.' })
})

test('acceptBid happy path: locks the job, accepts the bid, creates a Pending Start contract, rejects siblings', async (t) => {
  const sent = stubNotify(t)
  const calls = []
  t.mock.method(Job, 'findById', async () => makeJob())
  t.mock.method(Bid, 'findById', async () => makeBid())
  t.mock.method(Job, 'findOneAndUpdate', async (f, u) => { calls.push(['job', f, u.$set]); return makeJob({ status: 'In Progress' }) })
  t.mock.method(Bid, 'findOneAndUpdate', async (f, u) => { calls.push(['bid', f, u.$set]); return makeBid({ status: 'Accepted' }) })
  t.mock.method(Contract, 'create', async (d) => { calls.push(['contract', d]); return makeContract({ ...d }) })
  t.mock.method(Bid, 'updateMany', async (f, u) => { calls.push(['siblings', f, u.$set]); return { modifiedCount: 1 } })
  const out = await bids.accept(client, JOB, BID)

  assert.deepEqual(calls.map((c) => c[0]), ['job', 'bid', 'contract', 'siblings']) // the documented order
  assert.equal(calls[0][1].status, 'Published')
  assert.equal(calls[0][2].status, 'In Progress')
  assert.deepEqual(calls[1][1].status, { $in: ['Pending', 'Updated'] })
  assert.equal(calls[2][1].status, 'Pending Start')
  assert.equal(calls[2][1].startDate, null)
  assert.equal(String(calls[2][1].freelancerId), FREE)
  assert.deepEqual(calls[3][1].status, { $ne: 'Withdrawn' }) // withdrawn bids are left alone
  assert.deepEqual(calls[3][1]._id, { $ne: BID })
  assert.equal(calls[3][2].status, 'Rejected')
  assert.equal(out.status, 'Pending Start')
  assert.equal(out.startDate, null)
  assert.equal(sent[0].to, FREE)
})

test('acceptBid: only the job owner; wrong job/bid pairing -> 404; closed job / dead bid -> mock messages', async (t) => {
  stubNotify(t)
  t.mock.method(Job, 'findById', async () => makeJob())
  t.mock.method(Bid, 'findById', async () => makeBid())
  await assert.rejects(bids.accept(stranger, JOB, BID), { statusCode: 404, message: 'Job or bid not found' })
  t.mock.method(Bid, 'findById', async () => makeBid({ jobId: STRANGER }))
  await assert.rejects(bids.accept(client, JOB, BID), { statusCode: 404 })
  t.mock.method(Job, 'findById', async () => makeJob({ status: 'In Progress' }))
  t.mock.method(Bid, 'findById', async () => makeBid())
  await assert.rejects(bids.accept(client, JOB, BID), { statusCode: 400, message: 'This job is no longer open for hiring.' })
  t.mock.method(Job, 'findById', async () => makeJob())
  t.mock.method(Bid, 'findById', async () => makeBid({ status: 'Withdrawn' }))
  await assert.rejects(bids.accept(client, JOB, BID), { statusCode: 400, message: 'This proposal is withdrawn and can no longer be accepted.' })
})

test('acceptBid: losing the job lock (concurrent accept) changes nothing else', async (t) => {
  stubNotify(t)
  t.mock.method(Job, 'findById', async () => makeJob())
  t.mock.method(Bid, 'findById', async () => makeBid())
  t.mock.method(Job, 'findOneAndUpdate', async () => null)
  const bidUpdate = t.mock.method(Bid, 'findOneAndUpdate', async () => makeBid())
  await assert.rejects(bids.accept(client, JOB, BID), { statusCode: 400, message: 'This job is no longer open for hiring.' })
  assert.equal(bidUpdate.mock.callCount(), 0)
})

test('acceptBid: if the bid update loses a race, the job is put back to Published', async (t) => {
  stubNotify(t)
  t.mock.method(Job, 'findById', async () => makeJob())
  t.mock.method(Bid, 'findById', async () => makeBid())
  t.mock.method(Job, 'findOneAndUpdate', async () => makeJob({ status: 'In Progress' }))
  t.mock.method(Bid, 'findOneAndUpdate', async () => null)
  let revert
  t.mock.method(Job, 'updateOne', async (f, u) => { revert = { f, u } })
  await assert.rejects(bids.accept(client, JOB, BID), { statusCode: 400 })
  assert.deepEqual(revert.f, { _id: JOB, status: 'In Progress' })
  assert.deepEqual(revert.u.$set, { status: 'Published' })
})

test('acceptBid: if the contract cannot be created, the bid and job are rolled back', async (t) => {
  stubNotify(t)
  t.mock.method(Job, 'findById', async () => makeJob())
  t.mock.method(Bid, 'findById', async () => makeBid({ status: 'Updated' }))
  t.mock.method(Job, 'findOneAndUpdate', async () => makeJob({ status: 'In Progress' }))
  t.mock.method(Bid, 'findOneAndUpdate', async () => makeBid({ status: 'Accepted' }))
  t.mock.method(Contract, 'create', async () => { throw new Error('db down') })
  const bidRevert = []
  const jobRevert = []
  t.mock.method(Bid, 'updateOne', async (f, u) => { bidRevert.push(u.$set) })
  t.mock.method(Job, 'updateOne', async (f, u) => { jobRevert.push(u.$set) })
  const siblings = t.mock.method(Bid, 'updateMany', async () => ({}))
  await assert.rejects(bids.accept(client, JOB, BID), /db down/)
  assert.deepEqual(bidRevert, [{ status: 'Updated' }]) // restored to its ORIGINAL status
  assert.deepEqual(jobRevert, [{ status: 'Published' }])
  assert.equal(siblings.mock.callCount(), 0) // siblings are only rejected after the contract exists
})

test('rejectAllForJob: only Pending/Updated bids of that job', async (t) => {
  let f
  t.mock.method(Bid, 'updateMany', async (filter, u) => { f = { filter, set: u.$set }; return { modifiedCount: 2 } })
  assert.deepEqual(await bids.rejectAllForJob(JOB), { rejected: 2 })
  assert.deepEqual(f.filter, { jobId: JOB, status: { $in: ['Pending', 'Updated'] } })
  assert.deepEqual(f.set, { status: 'Rejected' })
})

test('statsForJobs (Phase 2 placeholders): bidCount counts all, pendingBids lists Pending+Updated with freelancer name/rating', async (t) => {
  const rows = [makeBid({ _id: BID, status: 'Pending' }), makeBid({ _id: BID2, freelancerId: STRANGER, status: 'Updated' }), makeBid({ _id: '9'.repeat(24), status: 'Withdrawn' }), makeBid({ _id: '8'.repeat(24), status: 'Rejected' })]
  t.mock.method(Bid, 'find', () => ({ sort: async () => rows }))
  t.mock.method(User, 'find', () => ({ select: async () => [{ _id: FREE, name: 'Meera' }, { _id: STRANGER, name: 'Karan' }] }))
  t.mock.method(FreelancerProfile, 'find', () => ({ select: async () => [{ userId: FREE, rating: 4.8, hourlyRate: 1800 }] }))
  const stats = await bids.statsForJobs([JOB, 'x'.repeat(24)])
  const s = stats.get(JOB)
  assert.equal(s.bidCount, 4)
  assert.equal(s.pendingBidCount, 2)
  assert.deepEqual(s.pendingBids.map((b) => [b.bidId, b.freelancerName, b.freelancerRating]), [[BID, 'Meera', 4.8], [BID2, 'Karan', undefined]])
  assert.deepEqual(stats.get('x'.repeat(24)), { bidCount: 0, pendingBidCount: 0, pendingBids: [] })
})

test('myBid: the caller\'s non-withdrawn bid, else null', async (t) => {
  let filter
  t.mock.method(Bid, 'findOne', async (f) => { filter = f; return makeBid() })
  assert.equal((await bids.myBid(JOB, FREE)).bidId, BID)
  assert.deepEqual(filter, { jobId: JOB, freelancerId: FREE, status: { $ne: 'Withdrawn' } })
  t.mock.method(Bid, 'findOne', async () => null)
  assert.equal(await bids.myBid(JOB, FREE), null)
})

test('listForFreelancer: adds jobTitle, jobBudget and the linked contract state (incl. terminationRequestedBy)', async (t) => {
  t.mock.method(Bid, 'find', () => ({ sort: async () => [makeBid({ status: 'Accepted' })] }))
  t.mock.method(Job, 'find', () => ({ select: async () => [makeJob()] }))
  t.mock.method(Contract, 'find', async () => [makeContract({ status: 'Active', terminationRequestedBy: 'Client' })])
  const [row] = await bids.listForFreelancer(FREE)
  assert.equal(row.jobTitle, 'Site')
  assert.equal(row.jobBudget, 45000)
  assert.equal(row.contractId, CT)
  assert.equal(row.contractStatus, 'Active')
  assert.equal(row.terminationRequestedBy, 'Client')
})

// ═══ Contracts ══════════════════════════════════════════════════════════════════════════════
test('startContract: client only; creates one milestone per task with the split budget; returns firstMilestone', async (t) => {
  const sent = stubNotify(t)
  t.mock.method(Contract, 'findById', async () => makeContract())
  t.mock.method(Job, 'findById', async () => makeJob({ budget: 10001, milestoneTasks: ['A', 'B'] }))
  let move
  t.mock.method(Contract, 'findOneAndUpdate', async (f, u) => { move = { f, u }; return makeContract({ status: 'Active', startDate: u.$set.startDate }) })
  t.mock.method(Milestone, 'exists', async () => null)
  let inserted
  t.mock.method(Milestone, 'insertMany', async (docs) => { inserted = docs; return docs })
  t.mock.method(Milestone, 'findOne', () => ({ sort: async () => makeMs({ title: 'Milestone 1', amount: 5000 }) }))
  const out = await contracts.start(client, CT)
  assert.deepEqual(move.f, { _id: CT, status: 'Pending Start' })
  assert.equal(move.u.$set.status, 'Active')
  assert.deepEqual(inserted.map((m) => [m.title, m.taskSpec, m.amount, m.status, m.dueDate, m.funded]), [['Milestone 1', 'A', 5000, 'Pending', null, false], ['Milestone 2', 'B', 5001, 'Pending', null, false]])
  assert.equal(out.status, 'Active')
  assert.equal(out.firstMilestone.title, 'Milestone 1')
  assert.equal(sent[0].to, FREE)
})

test('startContract: freelancer -> 403, stranger -> 404, not Pending Start -> 400; existing milestones are not duplicated', async (t) => {
  stubNotify(t)
  t.mock.method(Contract, 'findById', async () => makeContract())
  await assert.rejects(contracts.start(freelancer, CT), { statusCode: 403 })
  await assert.rejects(contracts.start(stranger, CT), { statusCode: 404, message: 'Contract not found' })
  t.mock.method(Contract, 'findById', async () => makeContract({ status: 'Active' }))
  await assert.rejects(contracts.start(client, CT), { statusCode: 400, message: 'Only a contract pending start can be started.' })

  t.mock.method(Contract, 'findById', async () => makeContract())
  t.mock.method(Job, 'findById', async () => makeJob())
  t.mock.method(Contract, 'findOneAndUpdate', async () => makeContract({ status: 'Active' }))
  t.mock.method(Milestone, 'exists', async () => ({ _id: MS }))
  const insert = t.mock.method(Milestone, 'insertMany', async () => [])
  t.mock.method(Milestone, 'findOne', () => ({ sort: async () => null }))
  const out = await contracts.start(client, CT)
  assert.equal(insert.mock.callCount(), 0)
  assert.equal(out.firstMilestone, null)
})

test('startContract: a budget too small to split is refused BEFORE the status changes', async (t) => {
  t.mock.method(Contract, 'findById', async () => makeContract())
  t.mock.method(Job, 'findById', async () => makeJob({ budget: 0.5, milestoneTasks: ['A', 'B'] }))
  const move = t.mock.method(Contract, 'findOneAndUpdate', async () => makeContract())
  await assert.rejects(contracts.start(client, CT), { statusCode: 400 })
  assert.equal(move.mock.callCount(), 0)
})

test('completeContract: Active only; sets endDate and moves the job to Completed', async (t) => {
  stubNotify(t)
  t.mock.method(Contract, 'findById', async () => makeContract({ status: 'Active' }))
  t.mock.method(Contract, 'findOneAndUpdate', async (_f, u) => makeContract({ status: 'Completed', endDate: u.$set.endDate }))
  let jobUpdate
  t.mock.method(Job, 'updateOne', async (f, u) => { jobUpdate = { f, u: u.$set } })
  const out = await contracts.complete(client, CT)
  assert.equal(out.status, 'Completed')
  assert.ok(out.endDate)
  assert.deepEqual(jobUpdate, { f: { _id: JOB, status: 'In Progress' }, u: { status: 'Completed' } })
  t.mock.method(Contract, 'findById', async () => makeContract({ status: 'Pending Start' }))
  await assert.rejects(contracts.complete(client, CT), { statusCode: 400, message: 'Only an active contract can be completed.' })
})

test('cancelContract: stores reason + endDate; refuses final states; closes the job', async (t) => {
  stubNotify(t)
  t.mock.method(Contract, 'findById', async () => makeContract({ status: 'Active' }))
  let set
  t.mock.method(Contract, 'findOneAndUpdate', async (_f, u) => { set = u.$set; return makeContract({ status: 'Cancelled', cancellationReason: 'x', endDate: new Date() }) })
  let jobTo
  t.mock.method(Job, 'updateOne', async (_f, u) => { jobTo = u.$set.status })
  const out = await contracts.cancel(client, CT, 'x')
  assert.equal(set.status, 'Cancelled')
  assert.equal(set.cancellationReason, 'x')
  assert.equal(out.cancellationReason, 'x')
  assert.equal(jobTo, 'Closed')
  t.mock.method(Contract, 'findById', async () => makeContract({ status: 'Completed' }))
  await assert.rejects(contracts.cancel(client, CT, null), { statusCode: 400, message: 'A completed or already-cancelled contract cannot be cancelled.' })
})

test('requestTermination: the role is derived from the authenticated user (a client cannot claim to be the freelancer)', async (t) => {
  const sent = stubNotify(t)
  t.mock.method(Contract, 'findById', async () => makeContract({ status: 'Active' }))
  let set
  t.mock.method(Contract, 'findOneAndUpdate', async (f, u) => { set = { f, u: u.$set }; return makeContract({ status: 'Active', terminationRequestedBy: u.$set.terminationRequestedBy, terminationReason: 'r' }) })
  const out = await contracts.requestTermination(client, CT, 'r')
  assert.equal(set.u.terminationRequestedBy, 'Client')
  assert.equal(set.f.terminationRequestedBy, null) // and only while no request is pending
  assert.equal(out.terminationRequestedBy, 'Client')
  assert.equal(sent[0].to, FREE) // the OTHER party is told
  await assert.rejects(contracts.requestTermination(stranger, CT, 'r'), { statusCode: 404 })
  t.mock.method(Contract, 'findById', async () => makeContract({ status: 'Pending Start' }))
  await assert.rejects(contracts.requestTermination(client, CT, 'r'), { statusCode: 400, message: 'Only an active contract can be terminated.' })
})

test('respondToTermination: approve by the other party terminates; own approve -> 403; withdraw allowed; none pending -> 400', async (t) => {
  stubNotify(t)
  t.mock.method(Contract, 'findById', async () => makeContract({ status: 'Active', terminationRequestedBy: 'Client', terminationReason: 'r' }))
  let set
  t.mock.method(Contract, 'findOneAndUpdate', async (_f, u) => { set = u.$set; return makeContract({ status: u.$set.status ?? 'Active', endDate: u.$set.endDate ?? null }) })
  let jobTo
  t.mock.method(Job, 'updateOne', async (_f, u) => { jobTo = u.$set.status })

  await assert.rejects(contracts.respondToTermination(client, CT, true), { statusCode: 403 }) // requester cannot approve
  const done = await contracts.respondToTermination(freelancer, CT, true)
  assert.equal(done.status, 'Terminated')
  assert.equal(set.status, 'Terminated')
  assert.ok(set.endDate)
  assert.equal(jobTo, 'Closed')

  const withdrawn = await contracts.respondToTermination(client, CT, false) // requester withdraws
  assert.deepEqual(set, { terminationRequestedBy: null, terminationReason: null })
  assert.equal(withdrawn.status, 'Active')

  t.mock.method(Contract, 'findById', async () => makeContract({ status: 'Active' }))
  await assert.rejects(contracts.respondToTermination(freelancer, CT, true), { statusCode: 400, message: 'There is no pending termination request on this contract.' })
  await assert.rejects(contracts.respondToTermination(stranger, CT, true), { statusCode: 404 })
})

test('getDetails: client view = contract + job + names + milestones(+payment) + reviews; freelancer view has no reviews key', async (t) => {
  t.mock.method(Contract, 'findById', async () => makeContract({ status: 'Active' }))
  t.mock.method(Job, 'findById', async () => makeJob())
  t.mock.method(Milestone, 'find', () => ({ sort: async () => [makeMs({ funded: true }), makeMs({ _id: '3'.repeat(24), title: 'Milestone 2' })] }))
  t.mock.method(Payment, 'find', () => ({ sort: async () => [{ _id: 'p'.repeat(24), milestoneId: MS, amount: 100, status: 'Held', providerPaymentId: 'pay_1', paidAt: new Date('2025-09-03T00:00:00Z') }] }))
  t.mock.method(User, 'find', () => ({ select: async () => [{ _id: CLIENT, name: 'Aisha' }, { _id: FREE, name: 'Meera' }] }))
  t.mock.method(ClientProfile, 'find', () => ({ select: async () => [{ userId: CLIENT, companyName: 'TechNova' }] }))
  t.mock.method(Review, 'find', () => ({ sort: async () => [{ _id: 'r'.repeat(24), contractId: CT, reviewerId: CLIENT, revieweeId: FREE, rating: 5, comment: 'ok', createdAt: new Date('2025-09-04T00:00:00Z') }] }))

  const c = await contracts.getDetails(CT, client)
  assert.equal(c.job.jobId, JOB)
  assert.deepEqual(c.job.milestoneTasks, ['A', 'B'])
  assert.equal(c.freelancerName, 'Meera')
  assert.equal(c.clientName, 'Aisha') // client's own view: account name (mock)
  assert.equal(c.milestones[0].payment.paymentStatus, 'Held')
  assert.equal(c.milestones[1].payment, null)
  assert.equal(c.reviews[0].reviewId, 'r'.repeat(24))

  const f = await contracts.getDetails(CT, freelancer)
  assert.equal(f.clientName, 'TechNova') // freelancer's view: company name wins
  assert.equal('reviews' in f, false)
  await assert.rejects(contracts.getDetails(CT, stranger), { statusCode: 404 })
})

test('listForClient / listForFreelancer: joined names (company fallback for the freelancer\'s view)', async (t) => {
  t.mock.method(Contract, 'find', () => ({ sort: () => ({ limit: async () => [makeContract({ status: 'Active' })] }) }))
  t.mock.method(Job, 'find', () => ({ select: async () => [makeJob()] }))
  t.mock.method(User, 'find', () => ({ select: async () => [{ _id: CLIENT, name: 'Aisha' }, { _id: FREE, name: 'Meera' }] }))
  t.mock.method(ClientProfile, 'find', () => ({ select: async () => [{ userId: CLIENT, companyName: 'TechNova' }] }))
  const [a] = await contracts.listForClient(CLIENT)
  assert.deepEqual([a.jobTitle, a.freelancerName, a.contractId], ['Site', 'Meera', CT])
  const [b] = await contracts.listForFreelancer(FREE)
  assert.deepEqual([b.jobTitle, b.clientName], ['Site', 'TechNova'])
})

// ═══ Milestones ═════════════════════════════════════════════════════════════════════════════
const stubMs = (t, ms, ct = makeContract({ status: 'Active' })) => {
  t.mock.method(Milestone, 'findById', async () => ms)
  t.mock.method(Contract, 'findById', async () => ct)
}

test('createMilestone: client of THAT contract only; status/funded are never taken from the body', async (t) => {
  t.mock.method(Contract, 'findById', async () => makeContract({ status: 'Active' }))
  let saved
  t.mock.method(Milestone, 'create', async (d) => { saved = d; return makeMs({ ...d }) })
  const out = await milestones.create(client, CT, { title: ' Wireframes ', amount: '2500', dueDate: '2026-01-15', funded: true, status: 'Completed' })
  assert.equal(saved.title, 'Wireframes')
  assert.equal(saved.amount, 2500)
  assert.equal(saved.funded, false)
  assert.equal(saved.status, 'Pending')
  assert.ok(saved.dueDate instanceof Date)
  assert.equal(out.funded, false)
  await assert.rejects(milestones.create(stranger, CT, { title: 'x', amount: 1 }), { statusCode: 404, message: 'Contract not found' })
  await assert.rejects(milestones.create(client, CT, { title: '', amount: 1 }), { statusCode: 400, message: 'A title and a positive amount are required.' })
  t.mock.method(Contract, 'findById', async () => makeContract({ status: 'Terminated' }))
  await assert.rejects(milestones.create(client, CT, { title: 'x', amount: 1 }), { statusCode: 400 })
})

test('createMilestone: dueDate is optional -> null', async (t) => {
  t.mock.method(Contract, 'findById', async () => makeContract({ status: 'Active' }))
  let saved
  t.mock.method(Milestone, 'create', async (d) => { saved = d; return makeMs({ ...d }) })
  await milestones.create(client, CT, { title: 'x', amount: 1 })
  assert.equal(saved.dueDate, null)
})

test('editMilestone / deleteMilestone: Pending + unfunded only, guarded by a conditional write', async (t) => {
  stubMs(t, makeMs())
  let filter
  t.mock.method(Milestone, 'findOneAndUpdate', async (f, u) => { filter = f; return makeMs({ ...u.$set }) })
  const out = await milestones.edit(client, MS, { title: 'New', amount: 9, dueDate: null })
  assert.deepEqual(filter, { _id: MS, status: 'Pending', funded: false })
  assert.equal(out.title, 'New')
  let delFilter
  t.mock.method(Milestone, 'deleteOne', async (f) => { delFilter = f; return { deletedCount: 1 } })
  assert.deepEqual(await milestones.remove(client, MS), { milestoneId: MS })
  assert.deepEqual(delFilter, { _id: MS, status: 'Pending', funded: false })

  stubMs(t, makeMs({ status: 'Submitted' }))
  await assert.rejects(milestones.edit(client, MS, { title: 'x', amount: 1 }), { statusCode: 400, message: 'A milestone that is submitted can no longer be edited.' })
  await assert.rejects(milestones.remove(client, MS), { statusCode: 400, message: 'A milestone that is submitted can no longer be deleted.' })
  stubMs(t, makeMs({ funded: true }))
  await assert.rejects(milestones.edit(client, MS, { title: 'x', amount: 1 }), { statusCode: 400, message: 'A funded milestone can no longer be edited.' })
  await assert.rejects(milestones.remove(client, MS), { statusCode: 400, message: 'A funded milestone can no longer be deleted.' })
})

test('milestone access: strangers 404, wrong party 403', async (t) => {
  stubMs(t, makeMs())
  await assert.rejects(milestones.edit(stranger, MS, { title: 'x', amount: 1 }), { statusCode: 404, message: 'Milestone not found' })
  await assert.rejects(milestones.edit(freelancer, MS, { title: 'x', amount: 1 }), { statusCode: 403 }) // freelancer cannot edit
  await assert.rejects(milestones.submit(client, MS), { statusCode: 403 }) // client cannot submit
  await assert.rejects(milestones.submit(strangerFreelancer, MS), { statusCode: 404 })
  await assert.rejects(milestones.edit(client, 'bad', { title: 'x', amount: 1 }), { statusCode: 400, message: 'Invalid milestoneId' })
})

test('submitMilestone: needs funding first; Pending -> Submitted, clears rejectionReason, notifies the client', async (t) => {
  const sent = stubNotify(t)
  stubMs(t, makeMs({ funded: false }))
  await assert.rejects(milestones.submit(freelancer, MS), { statusCode: 400, message: 'The client has not funded this milestone yet.' })
  stubMs(t, makeMs({ funded: true, rejectionReason: 'redo' }))
  t.mock.method(Job, 'findById', () => ({ select: async () => ({ title: 'Site' }) }))
  let filter, set
  t.mock.method(Milestone, 'findOneAndUpdate', async (f, u) => { filter = f; set = u.$set; return makeMs({ funded: true, status: 'Submitted', rejectionReason: null }) })
  const out = await milestones.submit(freelancer, MS)
  assert.deepEqual(filter, { _id: MS, status: 'Pending', funded: true })
  assert.deepEqual(set, { status: 'Submitted', rejectionReason: null })
  assert.equal(out.status, 'Submitted')
  assert.equal(sent[0].to, CLIENT)
  stubMs(t, makeMs({ funded: true, status: 'Submitted' }))
  await assert.rejects(milestones.submit(freelancer, MS), { statusCode: 400, message: 'This milestone has already been submitted.' })
})

test('rejectMilestone: Submitted -> Pending with the reason; resubmit is then possible', async (t) => {
  stubNotify(t)
  stubMs(t, makeMs({ status: 'Submitted', funded: true }))
  let set
  t.mock.method(Milestone, 'findOneAndUpdate', async (_f, u) => { set = u.$set; return makeMs({ funded: true, ...u.$set }) })
  const out = await milestones.reject(client, MS, 'needs work')
  assert.deepEqual(set, { status: 'Pending', rejectionReason: 'needs work' })
  assert.equal(out.rejectionReason, 'needs work')
  assert.equal(milestones.rules.submit(out.status, out.funded, 'Active'), null) // the state machine allows resubmission
  stubMs(t, makeMs({ status: 'Pending', funded: true }))
  await assert.rejects(milestones.reject(client, MS, 'x'), { statusCode: 400, message: 'Only a submitted milestone can be rejected.' })
})

test('approve (release-payment): milestone -> Completed and payment Held -> Awaiting Payout; returns payment + nextMilestone', async (t) => {
  stubMs(t, makeMs({ status: 'Submitted', funded: true }))
  t.mock.method(Payment, 'findOne', async () => ({ _id: 'p'.repeat(24), status: 'Held' }))
  t.mock.method(Milestone, 'findOneAndUpdate', async (f, u) => makeMs({ status: 'Completed', funded: true }))
  const hook = t.mock.method(paymentService, 'markMilestoneApproved', async () => ({ _id: 'p'.repeat(24), milestoneId: MS, amount: 100, status: 'Awaiting Payout', providerPaymentId: 'pay_1', paidAt: new Date('2025-09-03T00:00:00Z'), approvedAt: new Date('2025-09-05T00:00:00Z') }))
  t.mock.method(Milestone, 'findOne', () => ({ sort: async () => makeMs({ _id: '3'.repeat(24), title: 'Milestone 2' }) }))
  const out = await milestones.approve(client, MS)
  assert.equal(hook.mock.callCount(), 1)
  assert.equal(out.paymentStatus, 'Awaiting Payout')
  assert.equal(out.nextMilestone.title, 'Milestone 2')
})

test('approve: not submitted / not paid -> mock messages; a lost payment race rolls the milestone back', async (t) => {
  stubMs(t, makeMs({ status: 'Pending', funded: true }))
  await assert.rejects(milestones.approve(client, MS), { statusCode: 400, message: 'This milestone must be submitted by the freelancer before it can be approved.' })
  stubMs(t, makeMs({ status: 'Submitted', funded: false }))
  t.mock.method(Payment, 'findOne', async () => null)
  await assert.rejects(milestones.approve(client, MS), { statusCode: 400, message: 'This milestone has not been paid to the platform yet.' })

  t.mock.method(Payment, 'findOne', async () => ({ status: 'Held' }))
  t.mock.method(Milestone, 'findOneAndUpdate', async () => makeMs({ status: 'Completed' }))
  t.mock.method(paymentService, 'markMilestoneApproved', async () => null)
  let undo
  t.mock.method(Milestone, 'updateOne', async (f, u) => { undo = { f, u: u.$set } })
  await assert.rejects(milestones.approve(client, MS), { statusCode: 409 })
  assert.deepEqual(undo, { f: { _id: MS, status: 'Completed' }, u: { status: 'Submitted' } })
})
