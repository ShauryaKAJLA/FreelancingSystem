// Phase 8 HTTP-level gates for messages / notifications / admin / issues / search, on the REAL Express app with only
// User.findById stubbed. Written in the phase4.routes.test.js style. NOT RUN in the authoring sandbox (no express) --
// run `npm test` and report failures.
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test_secret_test_secret_test_secret_123'

const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')
const app = require('../src/app')
const User = require('../src/models/User')
const notificationService = require('../src/services/notificationService')
const { signToken } = require('../src/utils/jwt')

const ids = { client: 'a'.repeat(24), free: 'b'.repeat(24), admin: '9'.repeat(24), other: 'c'.repeat(24) }
const users = {
  [ids.client]: { _id: ids.client, role: 'Client', name: 'Aisha', status: 'Active' },
  [ids.free]: { _id: ids.free, role: 'Freelancer', name: 'Meera', status: 'Active' },
  [ids.admin]: { _id: ids.admin, role: 'Admin', name: 'Admin', status: 'Active' },
}
const tok = (id) => signToken(users[id])

let server, base
test.before(async () => {
  server = http.createServer(app)
  await new Promise((r) => server.listen(0, r))
  base = `http://127.0.0.1:${server.address().port}/api`
})
test.after(() => new Promise((r) => server.close(r)))
test.beforeEach((t) => { t.mock.method(User, 'findById', async (id) => users[String(id)] ?? null) })

const call = async (method, path, { token, body } = {}) => {
  const res = await fetch(base + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, json: await res.json().catch(() => null) }
}

const X = 'd'.repeat(24)
const adminRoutes = [
  ['GET', '/admin/dashboard'], ['GET', '/admin/users'], ['GET', `/admin/users/${X}`], ['PATCH', `/admin/users/${X}/status`],
  ['GET', '/admin/transactions'], ['GET', `/admin/payments/${X}`], ['GET', '/admin/contracts'], ['GET', `/admin/contracts/${X}`],
  ['GET', '/admin/reviews'], ['PATCH', `/admin/reviews/${X}`], ['GET', '/admin/issues'], ['PATCH', `/admin/issues/${X}/resolve`],
  ['GET', '/admin/actions'], ['GET', '/admin/jobs/open'], ['GET', `/admin/profile/${ids.admin}`], ['PUT', `/admin/profile/${ids.admin}`],
]

test('every /admin route: 401 anonymous, 403 for Client and Freelancer', async () => {
  for (const [method, path] of adminRoutes) {
    assert.equal((await call(method, path, { body: method === 'GET' ? undefined : {} })).status, 401, `${method} ${path} anon`)
    assert.equal((await call(method, path, { token: tok(ids.client), body: method === 'GET' ? undefined : {} })).status, 403, `${method} ${path} client`)
    assert.equal((await call(method, path, { token: tok(ids.free), body: method === 'GET' ? undefined : {} })).status, 403, `${method} ${path} freelancer`)
  }
})

test('search: each workspace endpoint accepts only its own role', async () => {
  assert.equal((await call('GET', '/search/client?query=x')).status, 401)
  assert.equal((await call('GET', '/search/client?query=x', { token: tok(ids.free) })).status, 403)
  assert.equal((await call('GET', '/search/freelancer?query=x', { token: tok(ids.client) })).status, 403)
  assert.equal((await call('GET', '/search/admin?query=x', { token: tok(ids.client) })).status, 403)
})

test('issues: raise is Client/Freelancer only; resolve is Admin only; validator runs after the role gate', async () => {
  assert.equal((await call('POST', '/issues', { body: {} })).status, 401)
  assert.equal((await call('POST', '/issues', { token: tok(ids.admin), body: {} })).status, 403)
  assert.equal((await call('POST', '/issues', { token: tok(ids.client), body: {} })).status, 400)
  assert.equal((await call('PATCH', `/issues/${X}/resolve`, { token: tok(ids.client), body: {} })).status, 403)
})

test('notifications: read-all is matched before /:notificationId/read; listing is own-only', async (t) => {
  let called = false
  t.mock.method(notificationService, 'markAllRead', async () => { called = true; return { updated: 0 } })
  const r = await call('PATCH', '/notifications/read-all', { token: tok(ids.client) })
  assert.equal(r.status, 200)
  assert.equal(called, true)
  assert.equal((await call('GET', `/notifications/${ids.free}`, { token: tok(ids.client) })).status, 403)
  assert.equal((await call('GET', `/notifications/${ids.free}`, { token: tok(ids.admin) })).status, 403) // even admins: own only
  assert.equal((await call('GET', `/notifications/${ids.client}`)).status, 401)
})

test('messages: auth required on every route; conversation route is not swallowed by /:userId', async () => {
  assert.equal((await call('POST', '/messages', { body: {} })).status, 401)
  assert.equal((await call('GET', `/messages/${ids.client}`)).status, 401)
  assert.equal((await call('GET', `/messages/conversation/${ids.free}`)).status, 401)
  // Authenticated but invalid body -> validator (400), proving the route exists and is wired.
  assert.equal((await call('POST', '/messages', { token: tok(ids.client), body: {} })).status, 400)
})
