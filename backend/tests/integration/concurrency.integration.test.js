// Concurrency checks on real MongoDB (mongodb-memory-server): racing callers must produce EXACTLY ONE effect.
// Run: npm install && npm run test:integration. SKIPS when mongodb-memory-server is unavailable.
// Written in a sandbox without Mongo: UNVERIFIED until you run it. A failure here is a real race bug (or a wrong assumption in this file).
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test_secret_test_secret_test_secret_123'
process.env.RAZORPAY_KEY_ID = 'rzp_test_x'
process.env.RAZORPAY_KEY_SECRET = 'secret_for_tests'
const test = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')

let mongod, mongoose
test.before(async () => {
  try {
    const { MongoMemoryServer } = require('mongodb-memory-server')
    mongod = await MongoMemoryServer.create()
    mongoose = require('mongoose')
    await mongoose.connect(mongod.getUri())
    for (const m of Object.values(mongoose.models)) await m.init()
  } catch (e) { console.log('SKIP concurrency:', e.message.split('\n')[0]); mongod = null }
})
test.after(async () => { if (mongoose) await mongoose.disconnect(); if (mongod) await mongod.stop() })
const needDb = (name, fn) => test(name, async (t) => { if (!mongod) return t.skip('no mongodb-memory-server'); await fn(t) })

const M = () => ({
  User: require('../../src/models/User'), Job: require('../../src/models/Job'), Bid: require('../../src/models/Bid'),
  Contract: require('../../src/models/Contract'), Milestone: require('../../src/models/Milestone'), Payment: require('../../src/models/Payment'),
  FP: require('../../src/models/FreelancerProfile'), Issue: require('../../src/models/Issue'),
})
let n = 0
const mkUser = (role) => M().User.create({ name: `${role}${++n}`, email: `u${n}_${Date.now()}@x.com`, passwordHash: 'x', role })
// Fires `calls` concurrently; returns { ok: [...values], failed: [...errors] }.
async function race(calls) {
  const r = await Promise.allSettled(calls.map((c) => c()))
  return { ok: r.filter((x) => x.status === 'fulfilled').map((x) => x.value), failed: r.filter((x) => x.status === 'rejected').map((x) => x.reason) }
}
async function world() {
  const { Job, Bid, Contract, Milestone } = M()
  const client = await mkUser('Client'), fl = await mkUser('Freelancer'), fl2 = await mkUser('Freelancer')
  const job = await Job.create({ clientId: client._id, title: 'J', description: 'd', budget: 100, status: 'Published' })
  const bid = await Bid.create({ jobId: job._id, freelancerId: fl._id, bidAmount: 50, proposal: 'p' })
  const bid2 = await Bid.create({ jobId: job._id, freelancerId: fl2._id, bidAmount: 60, proposal: 'p' })
  return { Job, Bid, Contract, Milestone, client, fl, fl2, job, bid, bid2 }
}

needDb('accept-bid: two DIFFERENT bids on one job at once -> exactly one contract, one Accepted, the other Rejected', async () => {
  const w = await world(); const bids = require('../../src/services/bidService')
  const { ok, failed } = await race([() => bids.accept(w.client, String(w.job._id), String(w.bid._id)), () => bids.accept(w.client, String(w.job._id), String(w.bid2._id))])
  assert.equal(ok.length, 1, `expected one winner, got ${ok.length} (failures: ${failed.map((e) => e.message)})`)
  assert.equal(await w.Contract.countDocuments({ jobId: w.job._id }), 1)
  assert.equal((await w.Job.findById(w.job._id)).status, 'In Progress')
  const statuses = (await w.Bid.find({ jobId: w.job._id })).map((b) => b.status).sort()
  assert.deepEqual(statuses, ['Accepted', 'Rejected'])
})

needDb('accept-bid: the SAME bid accepted 5x at once -> exactly one contract', async () => {
  const w = await world(); const bids = require('../../src/services/bidService')
  const { ok } = await race(Array.from({ length: 5 }, () => () => bids.accept(w.client, String(w.job._id), String(w.bid._id))))
  assert.equal(ok.length, 1); assert.equal(await w.Contract.countDocuments({ jobId: w.job._id }), 1)
})

async function heldPayment({ withAccount = false } = {}) {
  const { Payment, Milestone, FP } = M(); const w = await world()
  const contract = await w.Contract.create({ jobId: w.job._id, clientId: w.client._id, freelancerId: w.fl._id, status: 'Active' })
  const ms = await Milestone.create({ contractId: contract._id, title: 'M', amount: 40 })
  if (withAccount) await FP.create({ userId: w.fl._id, paymentAccount: { upiId: 'a@upi' } })
  const pay = await Payment.create({ milestoneId: ms._id, contractId: contract._id, clientId: w.client._id, freelancerId: w.fl._id, amount: 40, providerOrderId: `order_${Date.now()}_${Math.random()}` })
  return { ...w, contract, ms, pay }
}
const sign = (orderId, paymentId) => crypto.createHmac('sha256', 'secret_for_tests').update(`${orderId}|${paymentId}`).digest('hex')

needDb('fund: the same verified payment submitted 5x at once -> funded once, milestone.funded true, replays are harmless', async () => {
  const w = await heldPayment(); const pay = require('../../src/services/paymentService')
  const body = { razorpay_order_id: w.pay.providerOrderId, razorpay_payment_id: 'pay_1', razorpay_signature: sign(w.pay.providerOrderId, 'pay_1') }
  const { ok, failed } = await race(Array.from({ length: 5 }, () => () => pay.verifyPayment(w.client, body)))
  assert.equal(failed.length, 0, failed.map((e) => e.message).join('; '))
  assert.equal(ok.filter((r) => !r.alreadyProcessed).length, 1, 'exactly one caller performs the funding')
  const p = await M().Payment.findById(w.pay._id); assert.equal(p.status, 'Held'); assert.equal(p.providerPaymentId, 'pay_1')
  assert.equal((await M().Milestone.findById(w.ms._id)).funded, true)
})

needDb('fund: two DIFFERENT orders for one milestone paid at once -> only one becomes Held (fundedLock)', async () => {
  const { Payment } = M(); const w = await heldPayment(); const pay = require('../../src/services/paymentService')
  const other = await Payment.create({ milestoneId: w.ms._id, contractId: w.contract._id, clientId: w.client._id, freelancerId: w.fl._id, amount: 40, providerOrderId: `order_b_${Math.random()}` })
  const call = (p, id) => () => pay.verifyPayment(w.client, { razorpay_order_id: p.providerOrderId, razorpay_payment_id: id, razorpay_signature: sign(p.providerOrderId, id) })
  const { ok, failed } = await race([call(w.pay, 'pay_a'), call(other, 'pay_b')])
  assert.equal(ok.length, 1); assert.equal(failed.length, 1); assert.equal(failed[0].status ?? failed[0].statusCode, 409)
  assert.equal(await Payment.countDocuments({ milestoneId: w.ms._id, status: 'Held' }), 1)
})

needDb('payout dispatch: 5 admins at once -> paid exactly once', async () => {
  const { Payment } = M(); const w = await heldPayment({ withAccount: true }); const pay = require('../../src/services/paymentService')
  await Payment.updateOne({ _id: w.pay._id }, { $set: { status: 'Awaiting Payout', providerPaymentId: 'pay_x' } })
  const admin = await mkUser('Admin')
  const { ok, failed } = await race(Array.from({ length: 5 }, () => () => pay.dispatchPayout(admin, String(w.pay._id))))
  assert.equal(ok.length, 1); assert.equal(failed.length, 4)
  assert.equal((await Payment.findById(w.pay._id)).status, 'Paid')
})

needDb('refund: 5 admins at once -> the provider is called exactly once', async (t) => {
  const { Payment } = M(); const w = await heldPayment(); const pay = require('../../src/services/paymentService'); const rzp = require('../../src/services/razorpayService')
  await Payment.updateOne({ _id: w.pay._id }, { $set: { status: 'Held', providerPaymentId: 'pay_r', fundedLock: w.ms._id } })
  let calls = 0
  t.mock.method(rzp, 'refundPayment', async () => { calls++; await new Promise((r) => setTimeout(r, 30)); return { id: 'rfnd_1' } })
  const admin = await mkUser('Admin')
  const { ok } = await race(Array.from({ length: 5 }, () => () => pay.refundPayment(admin, String(w.pay._id), 'dup')))
  assert.equal(calls, 1, 'Razorpay refund API must be hit once'); assert.equal(ok.length, 1)
})

needDb('dispute resolve: 5 admins at once -> resolved once, one notification', async () => {
  const { Issue } = M(); const w = await heldPayment(); const issues = require('../../src/services/issueService')
  const Notification = require('../../src/models/Notification')
  const issue = await Issue.create({ contractId: w.contract._id, raisedBy: w.client._id, subject: 'late' })
  const admin = await mkUser('Admin')
  const { ok } = await race(Array.from({ length: 5 }, () => () => issues.resolve(admin, String(issue._id), 'fixed')))
  assert.equal(ok.length, 1)
  assert.equal(await Notification.countDocuments({ userId: w.client._id, title: 'Issue resolved' }), 1)
})
