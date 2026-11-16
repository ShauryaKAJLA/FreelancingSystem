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

const DEMO_PASSWORD = 'Password@123'
const SKILLS = [
  'React', 'Node.js', 'UI/UX Design', 'Figma', 'Python', 'Django', 'SQL', 'Tailwind CSS',
  'JavaScript', 'TypeScript', 'Next.js', 'Express', 'MongoDB', 'PostgreSQL', 'AWS',
  'Flutter', 'React Native', 'Swift', 'Kotlin', 'Photoshop', 'Illustrator', 'Branding',
  'SEO', 'Content Writing', 'Copywriting', 'Excel', 'Power BI', 'Data Visualization',
  'WordPress', 'Shopify', 'Video Editing', 'Social Media Marketing',
]
const USERS = [
  { name: 'Aisha Verma', email: 'aisha.verma@technova.com', role: 'Client', profile: { companyName: 'TechNova Solutions', website: 'technova.com' } },
  { name: 'Rohan Malhotra', email: 'rohan.malhotra@brightideas.co', role: 'Client', profile: { companyName: 'Bright Ideas Co', website: 'brightideas.co' } },
  { name: 'Priya Nair', email: 'priya.nair@greengrid.io', role: 'Client', profile: { companyName: 'GreenGrid', website: 'greengrid.io' } },
  { name: 'Arjun Mehta', email: 'arjun.mehta@northstar.co', role: 'Client', profile: { companyName: 'Northstar Learning', website: 'northstar.co' } },
  { name: 'Sara Khan', email: 'sara.khan@wellnest.health', role: 'Client', profile: { companyName: 'Wellnest Health', website: 'wellnest.health' } },
  { name: 'Dev Patel', email: 'dev.patel@marketlane.shop', role: 'Client', profile: { companyName: 'MarketLane', website: 'marketlane.shop' } },
  { name: 'Meera Iyer', email: 'meera.iyer@dev.com', role: 'Freelancer', profile: { bio: 'Full-stack developer specializing in React and Node.js, 5 years experience building web apps.', hourlyRate: 1800, rating: 4.8, skills: ['React', 'Node.js', 'Tailwind CSS'], paymentAccount: { holderName: 'Meera Iyer', upiId: 'meera@upi' } } },
  { name: 'Karan Shah', email: 'karan.shah@design.com', role: 'Freelancer', profile: { bio: 'Product designer focused on UI/UX for SaaS and e-commerce platforms.', hourlyRate: 1500, rating: 4.6, skills: ['UI/UX Design', 'Figma'] } },
  { name: 'Neha Kapoor', email: 'neha.kapoor@data.com', role: 'Freelancer', status: 'Flagged', profile: { bio: 'Backend engineer, Python/Django, data pipelines and automation.', hourlyRate: 2000, rating: 4.2, skills: ['Python', 'Django', 'SQL'] } },
  { name: 'Ishaan Rao', email: 'ishaan.rao@webcraft.dev', role: 'Freelancer', profile: { bio: 'Frontend engineer building fast, accessible React and Next.js products.', hourlyRate: 1700, skills: ['React', 'TypeScript', 'Next.js', 'Tailwind CSS'] } },
  { name: 'Ananya Bose', email: 'ananya.bose@pixelworks.design', role: 'Freelancer', profile: { bio: 'Brand and visual designer helping early-stage teams build memorable identities.', hourlyRate: 1400, skills: ['UI/UX Design', 'Figma', 'Branding', 'Illustrator'] } },
  { name: 'Vikram Joshi', email: 'vikram.joshi@mobileforge.app', role: 'Freelancer', profile: { bio: 'Mobile developer delivering reliable Flutter and React Native applications.', hourlyRate: 1900, skills: ['Flutter', 'React Native', 'JavaScript'] } },
  { name: 'Zoya Mirza', email: 'zoya.mirza@wordsandco.in', role: 'Freelancer', profile: { bio: 'Content strategist and copywriter for technology and lifestyle brands.', hourlyRate: 1100, skills: ['Content Writing', 'Copywriting', 'SEO'] } },
  { name: 'Kabir Singh', email: 'kabir.singh@cloudstack.dev', role: 'Freelancer', profile: { bio: 'Backend and cloud engineer working with Node.js, AWS, and MongoDB.', hourlyRate: 2300, skills: ['Node.js', 'Express', 'MongoDB', 'AWS'] } },
  { name: 'Riya Desai', email: 'riya.desai@insightdata.io', role: 'Freelancer', profile: { bio: 'Data analyst turning complex business data into clear dashboards and reports.', hourlyRate: 1600, skills: ['Python', 'SQL', 'Power BI', 'Data Visualization', 'Excel'] } },
  { name: 'Aditya Kulkarni', email: 'aditya.kulkarni@commercekit.dev', role: 'Freelancer', profile: { bio: 'E-commerce specialist building and optimizing Shopify and WordPress stores.', hourlyRate: 1500, skills: ['Shopify', 'WordPress', 'JavaScript', 'SEO'] } },
  { name: 'Maya Fernandes', email: 'maya.fernandes@motionhouse.media', role: 'Freelancer', profile: { bio: 'Video editor and social media creative producing polished campaign content.', hourlyRate: 1300, skills: ['Video Editing', 'Photoshop', 'Social Media Marketing'] } },
  { name: 'Sameer Khan', email: 'sameer.khan@iosstudio.dev', role: 'Freelancer', profile: { bio: 'Native iOS and Android developer focused on smooth mobile experiences.', hourlyRate: 2100, skills: ['Swift', 'Kotlin', 'React Native'] } },
  { name: 'Tara Menon', email: 'tara.menon@uxcollective.design', role: 'Freelancer', profile: { bio: 'UX researcher and interface designer for SaaS and healthcare products.', hourlyRate: 1750, skills: ['UI/UX Design', 'Figma', 'Photoshop'] } },
  { name: 'Omar Farooq', email: 'omar.farooq@datafoundry.io', role: 'Freelancer', profile: { bio: 'Data engineer experienced with PostgreSQL, Python, and reporting pipelines.', hourlyRate: 2200, skills: ['Python', 'PostgreSQL', 'SQL', 'AWS'] } },
  { name: 'Nisha Gupta', email: 'nisha.gupta@brandvoice.in', role: 'Freelancer', profile: { bio: 'Marketing writer creating SEO-friendly content and landing page copy.', hourlyRate: 1000, skills: ['Content Writing', 'Copywriting', 'SEO', 'Social Media Marketing'] } },
  { name: 'Rahul Sethi', email: 'rahul.sethi@apiworks.dev', role: 'Freelancer', profile: { bio: 'TypeScript backend developer with experience designing secure REST APIs.', hourlyRate: 2000, skills: ['TypeScript', 'Node.js', 'Express', 'PostgreSQL'] } },
  { name: 'Leena Thomas', email: 'leena.thomas@studioleaf.design', role: 'Freelancer', profile: { bio: 'Illustrator and visual designer creating friendly digital brand assets.', hourlyRate: 1250, skills: ['Illustrator', 'Photoshop', 'Branding', 'Figma'] } },
  { name: 'Manav Shah', email: 'manav.shah@analyticslab.io', role: 'Freelancer', profile: { bio: 'Business intelligence consultant building clean, useful Power BI dashboards.', hourlyRate: 1650, skills: ['Power BI', 'Excel', 'SQL', 'Data Visualization'] } },
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
  { owner: 'priya.nair@greengrid.io', title: 'Green Energy Monitoring Dashboard', description: 'Build a responsive dashboard that helps our operations team track energy production and usage across multiple sites.', budget: 52000, status: 'Published', skills: ['React', 'TypeScript', 'Data Visualization'], category: 'Web Development', experienceLevel: 'Expert', milestoneTasks: ['Dashboard wireframes', 'Charts and site filters', 'QA and handover'] },
  { owner: 'priya.nair@greengrid.io', title: 'Customer Portal API and Database', description: 'Create a documented API and data model for customer accounts, invoices, and service requests.', budget: 48000, status: 'Published', skills: ['Node.js', 'Express', 'PostgreSQL'], category: 'Web Development', experienceLevel: 'Expert', milestoneTasks: ['Schema and API design', 'Endpoints and tests'] },
  { owner: 'priya.nair@greengrid.io', title: 'Sustainability Brand Illustration Pack', description: 'Create a cohesive set of friendly illustrations for our sustainability reports and website.', budget: 18000, status: 'Published', skills: ['Illustrator', 'Branding'], category: 'Design', experienceLevel: 'Intermediate', milestoneTasks: ['Style exploration', 'Final illustration pack'] },
  { owner: 'arjun.mehta@northstar.co', title: 'Online Course Platform UI', description: 'Design a clear learning experience for students to browse courses, watch lessons, and track progress.', budget: 35000, status: 'Published', skills: ['UI/UX Design', 'Figma'], category: 'Design', experienceLevel: 'Intermediate', milestoneTasks: ['Student journey', 'Course screens', 'Interactive prototype'] },
  { owner: 'arjun.mehta@northstar.co', title: 'Learning App for iOS and Android', description: 'Build a cross-platform mobile app for our existing learning content and student accounts.', budget: 68000, status: 'Published', skills: ['Flutter', 'React Native'], category: 'Mobile Development', experienceLevel: 'Expert', milestoneTasks: ['App foundation', 'Course playback', 'Account and progress sync'] },
  { owner: 'arjun.mehta@northstar.co', title: 'Course Launch Email and Web Copy', description: 'Write concise launch copy for a new professional certificate, including landing page and email sequence.', budget: 14000, status: 'Published', skills: ['Copywriting', 'Content Writing'], category: 'Writing & Content', experienceLevel: 'Intermediate', milestoneTasks: ['Landing page draft', 'Email sequence'] },
  { owner: 'sara.khan@wellnest.health', title: 'Appointment Booking Website', description: 'Create an accessible booking website where patients can find providers and request appointments.', budget: 56000, status: 'Published', skills: ['Next.js', 'React', 'Tailwind CSS'], category: 'Web Development', experienceLevel: 'Expert', milestoneTasks: ['Public provider pages', 'Booking flow', 'Accessibility review'] },
  { owner: 'sara.khan@wellnest.health', title: 'Healthcare Insights Report Dashboard', description: 'Turn monthly appointment and retention spreadsheets into an interactive internal reporting dashboard.', budget: 26000, status: 'Published', skills: ['Power BI', 'Excel', 'Data Visualization'], category: 'Data & Analytics', experienceLevel: 'Intermediate', milestoneTasks: ['Data cleanup', 'Dashboard and documentation'] },
  { owner: 'sara.khan@wellnest.health', title: 'Patient Education Article Series', description: 'Write an approachable series of evidence-aware articles for our patient resource center.', budget: 12000, status: 'Published', skills: ['Content Writing', 'SEO'], category: 'Writing & Content', experienceLevel: 'Intermediate', milestoneTasks: ['Outline and sources', 'Four reviewed articles'] },
  { owner: 'dev.patel@marketlane.shop', title: 'Shopify Storefront Speed Improvements', description: 'Audit and improve storefront performance, mobile usability, and key product page conversion paths.', budget: 30000, status: 'Published', skills: ['Shopify', 'JavaScript', 'SEO'], category: 'Web Development', experienceLevel: 'Expert', milestoneTasks: ['Performance audit', 'Theme improvements', 'Results summary'] },
  { owner: 'dev.patel@marketlane.shop', title: 'Product Photography Social Campaign', description: 'Prepare a batch of product visuals and social media assets for our upcoming seasonal campaign.', budget: 20000, status: 'Published', skills: ['Photoshop', 'Social Media Marketing'], category: 'Marketing', experienceLevel: 'Intermediate', milestoneTasks: ['Creative direction', 'Asset production'] },
  { owner: 'dev.patel@marketlane.shop', title: 'Short Product Demo Video Editing', description: 'Edit a set of short product demos for our store, with captions and versions for social channels.', budget: 16000, status: 'Published', skills: ['Video Editing', 'Social Media Marketing'], category: 'Marketing', experienceLevel: 'Intermediate', milestoneTasks: ['Edit first two videos', 'Final exports and captions'] },
  { owner: 'aisha.verma@technova.com', title: 'Inventory Management Mobile App', description: 'Develop a mobile companion for warehouse staff to scan items and update stock levels.', budget: 62000, status: 'Published', skills: ['React Native', 'Node.js', 'MongoDB'], category: 'Mobile Development', experienceLevel: 'Expert', milestoneTasks: ['Mobile app prototype', 'Inventory API integration', 'Pilot release'] },
  { owner: 'rohan.malhotra@brightideas.co', title: 'SaaS Product Logo and Brand Kit', description: 'Create a distinctive logo and compact brand kit for our upcoming productivity product.', budget: 17000, status: 'Published', skills: ['Branding', 'Figma', 'Illustrator'], category: 'Design', experienceLevel: 'Intermediate', milestoneTasks: ['Concepts', 'Final logo and brand guide'] },
  { owner: 'priya.nair@greengrid.io', title: 'Monthly Energy Data Cleanup', description: 'Clean several years of operational CSV data and prepare a reusable validation workflow.', budget: 24000, status: 'Published', skills: ['Python', 'Excel', 'SQL'], category: 'Data & Analytics', experienceLevel: 'Intermediate', milestoneTasks: ['Data profiling', 'Cleanup scripts', 'Validation notes'] },
  { owner: 'arjun.mehta@northstar.co', title: 'WordPress Course Resource Library', description: 'Set up a searchable resource library that fits our current WordPress site and is easy to maintain.', budget: 21000, status: 'Published', skills: ['WordPress', 'SEO'], category: 'Web Development', experienceLevel: 'Intermediate', milestoneTasks: ['Content structure', 'Build and migration', 'Editor handoff'] },
  { owner: 'sara.khan@wellnest.health', title: 'Provider Scheduling iOS Feature', description: 'Add a polished appointment availability and scheduling flow to our existing iOS application.', budget: 39000, status: 'Published', skills: ['Swift', 'UI/UX Design'], category: 'Mobile Development', experienceLevel: 'Expert', milestoneTasks: ['Flow specification', 'Scheduling implementation'] },
  { owner: 'dev.patel@marketlane.shop', title: 'E-commerce Orders Analytics', description: 'Create a weekly view of order, refund, and repeat-customer trends for our operations team.', budget: 23000, status: 'Published', skills: ['SQL', 'Power BI', 'Data Visualization'], category: 'Data & Analytics', experienceLevel: 'Intermediate', milestoneTasks: ['Metrics definition', 'Dashboard delivery'] },
  { owner: 'aisha.verma@technova.com', title: 'Developer Documentation Refresh', description: 'Rewrite our public API getting-started guides with clear examples and a consistent voice.', budget: 11000, status: 'Published', skills: ['Content Writing', 'Copywriting'], category: 'Writing & Content', experienceLevel: 'Intermediate', milestoneTasks: ['Documentation audit', 'Revised guides'] },
  { owner: 'rohan.malhotra@brightideas.co', title: 'Customer Feedback Admin Panel', description: 'Build an internal panel to review customer feedback, filter submissions, and export reports.', budget: 44000, status: 'Published', skills: ['React', 'Node.js', 'MongoDB'], category: 'Web Development', experienceLevel: 'Expert', milestoneTasks: ['Admin panel layout', 'API and filters', 'Export and QA'] },
  { owner: 'priya.nair@greengrid.io', title: 'Social Media Content Calendar', description: 'Plan a month of practical social posts that explain our renewable energy projects to local communities.', budget: 13000, status: 'Published', skills: ['Social Media Marketing', 'Content Writing'], category: 'Marketing', experienceLevel: 'Intermediate', milestoneTasks: ['Content themes', 'Calendar and post drafts'] },
  { owner: 'arjun.mehta@northstar.co', title: 'Student Progress API', description: 'Develop a reliable API for course enrollment, lesson completion, and student progress summaries.', budget: 36000, status: 'Published', skills: ['Django', 'Python', 'PostgreSQL'], category: 'Web Development', experienceLevel: 'Expert', milestoneTasks: ['Data model', 'API endpoints', 'Tests and documentation'] },
  { owner: 'sara.khan@wellnest.health', title: 'Wellness App Android Prototype', description: 'Create an Android prototype for daily wellness check-ins and appointment reminders.', budget: 32000, status: 'Published', skills: ['Kotlin', 'UI/UX Design'], category: 'Mobile Development', experienceLevel: 'Intermediate', milestoneTasks: ['Prototype screens', 'Check-in and reminder flows'] },
  { owner: 'dev.patel@marketlane.shop', title: 'Marketplace Landing Page Copy', description: 'Write concise, search-friendly copy for our new marketplace category pages and homepage sections.', budget: 10000, status: 'Published', skills: ['Copywriting', 'SEO'], category: 'Writing & Content', experienceLevel: 'Entry', milestoneTasks: ['Homepage copy', 'Category page set'] },
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
// Seed a client-owned issue without creating or changing any admin records.
async function seedIssues() {
  if (await Issue.exists({})) return
  const aisha = await User.findOne({ email: 'aisha.verma@technova.com' })
  const active = aisha && (await Contract.findOne({ clientId: aisha._id, status: 'Active' }))
  if (active) await Issue.create({ contractId: active._id, raisedBy: aisha._id, subject: 'Freelancer responsiveness concern', status: 'Open' })
  if (active) console.log('seeded demo issue')
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

async function seedMatchingBids() {
  const demoFreelancerEmails = USERS.filter((user) => user.role === 'Freelancer').map((user) => user.email)
  const demoFreelancers = await User.find({ email: { $in: demoFreelancerEmails }, role: 'Freelancer', status: 'Active' }).select('_id').lean()
  const profiles = await FreelancerProfile.find({ userId: { $in: demoFreelancers.map((user) => user._id) } }).select('userId skillIds').lean()
  const jobs = await Job.find({ title: { $in: JOBS.map((job) => job.title) }, status: 'Published' })
    .select('title budget category requiredSkillIds').lean()
  const percentages = [0.92, 0.98, 1.04]

  for (const job of jobs) {
    const required = new Set(job.requiredSkillIds.map(String))
    const matching = profiles.filter((profile) => profile.skillIds.some((id) => required.has(String(id))))
    const candidates = (matching.length ? matching : profiles).slice(0, 3)

    for (const [index, profile] of candidates.entries()) {
      if (await Bid.exists({ jobId: job._id, freelancerId: profile.userId })) continue
      await Bid.create({
        jobId: job._id,
        freelancerId: profile.userId,
        bidAmount: Math.max(1, Math.round(job.budget * percentages[index])),
        proposal: `I would be glad to help with "${job.title}". My experience is a strong fit for this ${(job.category || 'freelance').toLowerCase()} project, and I can provide clear milestones and regular progress updates.`,
        status: 'Pending',
        bidDate: new Date(Date.now() - (index + 1) * 24 * 60 * 60 * 1000),
      })
    }
  }
}

async function seed() {
  if (env.nodeEnv === 'production') throw new Error('Refusing to seed demo data in production.')
  if (process.argv.includes('--reset')) throw new Error('The seed script no longer supports --reset; it never deletes existing data.')
  await connectDB()

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
  await seedMatchingBids()
  await seedIssues()
  console.log(`Done. Demo password: ${DEMO_PASSWORD}`)
}

seed()
  .catch((e) => { console.error(e.message); process.exitCode = 1 })
  .finally(() => mongoose.disconnect())
