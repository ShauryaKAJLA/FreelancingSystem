// Phase 6: admin, issues, search. Service/validator-level tests with stubbed models (no MongoDB).
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test_secret_test_secret_test_secret_123'

const test = require('node:test')
const assert = require('node:assert/strict')
const User = require('../src/models/User')
const Job = require('../src/models/Job')
const Contract = require('../src/models/Contract')
const Payment = require('../src/models/Payment')
const Review = require('../src/models/Review')
const Issue = require('../src/models/Issue')
const AdminAction = require('../src/models/AdminAction')
const notifications = require('../src/services/notificationService')
const adminActions = require('../src/services/adminActionService')
const issues = require('../src/services/issueService')
const admin = require('../src/services/adminService')
const search = require('../src/services/searchService')
const reviewService = require('../src/services/reviewService')
const { validateRaiseIssue, validateResolveIssue } = require('../src/validators/issueValidators')
const { validateModerateReview, validateAdminProfile } = require('../src/validators/adminValidators')

const A = 'a'.repeat(24), B = 'b'.repeat(24), C = 'c'.repeat(24), AD = 'd'.repeat(24), CT = '1'.repeat(24), JOB = '4'.repeat(24), IS = '7'.repeat(24), RV = '8'.repeat(24)
const date = new Date('2025-10-01T10:00:00Z')
const chain = (rows) => { const p = Promise.resolve(rows); const c = { sort: () => c, skip: () => c, limit: () => c, select: () => c, then: p.then.bind(p), catch: p.catch.bind(p) }; return c }
const status = (e) => e.statusCode ?? e.status
const run = (mw, body) => { const req = { body }; mw(req, {}, () => {}); return req.body }
const throws = (fn, code, msg) => assert.throws(fn, (e) => status(e) === code && (msg === undefined || e.message === msg))

test.beforeEach((t) => {
  t.mock.method(notifications, 'notify', async () => null)
  t.mock.method(notifications, 'notifyAdmins', async () => [])
  t.mock.method(AdminAction, 'create', async (d) => ({ _id: 'e'.repeat(24), ...d }))
})

// ── validators ─────────────────────────────────────────────────────────────────────────────
test('raise-issue validator: mock message for empty subject, raisedBy dropped, tags stripped', () => {
  throws(() => run(validateRaiseIssue, { contractId: CT, subject: '   ' }), 400, 'Describe the issue before submitting.')
  throws(() => run(validateRaiseIssue, { contractId: 'nope', subject: 'x' }), 400)
  assert.deepEqual(run(validateRaiseIssue, { contractId: CT, subject: ' <b>Late</b> delivery ', raisedBy: B }), { contractId: CT, subject: 'Late delivery' })
})
test('moderation + profile validators', () => {
  throws(() => run(validateModerateReview, { action: 'delete' }), 400, 'Unknown moderation action.')
  assert.deepEqual(run(validateModerateReview, { action: 'hide', status: 'x' }), { action: 'hide' })
  throws(() => run(validateAdminProfile, { name: '  ' }), 400, 'Name is required.')
  throws(() => run(validateAdminProfile, { email: '' }), 400, 'Email is required.')
  assert.deepEqual(run(validateAdminProfile, { name: ' Root ', email: 'r@x.com', role: 'Client' }), { name: 'Root', email: 'r@x.com' })
})
test('resolve validator whitelists resolution', () => {
  assert.deepEqual(run(validateResolveIssue, { resolution: 'ok', status: 'Open' }), { resolution: 'ok' })
  assert.deepEqual(run(validateResolveIssue, {}), {})
})

// ── issues ─────────────────────────────────────────────────────────────────────────────────
test('raise: only a contract party, reporter from the token, admins notified, DTO shape', async (t) => {
  t.mock.method(Contract, 'findById', async () => ({ _id: CT, clientId: A, freelancerId: B }))
  let saved
  t.mock.method(Issue, 'create', async (d) => { saved = d; return { _id: IS, createdAt: date, status: 'Open', ...d } })
  await assert.rejects(() => issues.raise({ _id: C, name: 'Stranger' }, { contractId: CT, subject: 's' }), (e) => status(e) === 404)
  const dto = await issues.raise({ _id: A, name: 'Aisha' }, { contractId: CT, subject: 'Late' })
  assert.equal(saved.raisedBy, A)
  assert.deepEqual(dto, { issueId: IS, relatedContractId: CT, raisedBy: A, subject: 'Late', status: 'Open', raisedDate: '2025-10-01T10:00:00.000Z', resolution: null, resolvedAt: null })
  assert.equal(notifications.notifyAdmins.mock.callCount(), 1)
})

test('list: admins see all (with joined names), others only their own', async (t) => {
  const rows = [{ _id: IS, contractId: CT, raisedBy: A, subject: 'Late', status: 'Open', createdAt: date }]
  let filter
  t.mock.method(Issue, 'find', (f) => { filter = f; return chain(rows) })
  t.mock.method(Contract, 'find', () => chain([{ _id: CT, jobId: JOB, clientId: A, freelancerId: B, status: 'Active' }]))
  t.mock.method(Job, 'find', () => chain([{ _id: JOB, title: 'Site' }]))
  t.mock.method(User, 'find', () => chain([{ _id: A, name: 'Aisha' }, { _id: B, name: 'Meera' }]))
  const out = await issues.list({ _id: AD, role: 'Admin' }, {})
  assert.deepEqual(filter, {})
  assert.deepEqual([out[0].jobTitle, out[0].raisedByName, out[0].clientName, out[0].freelancerName, out[0].contractStatus], ['Site', 'Aisha', 'Aisha', 'Meera', 'Active'])
  await issues.list({ _id: A, role: 'Client' }, { status: 'Open' })
  assert.deepEqual(filter, { raisedBy: A, status: 'Open' })
})

test('resolve: once only, conditional update, audit row + raiser notified', async (t) => {
  t.mock.method(Issue, 'findById', async () => ({ _id: IS, status: 'Resolved' }))
  await assert.rejects(() => issues.resolve({ _id: AD }, IS, 'x'), (e) => status(e) === 400 && e.message === 'This issue has already been resolved.')
  t.mock.method(Issue, 'findById', async () => ({ _id: IS, status: 'Open' }))
  let cond
  t.mock.method(Issue, 'findOneAndUpdate', async (f) => { cond = f; return null })
  await assert.rejects(() => issues.resolve({ _id: AD }, IS), (e) => status(e) === 400) // lost the race
  assert.equal(cond.status, 'Open')
  t.mock.method(Issue, 'findOneAndUpdate', async () => ({ _id: IS, contractId: CT, raisedBy: A, subject: 'Late', status: 'Resolved', createdAt: date }))
  const dto = await issues.resolve({ _id: AD }, IS, 'fixed')
  assert.equal(dto.status, 'Resolved')
  const logged = AdminAction.create.mock.calls.at(-1).arguments[0]
  assert.equal(logged.actionType, 'Dispute Resolution')
  assert.equal(logged.actionDescription, `Resolved reported issue "Late" (${IS}).`)
  const n = notifications.notify.mock.calls.at(-1).arguments
  assert.equal(n[0], A)
  assert.equal(n[1].relatedEntityType, 'Contract')
})

// ── admin ──────────────────────────────────────────────────────────────────────────────────
test('toggleStatus: flag/restore with the mock log text, conditional, no self / admin targets', async (t) => {
  await assert.rejects(() => admin.toggleStatus({ _id: AD }, AD), (e) => status(e) === 400)
  t.mock.method(User, 'findById', async () => ({ _id: B, name: 'Meera', role: 'Freelancer', status: 'Active' }))
  let cond
  t.mock.method(User, 'findOneAndUpdate', async (f, u) => { cond = { f, u }; return { _id: B, name: 'Meera', email: 'm@x.com', role: 'Freelancer', status: 'Flagged', createdAt: date } })
  const dto = await admin.toggleStatus({ _id: AD }, B)
  assert.equal(dto.status, 'Flagged')
  assert.deepEqual(cond.f, { _id: B, status: 'Active' })
  assert.equal(AdminAction.create.mock.calls.at(-1).arguments[0].actionType, 'Account Flag')
  assert.equal(AdminAction.create.mock.calls.at(-1).arguments[0].actionDescription, `Flagged account for Meera (${B}).`)
  t.mock.method(User, 'findById', async () => ({ _id: C, name: 'Root', role: 'Admin', status: 'Active' }))
  await assert.rejects(() => admin.toggleStatus({ _id: AD }, C), (e) => status(e) === 400)
})

test('moderateReview: status change, rating recomputed for a freelancer reviewee, audit row', async (t) => {
  await assert.rejects(() => admin.moderateReview({ _id: AD }, RV, 'nuke'), (e) => status(e) === 400)
  t.mock.method(Review, 'findOneAndUpdate', async (f, u) => ({ _id: RV, contractId: CT, reviewerId: A, revieweeId: B, rating: 3, comment: 'meh', status: u.$set.status, createdAt: date }))
  t.mock.method(User, 'findById', () => chain({ role: 'Freelancer' }))
  const recompute = t.mock.method(reviewService, 'recomputeFreelancerRating', async () => 4)
  const dto = await admin.moderateReview({ _id: AD }, RV, 'hide')
  assert.equal(dto.status, 'Hidden')
  assert.equal(dto.reviewId, RV)
  assert.equal(recompute.mock.callCount(), 1)
  assert.equal(AdminAction.create.mock.calls.at(-1).arguments[0].actionDescription, `Hid review ${RV} (contract ${CT}).`)
})

test('dashboard: reproduces the mock keys and defaults sums to 0', async (t) => {
  t.mock.method(User, 'countDocuments', async (f) => (f.role === 'Client' ? 2 : f.role === 'Freelancer' ? 3 : f.status === 'Flagged' ? 1 : 6))
  t.mock.method(Job, 'countDocuments', async () => 4)
  t.mock.method(Contract, 'countDocuments', async () => 2)
  t.mock.method(Issue, 'countDocuments', async () => 1)
  t.mock.method(Payment, 'aggregate', async (p) => (p[0].$match.status === 'Paid' ? [{ _id: null, total: 36000 }] : []))
  assert.deepEqual(await admin.dashboard(), { totalUsers: 6, totalClients: 2, totalFreelancers: 3, openJobs: 4, activeContracts: 2, flaggedUsers: 1, openIssues: 1, totalPlatformPayments: 36000, awaitingPayoutCount: 0, awaitingPayoutAmount: 0 })
})

test('editProfile: own profile only; duplicate email -> 409 with the register message', async (t) => {
  await assert.rejects(() => admin.editProfile(A, { _id: AD }, { name: 'x' }), (e) => status(e) === 403)
  t.mock.method(User, 'findOneAndUpdate', async () => { const e = new Error('dup'); e.code = 11000; throw e })
  await assert.rejects(() => admin.editProfile(AD, { _id: AD }, { email: 'a@b.com' }), (e) => status(e) === 409 && e.message === 'An account with this email already exists.')
  let set
  t.mock.method(User, 'findOneAndUpdate', async (f, u) => { set = u.$set; return { _id: AD, name: 'Root', email: 'a@b.com', role: 'Admin', status: 'Active', createdAt: date } })
  await admin.editProfile(AD, { _id: AD }, { name: 'Root', email: 'A@B.com' })
  assert.deepEqual(set, { name: 'Root', email: 'a@b.com' })
})

test('logPayout writes the mock wording; a failing log never throws', async (t) => {
  const Milestone = require('../src/models/Milestone')
  t.mock.method(Milestone, 'findById', () => chain({ title: 'Phase 1' }))
  t.mock.method(User, 'findById', () => chain({ name: 'Meera' }))
  await adminActions.logPayout({ _id: AD }, { paymentId: 'P1', amount: 15000, milestoneId: 'm', freelancerId: B })
  assert.equal(AdminAction.create.mock.calls.at(-1).arguments[0].actionDescription, 'Dispatched ₹15000 for milestone "Phase 1" (P1) to Meera.')
  t.mock.method(console, 'error', () => {})
  t.mock.method(AdminAction, 'create', async () => { throw new Error('db') })
  assert.equal(await adminActions.log({ _id: AD }, 't', 'd'), null)
})

// ── search ─────────────────────────────────────────────────────────────────────────────────
test('search: blank -> []; regex-escaped; result shape + role routes; capped at 8', async (t) => {
  assert.deepEqual(await search.forClient({ _id: A }, '   '), [])
  let jf
  const jobs = Array.from({ length: 6 }, (_, i) => ({ _id: String(i).repeat(24), title: `Site ${i}`, status: 'Published' }))
  t.mock.method(Job, 'find', (f) => { jf = f; return chain(jobs) })
  t.mock.method(Contract, 'find', () => chain(jobs.slice(0, 4).map((j) => ({ _id: 'c'.repeat(24), jobId: j._id, status: 'Active' }))))
  const out = await search.forClient({ _id: A }, '(evil.*')
  assert.equal(jf.title.$regex, '\\(evil\\.\\*')
  assert.equal(out.length, 8)
  assert.deepEqual(out[0], { id: `job-${jobs[0]._id}`, label: 'Site 0', sublabel: 'Job · Published', to: `/client/jobs/${jobs[0]._id}` })
  assert.equal(out[6].to, `/client/contracts/${'c'.repeat(24)}`)
})
test('search admin: users by name/email', async (t) => {
  t.mock.method(User, 'find', () => chain([{ _id: B, name: 'Meera', email: 'm@x.com', role: 'Freelancer' }]))
  assert.deepEqual(await search.forAdmin('mee'), [{ id: `user-${B}`, label: 'Meera', sublabel: 'Freelancer · m@x.com', to: `/admin/users/${B}` }])
})
test('search freelancer: open jobs + own contracts by job title', async (t) => {
  t.mock.method(Contract, 'find', () => chain([{ _id: CT, jobId: JOB, status: 'Active' }, { _id: 'f'.repeat(24), jobId: 'e'.repeat(24), status: 'Completed' }]))
  let calls = 0
  t.mock.method(Job, 'find', (f) => { calls += 1; return chain(f.status === 'Published' ? [{ _id: 'a'.repeat(24), title: 'Open API' }] : [{ _id: JOB, title: 'Mobile API' }]) })
  const out = await search.forFreelancer({ _id: B }, 'api')
  assert.deepEqual(out.map((r) => [r.label, r.sublabel, r.to]), [['Open API', 'Open job', `/freelancer/jobs/${'a'.repeat(24)}`], ['Mobile API', 'Contract · Active', `/freelancer/contracts/${CT}`]])
  assert.equal(calls, 2)
})

// ---- Phase 8: opt-in admin pagination (array body unchanged; paging info attached non-enumerably)
test('admin lists: no page/limit => legacy capped array; page/limit => skip+limit and pageInfo', async (t) => {
  const rows = [{ _id: A, name: 'A', email: 'a@x.com', role: 'Client', status: 'Active', createdAt: date }]
  let skipped, limited, counted
  t.mock.method(User, 'find', () => {
    const c = { sort: () => c, skip: (n) => { skipped = n; return c }, limit: (n) => { limited = n; return c }, then: (res, rej) => Promise.resolve(rows).then(res, rej) }
    return c
  })
  t.mock.method(User, 'countDocuments', async () => { counted = true; return 45 })

  const legacy = await admin.listUsers({})
  assert.equal(legacy.pageInfo, undefined)
  assert.equal(skipped, undefined)
  assert.equal(limited, 500)
  assert.equal(counted, undefined)

  const paged = await admin.listUsers({ page: '3', limit: '10' })
  assert.equal(skipped, 20)
  assert.equal(limited, 10)
  assert.deepEqual(paged.pageInfo, { page: 3, limit: 10, total: 45, totalPages: 5 })
  assert.equal(JSON.stringify(paged).startsWith('['), true) // still a plain array on the wire
  assert.equal('pageInfo' in JSON.parse(JSON.stringify(paged)), false)

  const capped = await admin.listUsers({ limit: '9999' })
  assert.equal(limited, 100)
  assert.equal(capped.pageInfo.page, 1)
})
