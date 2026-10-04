// Runs explain('executionStats') on every paged/filtered list query against YOUR database and flags collection scans.
// Usage: npm run seed -- --reset && npm run explain:lists      (needs MONGODB_URI like the server; read-only)
require('dotenv').config()
const mongoose = require('mongoose')
const Job = require('../src/models/Job')
const Bid = require('../src/models/Bid')
const Contract = require('../src/models/Contract')
const Payment = require('../src/models/Payment')
const User = require('../src/models/User')
const Notification = require('../src/models/Notification')
const FreelancerProfile = require('../src/models/FreelancerProfile')

const stagesOf = (node, out = []) => { if (!node) return out; out.push(node.stage); stagesOf(node.inputStage, out); (node.inputStages || []).forEach((s) => stagesOf(s, out)); return out }

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/freelanceflow')
  const client = await User.findOne({ role: 'Client' }), fl = await User.findOne({ role: 'Freelancer' })
  if (!client || !fl) throw new Error('Seed the database first (npm run seed -- --reset)')
  const c = client._id, f = fl._id
  const cases = [
    ['jobs: client list', Job, { clientId: c }, { createdAt: -1, _id: -1 }],
    ['jobs: client list + status', Job, { clientId: c, status: 'Published' }, { createdAt: -1, _id: -1 }],
    ['jobs: open (browse)', Job, { status: 'Published' }, { createdAt: -1, _id: -1 }],
    ['jobs: open + budget sort', Job, { status: 'Published' }, { budget: -1, _id: -1 }],
    ['bids: freelancer list', Bid, { freelancerId: f }, { bidDate: -1, _id: -1 }],
    ['bids: freelancer + status', Bid, { freelancerId: f, status: 'Pending' }, { bidDate: -1, _id: -1 }],
    ['bids: open bids per job set', Bid, { jobId: { $in: (await Job.find({ clientId: c }).limit(20)).map((j) => j._id) }, status: { $in: ['Pending', 'Updated'] } }, { _id: 1 }],
    ['contracts: client list', Contract, { clientId: c }, { createdAt: -1, _id: -1 }],
    ['contracts: client + status', Contract, { clientId: c, status: 'Active' }, { createdAt: -1, _id: -1 }],
    ['contracts: freelancer list', Contract, { freelancerId: f }, { createdAt: -1, _id: -1 }],
    ['contracts: admin by status', Contract, { status: 'Active' }, { createdAt: -1, _id: -1 }],
    ['payments: client list', Payment, { clientId: c }, { paidAt: -1, createdAt: -1, _id: -1 }],
    ['payments: freelancer list', Payment, { freelancerId: f }, { paidAt: -1, createdAt: -1, _id: -1 }],
    ['payments: admin by status', Payment, { status: 'Awaiting Payout' }, { createdAt: -1, _id: -1 }],
    ['notifications: list', Notification, { userId: c }, { createdAt: -1, _id: -1 }],
    ['notifications: unread', Notification, { userId: c, isRead: false }, { createdAt: -1, _id: -1 }],
    ['users: admin by role', User, { role: 'Client' }, { createdAt: -1, _id: -1 }],
  ]
  let bad = 0
  for (const [name, Model, filter, sort] of cases) {
    const ex = await Model.find(filter).sort(sort).limit(20).explain('executionStats')
    const st = ex.executionStats, stages = stagesOf(ex.queryPlanner.winningPlan)
    const scan = stages.includes('COLLSCAN'), memSort = stages.includes('SORT')
    if (scan || memSort) bad++
    console.log(`${scan ? 'SCAN ' : memSort ? 'MSORT' : 'ok   '} ${name.padEnd(34)} examined ${st.totalDocsExamined} docs / ${st.totalKeysExamined} keys -> ${st.nReturned} returned  [${stages.join('>')}]`)
  }
  // discovery aggregation (profile side)
  const agg = await FreelancerProfile.aggregate([{ $match: { rating: { $gte: 0 } } }, { $sort: { rating: -1, _id: 1 } }, { $limit: 20 }]).explain('executionStats')
  console.log('discovery profile $match+$sort: ', JSON.stringify(agg.stages?.[0]?.$cursor?.queryPlanner?.winningPlan?.stage ?? agg.queryPlanner?.winningPlan?.stage))
  console.log(bad ? `\n${bad} query shape(s) scan or sort in memory — tiny seed data can hide this; re-run with ≥10k docs per collection before adding indexes.` : '\nAll list queries use an index and need no in-memory sort.')
  await mongoose.disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
