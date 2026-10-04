// Phase 2 (pure logic): validators, query builders, lifecycle rules and DTO mappers. No database needed.
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test_secret_test_secret_test_secret_123'

const test = require('node:test')
const assert = require('node:assert/strict')
const v = require('../src/validators/jobValidators')
const pv = require('../src/validators/profileValidators')
const { validateSkill } = require('../src/validators/skillValidators')
const { rules, buildOpenJobsQuery } = require('../src/services/jobService')
const { buildDiscoveryQuery } = require('../src/services/freelancerService')
const dto = require('../src/utils/dto')
const { escapeRegex } = require('../src/utils/text')

const S1 = 'a'.repeat(24)
const S2 = 'b'.repeat(24)
// Validators either call next() (returns the mutated req) or throw an ApiError.
const run = (validator, req) => {
  try { validator(req, {}, () => {}); return { req } } catch (error) { return { error } }
}
const body = (b) => ({ body: b })
const query = (q) => ({ query: q })

// ── create job ──────────────────────────────────────────────────────────────────────────────
test('create: requires title, description and a positive budget (mock error strings)', () => {
  const { error } = run(v.validateCreateJob, body({}))
  assert.equal(error.statusCode, 400)
  assert.deepEqual(error.details, ['Job title is required.', 'Description is required.', 'Enter a valid budget amount.'])
})

test('create: whitelists fields - clientId/status/cancellationReason cannot be mass-assigned', () => {
  const { req } = run(v.validateCreateJob, body({
    title: ' Site ', description: 'Do it', budget: '4500', clientId: S1, cancellationReason: 'x', _id: S2, status: 'Completed',
    requiredSkillIds: [S1, S1, S2], category: 'Design', experienceLevel: 'Expert', milestoneTasks: ['a', 'b'],
  }))
  assert.deepEqual(req.body, {
    title: 'Site', description: 'Do it', budget: 4500, category: 'Design', experienceLevel: 'Expert',
    requiredSkillIds: [S1, S2], milestoneTasks: ['a', 'b'], numberOfMilestones: 2, status: 'Draft',
  })
})

test('create: only an explicit "Published" publishes immediately', () => {
  assert.equal(run(v.validateCreateJob, body({ title: 't', description: 'd', budget: 1, status: 'Published' })).req.body.status, 'Published')
  assert.equal(run(v.validateCreateJob, body({ title: 't', description: 'd', budget: 1, status: 'anything' })).req.body.status, 'Draft')
})

test('create: rejects bad budget, category, level, skill ids, blank milestone tasks and HTML in text', () => {
  for (const budget of [0, -5, 'abc', true, '', null]) {
    assert.ok(run(v.validateCreateJob, body({ title: 't', description: 'd', budget })).error, `budget ${String(budget)}`)
  }
  const base = { title: 't', description: 'd', budget: 5 }
  assert.ok(run(v.validateCreateJob, body({ ...base, category: 'Astrology' })).error)
  assert.ok(run(v.validateCreateJob, body({ ...base, experienceLevel: 'God' })).error)
  assert.ok(run(v.validateCreateJob, body({ ...base, requiredSkillIds: ['nope'] })).error)
  assert.equal(run(v.validateCreateJob, body({ ...base, milestoneTasks: ['ok', '  '] })).error.details[0], 'Enter a task specification for every milestone.')
  assert.equal(run(v.validateCreateJob, body({ title: '<script>x</script>Site', description: 'd', budget: 1 })).req.body.title, 'xSite')
})

// ── edit / cancel ───────────────────────────────────────────────────────────────────────────
test('edit: partial updates allowed, but not empty and not blank strings', () => {
  assert.deepEqual(run(v.validateEditJob, body({ budget: 10 })).req.body, { budget: 10 })
  assert.ok(run(v.validateEditJob, body({})).error)
  assert.equal(run(v.validateEditJob, body({ title: '  ' })).error.details[0], 'Job title is required.')
  assert.equal(run(v.validateEditJob, body({ status: 'Completed', clientId: S1 })).error.details[0], 'Provide at least one field to update.')
})

test('cancel: reason is optional, trimmed, capped', () => {
  assert.deepEqual(run(v.validateCancelJob, body({})).req.body, { reason: null })
  assert.deepEqual(run(v.validateCancelJob, body({ reason: ' scope changed ' })).req.body, { reason: 'scope changed' })
  assert.ok(run(v.validateCancelJob, body({ reason: 'x'.repeat(501) })).error)
})

// ── query strings ───────────────────────────────────────────────────────────────────────────
test('open-jobs query: coerces numbers, drops empties, defaults sort, rejects bad skillId', () => {
  const { req } = run(v.validateOpenJobsQuery, query({ search: ' react ', budgetMin: '1000', budgetMax: '', skillId: S1, sortBy: 'hack' }))
  assert.deepEqual(req.filters, { search: 'react', skillId: S1, category: undefined, experienceLevel: undefined, budgetMin: 1000, budgetMax: undefined, sortBy: 'newest' })
  assert.ok(run(v.validateOpenJobsQuery, query({ skillId: 'zzz' })).error)
  assert.ok(run(v.validateOpenJobsQuery, query({ budgetMin: 'abc' })).error)
})

test('freelancer query: minRating 0 is a real filter value (not dropped)', () => {
  const { req } = run(v.validateFreelancerQuery, query({ minRating: '0', minRate: '1500', sortBy: 'rateLow' }))
  assert.equal(req.filters.minRating, 0)
  assert.equal(req.filters.minRate, 1500)
  assert.equal(req.filters.sortBy, 'rateLow')
  assert.equal(run(v.validateFreelancerQuery, query({})).req.filters.sortBy, 'ratingHigh')
})

// ── lifecycle rules (exact mock strings) ────────────────────────────────────────────────────
test('lifecycle rules match the mock behaviour', () => {
  assert.equal(rules.edit('Draft'), null)
  assert.equal(rules.edit('Published'), null)
  assert.equal(rules.edit('In Progress'), 'A job that is in progress can no longer be edited.')
  assert.equal(rules.edit('Cancelled'), 'A job that is cancelled can no longer be edited.')
  assert.equal(rules.publish('Draft'), null)
  assert.equal(rules.publish('Published'), 'Only a draft job can be published.')
  assert.equal(rules.remove('Draft'), null)
  assert.match(rules.remove('Published'), /Only a draft job with no bids can be deleted/)
  assert.equal(rules.cancel('Published'), null)
  for (const s of ['Draft', 'In Progress', 'Completed', 'Closed', 'Cancelled']) assert.match(rules.cancel(s), /Only a published job/)
})

// ── Mongo filter builders ───────────────────────────────────────────────────────────────────
test('open jobs query only ever matches Published and escapes the search text', () => {
  const { filter, sort } = buildOpenJobsQuery({ search: 'a.b(c', budgetMin: 100, budgetMax: 500, category: 'Design', experienceLevel: 'Entry', sortBy: 'budgetLow' })
  assert.equal(filter.status, 'Published')
  assert.equal(filter.title.$regex, 'a\\.b\\(c')
  assert.deepEqual(filter.budget, { $gte: 100, $lte: 500 })
  assert.equal(filter.category, 'Design')
  assert.deepEqual(sort, { budget: 1, _id: 1 })
  assert.deepEqual(buildOpenJobsQuery({}).filter, { status: 'Published' })
})

test('open jobs: budgetMin of 0 still applies (0 is not "no filter")', () => {
  assert.deepEqual(buildOpenJobsQuery({ budgetMin: 0 }).filter.budget, { $gte: 0 })
})

test('discovery query excludes flagged users, escapes search, and builds range filters', () => {
  const q = buildDiscoveryQuery({ search: '.*', minRating: 4, minRate: 1000, maxRate: 2000, skillId: S1, sortBy: 'rateHigh' })
  assert.equal(q.userMatch['user.status'], 'Active')
  assert.equal(q.userMatch['user.role'], 'Freelancer')
  assert.equal(q.userMatch.$or[0]['user.name'].$regex, '\\.\\*')
  assert.deepEqual(q.profileMatch.rating, { $gte: 4 })
  assert.deepEqual(q.profileMatch.hourlyRate, { $gte: 1000, $lte: 2000 })
  assert.equal(String(q.profileMatch.skillIds), S1)
  assert.deepEqual(q.sort, { hourlyRate: -1, 'user.name': 1 })
})

test('escapeRegex neutralises every metacharacter', () => {
  const nasty = '.*+?^${}()|[]\\'
  assert.ok(new RegExp(escapeRegex(nasty)).test(nasty))
})

// ── profile validators ──────────────────────────────────────────────────────────────────────
test('freelancer profile: hourlyRate must be > 0 (mock message); rating can never be written', () => {
  assert.equal(run(pv.validateFreelancerProfile, body({ hourlyRate: 0 })).error.details[0], 'Enter a valid hourly rate.')
  const { req } = run(pv.validateFreelancerProfile, body({ bio: ' hi ', hourlyRate: '1800', rating: 5, userId: S1, skillIds: [S1] }))
  assert.deepEqual(req.body, { bio: 'hi', hourlyRate: 1800, skillIds: [S1] })
})

test('client profile: name is accepted, must not be blank; javascript: websites rejected', () => {
  assert.deepEqual(run(pv.validateClientProfile, body({ name: ' Aisha ', companyName: 'X', totalSpend: 9 })).req.body, { name: 'Aisha', companyName: 'X' })
  assert.equal(run(pv.validateClientProfile, body({ name: '  ' })).error.details[0], 'Name is required.')
  assert.ok(run(pv.validateClientProfile, body({ website: 'javascript:alert(1)' })).error)
})

test('extras: payout account needs bank triple or UPI; IFSC/UPI/account formats checked; normalised', () => {
  const msg = 'Enter bank details (holder, account number, IFSC) or a UPI ID.'
  assert.equal(run(pv.validateFreelancerExtras, body({ paymentAccount: { holderName: 'A' } })).error.details[0], msg)
  const ok = run(pv.validateFreelancerExtras, body({ paymentAccount: { holderName: ' Meera ', bankName: 'HDFC', accountNumber: '123456789012', ifsc: 'hdfc0001234', upiId: '' } }))
  assert.equal(ok.req.body.paymentAccount.ifsc, 'HDFC0001234')
  assert.equal(ok.req.body.paymentAccount.holderName, 'Meera')
  assert.ok(run(pv.validateFreelancerExtras, body({ paymentAccount: { holderName: 'A', accountNumber: '12ab', ifsc: 'HDFC0001234' } })).error)
  assert.ok(run(pv.validateFreelancerExtras, body({ paymentAccount: { holderName: 'A', accountNumber: '123456789', ifsc: 'BAD' } })).error)
  assert.ok(run(pv.validateFreelancerExtras, body({ paymentAccount: { upiId: 'nope' } })).error)
  assert.ok(run(pv.validateFreelancerExtras, body({ paymentAccount: { upiId: 'meera@okhdfc' } })).req)
})

test('extras: past projects need a title, cap at 20, reject script links, keep only known keys', () => {
  assert.equal(run(pv.validateFreelancerExtras, body({ pastProjects: [{ title: ' ' }] })).error.details[0], 'Enter a project title.')
  assert.ok(run(pv.validateFreelancerExtras, body({ pastProjects: [{ title: 'x', link: 'javascript:1' }] })).error)
  assert.ok(run(pv.validateFreelancerExtras, body({ pastProjects: Array.from({ length: 21 }, () => ({ title: 'x' })) })).error)
  const { req } = run(pv.validateFreelancerExtras, body({ pastProjects: [{ title: 'A', description: 'd', year: '2024', link: '', index: 3, evil: 1 }] }))
  assert.deepEqual(req.body.pastProjects, [{ title: 'A', description: 'd', year: '2024', link: '' }])
  assert.deepEqual(run(pv.validateFreelancerExtras, body({ pastProjects: [] })).req.body, { pastProjects: [] })
  assert.ok(run(pv.validateFreelancerExtras, body({})).error)
})

test('skill: name required, trimmed, capped', () => {
  assert.deepEqual(run(validateSkill, body({ skillName: ' Go ' })).req.body, { name: 'Go' })
  assert.ok(run(validateSkill, body({})).error)
  assert.ok(run(validateSkill, body({ skillName: 'x'.repeat(61) })).error)
})

// ── DTO mappers ─────────────────────────────────────────────────────────────────────────────
test('toJobDTO produces exactly the frontend job shape', () => {
  const j = dto.toJobDTO({
    _id: S1, clientId: S2, title: 'T', description: 'D', budget: 5, status: 'Published', createdAt: new Date('2025-09-01T09:00:00Z'),
    requiredSkillIds: [S1, { _id: S2 }], category: 'Design', experienceLevel: 'Entry', milestoneTasks: ['a'], numberOfMilestones: 1,
  })
  assert.deepEqual(j, {
    jobId: S1, clientId: S2, title: 'T', description: 'D', budget: 5, status: 'Published', createdAt: '2025-09-01T09:00:00.000Z',
    requiredSkillIds: [S1, S2], category: 'Design', experienceLevel: 'Entry', numberOfMilestones: 1, milestoneTasks: ['a'],
  })
  assert.ok(!('cancellationReason' in j))
  assert.equal(dto.toJobDTO({ _id: S1, clientId: S2, cancellationReason: 'why' }).cancellationReason, 'why')
})

test('toSkillDTO / freelancer + client profile DTOs', () => {
  assert.deepEqual(dto.toSkillDTO({ _id: S1, name: 'React' }), { skillId: S1, skillName: 'React' })
  const user = { _id: S1, name: 'Meera', email: 'm@x.com', role: 'Freelancer', status: 'Active', createdAt: new Date('2025-01-20T10:00:00Z') }
  const profile = { hourlyRate: 1800, bio: 'b', rating: 4.8, paymentAccount: { holderName: 'M', bankName: 'B', accountNumber: '123456789', ifsc: 'HDFC0001234', upiId: '' }, pastProjects: [{ title: 'P', description: '', year: '', link: '' }] }
  const own = dto.toFreelancerProfileDTO(user, profile, { isOwnerOrAdmin: true })
  assert.equal(own.email, 'm@x.com')
  assert.equal(own.fullName, 'Meera')
  assert.equal(own.paymentAccount.accountNumber, '123456789')
  const other = dto.toFreelancerProfileDTO(user, profile, { isOwnerOrAdmin: false })
  assert.equal(other.paymentAccount, null)
  assert.ok(!('email' in other))
  const c = dto.toClientProfileDTO({ ...user, role: 'Client' }, { companyName: 'Co', website: 'co.com' }, { totalSpend: 10 })
  assert.deepEqual(Object.keys(c).sort(), ['clientId', 'companyName', 'createdAt', 'email', 'name', 'role', 'status', 'totalSpend', 'userId', 'website'])
  assert.ok(!('email' in dto.toClientProfileDTO(user, {}, { includeEmail: false })))
})

test('maskAccount keeps only the last 4 digits', () => {
  assert.equal(dto.maskAccount({ accountNumber: '123456789012' }).accountNumber, '********9012')
  assert.equal(dto.maskAccount(null), null)
})
