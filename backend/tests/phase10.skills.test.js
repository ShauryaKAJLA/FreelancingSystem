// Phase 10: admin skill writes are audit-logged; service rules still hold. Stubbed models, no MongoDB / Express.
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test_secret_test_secret_test_secret_123'
const test = require('node:test')
const assert = require('node:assert/strict')
const Skill = require('../src/models/Skill')
const Job = require('../src/models/Job')
const FreelancerProfile = require('../src/models/FreelancerProfile')
const adminActions = require('../src/services/adminActionService')
const ctrl = require('../src/controllers/skillController')

const S = 'a'.repeat(24), ADMIN = { _id: 'd'.repeat(24), role: 'Admin' }
const call = async (handler, req) => {
  const out = {}
  const res = { status(c) { out.status = c; return this }, json(b) { out.body = b; return this } }
  await handler(req, res, (e) => { out.error = e })
  return out
}

test('create/update/delete write one audit entry each and return the usual envelope', async (t) => {
  const logs = []
  t.mock.method(adminActions, 'log', async (admin, type, desc) => { logs.push({ admin, type, desc }) })
  t.mock.method(Skill, 'exists', async () => null)
  t.mock.method(Skill, 'create', async ({ name }) => ({ _id: S, name }))
  t.mock.method(Skill, 'findByIdAndUpdate', async (_id, u) => ({ _id: S, name: u.$set.name }))
  t.mock.method(FreelancerProfile, 'exists', async () => null)
  t.mock.method(Job, 'exists', async () => null)
  t.mock.method(Skill, 'findByIdAndDelete', async () => ({ _id: S }))

  const c = await call(ctrl.create, { user: ADMIN, body: { name: 'Rust' } })
  assert.equal(c.body.data.skillName, 'Rust')
  const u = await call(ctrl.update, { user: ADMIN, params: { skillId: S }, body: { name: 'Rust 2' } })
  assert.equal(u.body.data.skillName, 'Rust 2')
  const d = await call(ctrl.remove, { user: ADMIN, params: { skillId: S } })
  assert.equal(d.body.data.skillId, S)
  assert.deepEqual(logs.map((l) => l.type), ['Skill Added', 'Skill Renamed', 'Skill Deleted'])
  assert.ok(logs.every((l) => l.admin === ADMIN))
})

test('a failed write (duplicate / in use) is NOT logged and surfaces the 409', async (t) => {
  const logs = []
  t.mock.method(adminActions, 'log', async (...a) => { logs.push(a) })
  t.mock.method(Skill, 'exists', async () => ({ _id: 'x' }))
  const dup = await call(ctrl.create, { user: ADMIN, body: { name: 'React' } })
  assert.equal(dup.error.statusCode ?? dup.error.status, 409)
  t.mock.method(FreelancerProfile, 'exists', async () => ({ _id: 'p' }))
  t.mock.method(Job, 'exists', async () => null)
  const used = await call(ctrl.remove, { user: ADMIN, params: { skillId: S } })
  assert.equal(used.error.statusCode ?? used.error.status, 409)
  assert.equal(logs.length, 0)
})
