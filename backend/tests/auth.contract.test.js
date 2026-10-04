// Phase 1 integration: verifies the auth API speaks the FRONTEND's shapes. No database needed -
// Mongoose model methods are stubbed with node:test mocks.
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test_secret_test_secret_test_secret_123'

const test = require('node:test')
const assert = require('node:assert/strict')
const bcrypt = require('bcryptjs')
const User = require('../src/models/User')
const ClientProfile = require('../src/models/ClientProfile')
const FreelancerProfile = require('../src/models/FreelancerProfile')
const authService = require('../src/services/authService')
const { verifyToken } = require('../src/utils/jwt')
const { toUserDTO, toSessionUser } = require('../src/utils/dto')
const { validateLogin, validateRegister } = require('../src/validators/authValidators')

const OID = 'a'.repeat(24)
const makeUser = (over = {}) => ({
  _id: OID, name: 'Meera Iyer', email: 'meera.iyer@dev.com', role: 'Freelancer', status: 'Active',
  createdAt: new Date('2025-01-20T10:00:00Z'), passwordHash: bcrypt.hashSync('Password@123', 4), ...over,
})
const stubFind = (t, user) => t.mock.method(User, 'findOne', () => ({ select: async () => user }))
// Validators throw ApiError on bad input and call next() when the body is fine.
const run = (validator, body) => { try { validator({ body }, {}, () => {}) } catch (e) { return e } }

test('toSessionUser exposes exactly the frontend currentUser shape', () => {
  assert.deepEqual(toSessionUser(makeUser()), { userId: OID, name: 'Meera Iyer', email: 'meera.iyer@dev.com', role: 'Freelancer' })
})

test('toUserDTO uses userId (never _id / passwordHash) and ISO dates', () => {
  const dto = toUserDTO(makeUser())
  assert.equal(dto.userId, OID)
  assert.equal(dto.createdAt, '2025-01-20T10:00:00.000Z')
  assert.ok(!('_id' in dto) && !('passwordHash' in dto))
})

test('login returns { token, user:{userId,name,email,role} } and a verifiable JWT', async (t) => {
  stubFind(t, makeUser())
  const out = await authService.login({ email: 'Meera.Iyer@dev.com', password: 'Password@123', role: 'Freelancer' })
  assert.deepEqual(Object.keys(out.user).sort(), ['email', 'name', 'role', 'userId'])
  assert.equal(verifyToken(out.token).sub, OID)
})

test('login works without a role (optional field)', async (t) => {
  stubFind(t, makeUser())
  assert.ok((await authService.login({ email: 'meera.iyer@dev.com', password: 'Password@123' })).token)
})

test('login rejects a wrong password with a generic 401', async (t) => {
  stubFind(t, makeUser())
  await assert.rejects(authService.login({ email: 'meera.iyer@dev.com', password: 'nope', role: 'Freelancer' }), { statusCode: 401, message: 'Invalid email or password' })
})

test('login rejects an unknown email with the SAME generic 401', async (t) => {
  stubFind(t, null)
  await assert.rejects(authService.login({ email: 'ghost@x.com', password: 'Password@123' }), { statusCode: 401, message: 'Invalid email or password' })
})

test('login rejects a role mismatch (after the password is proven)', async (t) => {
  stubFind(t, makeUser())
  await assert.rejects(authService.login({ email: 'meera.iyer@dev.com', password: 'Password@123', role: 'Client' }), { statusCode: 401, message: /selected role/ })
})

test('a wrong password with the wrong role does NOT reveal the role (no enumeration)', async (t) => {
  stubFind(t, makeUser())
  await assert.rejects(authService.login({ email: 'meera.iyer@dev.com', password: 'bad', role: 'Client' }), { message: 'Invalid email or password' })
})

test('login blocks flagged accounts with 403', async (t) => {
  stubFind(t, makeUser({ status: 'Flagged' }))
  await assert.rejects(authService.login({ email: 'meera.iyer@dev.com', password: 'Password@123' }), { statusCode: 403 })
})

test('register returns the session shape and creates the role profile', async (t) => {
  t.mock.method(User, 'exists', async () => null)
  t.mock.method(User, 'create', async (doc) => makeUser({ ...doc, _id: OID }))
  const cp = t.mock.method(ClientProfile, 'create', async () => ({}))
  t.mock.method(FreelancerProfile, 'create', async () => ({}))
  const out = await authService.register({ name: 'New Client', email: 'NEW@x.com', password: 'Password@123', role: 'Client' })
  assert.equal(out.user.userId, OID)
  assert.equal(out.user.role, 'Client')
  assert.equal(cp.mock.callCount(), 1)
})

test('register rejects duplicate emails with 409', async (t) => {
  t.mock.method(User, 'exists', async () => ({ _id: OID }))
  await assert.rejects(authService.register({ name: 'X Y', email: 'a@b.co', password: 'Password@123', role: 'Client' }), { statusCode: 409 })
})

test('validators: login accepts the frontend payload {email,password,role}', () => {
  assert.equal(run(validateLogin, { email: 'a@b.co', password: 'x', role: 'Client' }), undefined)
  assert.equal(run(validateLogin, { email: 'a@b.co', password: 'x' }), undefined)
  assert.ok(run(validateLogin, { email: 'a@b.co', password: 'x', role: 'Superuser' }))
  assert.ok(run(validateLogin, { email: 'a@b.co', password: { $gt: '' } })) // NoSQL-operator injection
})

test('validators: register still blocks Admin self-signup', () => {
  assert.ok(run(validateRegister, { name: 'Eve', email: 'e@x.co', password: 'Password1', role: 'Admin' }))
})
