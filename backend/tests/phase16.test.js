// Phase 16: per-user rate limiting (real Express + real express-rate-limit) and admin skill usage counts (stubbed models).
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test_secret_test_secret_test_secret_123'
const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')
const express = require('express')
const { signToken } = require('../src/utils/jwt')
const { buildApiLimiter } = require('../src/middleware/rateLimit')
const Skill = require('../src/models/Skill')
const Job = require('../src/models/Job')
const FreelancerProfile = require('../src/models/FreelancerProfile')
const ctrl = require('../src/controllers/skillController')

async function withServer(limiter, fn) {
  const app = express()
  app.set('trust proxy', true)
  app.use('/api', limiter)
  app.get('/api/ping', (_req, res) => res.json({ ok: true }))
  const server = http.createServer(app)
  await new Promise((r) => server.listen(0, r))
  const base = `http://127.0.0.1:${server.address().port}`
  try { await fn((headers = {}) => fetch(`${base}/api/ping`, { headers }).then((r) => r.status)) } finally { server.close() }
}
const bearer = (id) => ({ authorization: `Bearer ${signToken({ _id: id, role: 'Client' })}` })

test('rate limit: each signed-in user has their own budget, even from the same IP', async () => {
  await withServer(buildApiLimiter({ userMax: 3, ipMax: 1 }), async (get) => {
    const a = bearer('a'.repeat(24)), b = bearer('b'.repeat(24))
    assert.deepEqual([await get(a), await get(a), await get(a), await get(a)], [200, 200, 200, 429])
    assert.equal(await get(b), 200, 'user B is not affected by user A exhausting their budget')
  })
})

test('rate limit: anonymous / invalid-token callers share the stricter per-IP budget; a forged token buys nothing', async () => {
  await withServer(buildApiLimiter({ userMax: 50, ipMax: 2 }), async (get) => {
    assert.equal(await get(), 200)
    assert.equal(await get({ authorization: 'Bearer not.a.jwt' }), 200)
    assert.equal(await get({ authorization: 'Bearer forged.token.value' }), 429, 'garbage tokens count as the same IP bucket')
    assert.equal(await get(), 429)
  })
})

test('rate limit: the 429 body keeps the { success:false, message } envelope the frontend shows', async () => {
  const app = express()
  app.use('/api', buildApiLimiter({ userMax: 1, ipMax: 1 }))
  app.get('/api/ping', (_q, r) => r.json({ ok: 1 }))
  const server = http.createServer(app); await new Promise((r) => server.listen(0, r))
  const url = `http://127.0.0.1:${server.address().port}/api/ping`
  await fetch(url); const res = await fetch(url)
  server.close()
  assert.equal(res.status, 429)
  assert.deepEqual(await res.json(), { success: false, message: 'Too many requests. Please slow down.' })
})

const call = async (handler, req) => {
  const out = {}
  const res = { status(c) { out.status = c; return this }, json(b) { out.body = b; return this } }
  await handler(req, res, (e) => { out.error = e })
  return out
}
const id = (c) => c.repeat(24)
function stubSkills(t) {
  t.mock.method(Skill, 'find', () => ({ sort: async () => [{ _id: id('1'), name: 'React' }, { _id: id('2'), name: 'Node.js' }, { _id: id('3'), name: 'Go' }] }))
  t.mock.method(FreelancerProfile, 'aggregate', async () => [{ _id: id('1'), n: 4 }, { _id: id('2'), n: 1 }])
  t.mock.method(Job, 'aggregate', async () => [{ _id: id('1'), n: 2 }])
}

test('skills list: ?usage=true as Admin adds freelancerCount / jobCount / usageCount (zeros for unused)', async (t) => {
  stubSkills(t)
  const r = await call(ctrl.list, { user: { role: 'Admin' }, query: { usage: 'true' } })
  assert.deepEqual(r.body.data, [
    { skillId: id('1'), skillName: 'React', freelancerCount: 4, jobCount: 2, usageCount: 6 },
    { skillId: id('2'), skillName: 'Node.js', freelancerCount: 1, jobCount: 0, usageCount: 1 },
    { skillId: id('3'), skillName: 'Go', freelancerCount: 0, jobCount: 0, usageCount: 0 },
  ])
})

test('skills list: non-admins and requests without the flag get the plain contract shape and no aggregation runs', async (t) => {
  stubSkills(t)
  const plain = await call(ctrl.list, { user: { role: 'Admin' }, query: {} })
  const client = await call(ctrl.list, { user: { role: 'Client' }, query: { usage: 'true' } })
  for (const r of [plain, client]) assert.deepEqual(r.body.data[0], { skillId: id('1'), skillName: 'React' })
  assert.equal(FreelancerProfile.aggregate.mock.callCount(), 0)
  assert.equal(Job.aggregate.mock.callCount(), 0)
})
