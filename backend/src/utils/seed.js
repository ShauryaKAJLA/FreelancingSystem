// Creates demo accounts mirroring the frontend mock users. Safe to re-run (skips existing emails).
// Usage: npm run seed      (demo password for all accounts: Password@123)
const bcrypt = require('bcryptjs')
const mongoose = require('mongoose')
const env = require('../config/env')
const connectDB = require('../config/db')
const User = require('../models/User')
const Skill = require('../models/Skill')
const ClientProfile = require('../models/ClientProfile')
const FreelancerProfile = require('../models/FreelancerProfile')
const Job = require('../models/Job')
const Contract = require('../models/Contract')
const Milestone = require('../models/Milestone')
const Bid = require('../models/Bid')
const Payment = require('../models/Payment')
const Issue = require('../models/Issue')
const AdminAction = require('../models/AdminAction')

const DEMO_PASSWORD = 'Password@123'
// Same 8 skills, in the same order, as the frontend mock (s1..s8).
const SKILLS = ['React', 'Node.js', 'UI/UX Design', 'Figma', 'Python', 'Django', 'SQL', 'Tailwind CSS']
const USERS = [
  { name: 'System Admin', email: 'admin@platform.com', role: 'Admin' },
  { name: 'Aisha Verma', email: 'aisha.verma@technova.com', role: 'Client', profile: { companyName: 'TechNova Solutions', website: 'technova.com' } },
  { name: 'Rohan Malhotra', email: 'rohan.malhotra@brightideas.co', role: 'Client', profile: { companyName: 'Bright Ideas Co', website: 'brightideas.co' } },
  { name: 'Meera Iyer', email: 'meera.iyer@dev.com', role: 'Freelancer', profile: { bio: 'Full-stack developer specializing in React and Node.js, 5 years experience building web apps.', hourlyRate: 1800, rating: 4.8, skills: ['React', 'Node.js', 'Tailwind CSS'], paymentAccount: { holderName: 'Meera Iyer', upiId: 'meera@upi' } } },
  { name: 'Karan Shah', email: 'karan.shah@design.com', role: 'Freelancer', profile: { bio: 'Product designer focused on UI/UX for SaaS and e-commerce platforms.', hourlyRate: 1500, rating: 4.6, skills: ['UI/UX Design', 'Figma'] } },
  { name: 'Neha Kapoor', email: 'neha.kapoor@data.com', role: 'Freelancer', status: 'Flagged', profile: { bio: 'Backend engineer, Python/Django, data pipelines and automation.', hourlyRate: 2000, rating: 4.2, skills: ['Python', 'Django', 'SQL'] } },
]

// The frontend's demo jobs j1..j7 (owner = client email). Skipped per-title if they already exist.
const JOBS = [
  { owner: 'aisha.verma@technova.com', title: 'E-commerce Website Redesign', description: 'Redesign our existing storefront with a modern responsive UI. Must integrate with our current product catalog API.', budget: 45000, status: 'Published', skills: ['React', 'Tailwind CSS'], category: 'Web Development', experienceLevel: 'Expert', milestoneTasks: ['Design system + homepage', 'Catalog + checkout pages'] },
  { owner: 'aisha.verma@technova.com', title: 'Mobile App API Integration', description: 'Integrate our mobile app with a new payments and notifications backend service.', budget: 38000, status: 'In Progress', skills: ['React', 'Node.js'], category: 'Mobile Development', experienceLevel: 'Intermediate', milestoneTasks: ['Backend service scaffolding', 'Payments + notifications integration'] },
  { owner: 'rohan.malhotra@brightideas.co', title: 'Brand Identity & Landing Page', description: 'Design a new brand identity and a single-page marketing site for product launch.', budget: 22000, status: 'Closed', skills: ['UI/UX Design', 'Figma'], category: 'Design', experienceLevel: 'Intermediate', milestoneTasks: ['Brand identity', 'Landing page'] },
  { owner: 'rohan.malhotra@brightideas.co', title: 'Data Pipeline Automation', description: 'Automate our weekly reporting pipeline: ingest CSVs, clean, load into warehouse, schedule runs.', budget: 30000, status: 'Published', skills: ['Python', 'SQL'], category: 'Data & Analytics', experienceLevel: 'Expert', milestoneTasks: ['Ingestion + cleaning', 'Warehouse load + scheduling'] },
  { owner: 'aisha.verma@technova.com', title: 'Landing Page Copywriting', description: 'Write conversion-focused copy for three new product landing pages, plus a short email sequence.', budget: 9000, status: 'Published', skills: [], category: 'Writing & Content', experienceLevel: 'Entry', milestoneTasks: ['Landing page copy'] },
  { owner: 'rohan.malhotra@brightideas.co', title: 'Junior React Dashboard Fixes', description: 'Small, well-scoped bug fixes and minor UI tweaks on an existing internal React dashboard. Good for someone early in their career.', budget: 12000, status: 'Published', skills: ['React'], category: 'Web Development', experienceLevel: 'Entry', milestoneTasks: ['Bug fixes'] },
  { owner: 'aisha.verma@technova.com', title: 'Internal Style Guide Illustrations', description: 'A short set of custom illustrations for our internal design system docs. Still finalizing scope before posting.', budget: 15000, status: 'Draft', skills: ['UI/UX Design'], category: 'Design', experienceLevel: 'Intermediate', milestoneTasks: ['Illustration set'] },
]

async function seedJobs(skillDocs) {
  for (const j of JOBS) {
    if (await Job.exists({ title: j.title })) { console.log(`skip  job "${j.title}"`); continue }
    const owner = await User.findOne({ email: j.owner })
    if (!owner) { console.log(`skip  job "${j.title}" (owner missing)`); continue }
    const { owner: _o, skills, ...rest } = j
    await Job.create({ ...rest, clientId: owner._id, requiredSkillIds: skills.map((n) => skillDocs[n]._id), numberOfMilestones: j.milestoneTasks.length })
    console.log(`added job "${j.title}" (${j.status})`)
  }
}

// Demo contracts so payments / messages / reviews can be exercised before Phase 3-4 exist.
async function seedContracts() {
  const byEmail = async (email) => User.findOne({ email })
  const [aisha, rohan, meera, karan] = await Promise.all([
    byEmail('aisha.verma@technova.com'), byEmail('rohan.malhotra@brightideas.co'), byEmail('meera.iyer@dev.com'), byEmail('karan.shah@design.com'),
  ])
  if (!aisha || !rohan || !meera || !karan) return console.log('skip  demo contracts (demo users missing)')
  const day = 24 * 3600 * 1000
  const now = Date.now()

  const activeJob = await Job.findOne({ title: 'Mobile App API Integration' })
  if (activeJob && !(await Contract.exists({ jobId: activeJob._id }))) {
    const job = activeJob
    const contract = await Contract.create({ jobId: job._id, clientId: aisha._id, freelancerId: meera._id, startDate: new Date(now - 30 * day), status: 'Active' })
    const m1 = await Milestone.create({ contractId: contract._id, title: 'Backend service scaffolding', amount: 15000, status: 'Completed', dueDate: new Date(now - 10 * day), funded: true })
    await Milestone.create({ contractId: contract._id, title: 'Payments + notifications integration', amount: 21000, status: 'Pending', dueDate: new Date(now + 20 * day), funded: false })
    await Payment.create({ milestoneId: m1._id, contractId: contract._id, clientId: aisha._id, freelancerId: meera._id, amount: 15000, providerOrderId: 'order_seed_demo_1', providerPaymentId: 'pay_seed_demo_1', status: 'Paid', paidAt: new Date(now - 20 * day), payoutAt: new Date(now - 9 * day), payoutReference: 'seed_payout_1', payoutTo: 'meera@upi', adminVerified: true, fundedLock: m1._id })
    console.log('added demo Active contract (Aisha <-> Meera) with 2 milestones')
  }
  const doneJob = await Job.findOne({ title: 'Brand Identity & Landing Page' })
  if (doneJob && !(await Contract.exists({ jobId: doneJob._id }))) {
    const job = doneJob
    const done = await Contract.create({ jobId: job._id, clientId: rohan._id, freelancerId: karan._id, startDate: new Date(now - 60 * day), endDate: new Date(now - 30 * day), status: 'Completed' })
    // The frontend's m3 / m4 (both approved and paid out).
    const m3 = await Milestone.create({ contractId: done._id, title: 'Brand identity draft', amount: 8000, status: 'Completed', dueDate: new Date(now - 45 * day), funded: true })
    const m4 = await Milestone.create({ contractId: done._id, title: 'Landing page + final delivery', amount: 13000, status: 'Completed', dueDate: new Date(now - 31 * day), funded: true })
    await Payment.create({ milestoneId: m3._id, contractId: done._id, clientId: rohan._id, freelancerId: karan._id, amount: 8000, providerOrderId: 'order_seed_demo_2', providerPaymentId: 'pay_seed_demo_2', status: 'Paid', paidAt: new Date(now - 50 * day), payoutAt: new Date(now - 44 * day), payoutReference: 'seed_payout_2', payoutTo: 'karan@upi', adminVerified: true, fundedLock: m3._id })
    await Payment.create({ milestoneId: m4._id, contractId: done._id, clientId: rohan._id, freelancerId: karan._id, amount: 13000, providerOrderId: 'order_seed_demo_3', providerPaymentId: 'pay_seed_demo_3', status: 'Paid', paidAt: new Date(now - 35 * day), payoutAt: new Date(now - 30 * day), payoutReference: 'seed_payout_3', payoutTo: 'karan@upi', adminVerified: true, fundedLock: m4._id })
    console.log('added demo Completed contract (Rohan <-> Karan) with 2 paid milestones - ready for reviews')
  }
}

// The frontend's demo bids b1..b6 (job title, freelancer email). Skipped per (job, freelancer) if one already exists.
const BIDS = [
  { job: 'E-commerce Website Redesign', by: 'meera.iyer@dev.com', bidAmount: 42000, status: 'Pending', daysAgo: 57, proposal: 'I can deliver a fully responsive redesign in 4 weeks using React + Tailwind, matching your existing catalog API.' },
  { job: 'E-commerce Website Redesign', by: 'karan.shah@design.com', bidAmount: 44000, status: 'Pending', daysAgo: 56, proposal: 'My focus is UI/UX — I would start with a Figma prototype before implementation, ensuring stakeholder sign-off early.' },
  { job: 'Mobile App API Integration', by: 'meera.iyer@dev.com', bidAmount: 36000, status: 'Accepted', daysAgo: 80, proposal: 'I have built similar payment/notification integrations before. Estimated 5 weeks.' },
  { job: 'Mobile App API Integration', by: 'neha.kapoor@data.com', bidAmount: 39000, status: 'Rejected', daysAgo: 79, proposal: 'Backend-heavy experience, can also handle the API layer end-to-end.' },
  { job: 'Brand Identity & Landing Page', by: 'karan.shah@design.com', bidAmount: 21000, status: 'Accepted', daysAgo: 100, proposal: 'Full brand identity + landing page, 3-week turnaround with 2 revision rounds.' },
  { job: 'Data Pipeline Automation', by: 'neha.kapoor@data.com', bidAmount: 28000, status: 'Pending', daysAgo: 25, proposal: 'I can set this up with Python + SQL, scheduled via cron, with a monitoring dashboard.' },
]
// Phase 6: two reported issues (one Open, one Resolved) and a few audit rows so the admin Reports / System Logs pages have data.
async function seedIssues() {
  if (await Issue.exists({})) return
  const [aisha, rohan, admin] = await Promise.all([
    User.findOne({ email: 'aisha.verma@technova.com' }), User.findOne({ email: 'rohan.malhotra@brightideas.co' }), User.findOne({ role: 'Admin' }),
  ])
  const active = aisha && (await Contract.findOne({ clientId: aisha._id, status: 'Active' }))
  const done = rohan && (await Contract.findOne({ clientId: rohan._id, status: 'Completed' }))
  const day = 24 * 60 * 60 * 1000
  if (active) await Issue.create({ contractId: active._id, raisedBy: aisha._id, subject: 'Freelancer responsiveness concern', status: 'Open' })
  if (done && admin) await Issue.create({ contractId: done._id, raisedBy: rohan._id, subject: 'Milestone payment delay query', status: 'Resolved', resolution: 'Payout confirmed.', resolvedBy: admin._id, resolvedAt: new Date(Date.now() - 20 * day) })
  if (admin) {
    await AdminAction.create({ adminId: admin._id, actionType: 'Profile Verification', actionDescription: 'Verified freelancer profile for Meera Iyer.', createdAt: new Date(Date.now() - 60 * day) })
    if (done) await AdminAction.create({ adminId: admin._id, actionType: 'Dispute Resolution', actionDescription: 'Resolved payment dispute on a completed contract in favor of the freelancer.', createdAt: new Date(Date.now() - 20 * day) })
  }
  console.log('seeded issues + admin actions')
}

async function seedBids() {
  for (const b of BIDS) {
    const [job, user] = await Promise.all([Job.findOne({ title: b.job }), User.findOne({ email: b.by })])
    if (!job || !user) { console.log(`skip  bid on "${b.job}" (job or freelancer missing)`); continue }
    if (await Bid.exists({ jobId: job._id, freelancerId: user._id })) { console.log(`skip  bid ${b.by} -> "${b.job}"`); continue }
    await Bid.create({ jobId: job._id, freelancerId: user._id, bidAmount: b.bidAmount, proposal: b.proposal, status: b.status, bidDate: new Date(Date.now() - b.daysAgo * 24 * 3600 * 1000) })
    console.log(`added bid ${b.by} -> "${b.job}" (${b.status})`)
  }
}

async function seed() {
  if (env.nodeEnv === 'production') throw new Error('Refusing to seed demo data in production.')
  await connectDB()
  // `npm run seed -- --reset` wipes the whole dev database first (never in production - guarded above).
  if (process.argv.includes('--reset')) { await mongoose.connection.dropDatabase(); console.log('dropped database') }

  const skillDocs = {}
  for (const name of SKILLS) skillDocs[name] = await Skill.findOneAndUpdate({ name }, { name }, { upsert: true, new: true })

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12)
  for (const u of USERS) {
    if (await User.exists({ email: u.email })) { console.log(`skip  ${u.email}`); continue }
    const user = await User.create({ name: u.name, email: u.email, role: u.role, status: u.status || 'Active', passwordHash })
    if (u.role === 'Client') await ClientProfile.create({ userId: user._id, ...u.profile })
    if (u.role === 'Freelancer') {
      const { skills, ...rest } = u.profile
      await FreelancerProfile.create({ userId: user._id, ...rest, skillIds: skills.map((s) => skillDocs[s]._id) })
    }
    console.log(`added ${u.email} (${u.role})`)
  }

  await seedJobs(skillDocs)
  await seedContracts()
  await seedBids()
  await seedIssues()
  console.log(`Done. Demo password: ${DEMO_PASSWORD}`)
}

seed()
  .catch((e) => { console.error(e.message); process.exitCode = 1 })
  .finally(() => mongoose.disconnect())
