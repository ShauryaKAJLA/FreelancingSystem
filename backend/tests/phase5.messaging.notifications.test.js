// Phase 5 (slice 2): messaging + notifications. Service-level tests with stubbed models (no MongoDB).
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test_secret_test_secret_test_secret_123'

const test = require('node:test')
const assert = require('node:assert/strict')
const Message = require('../src/models/Message')
const Notification = require('../src/models/Notification')
const Milestone = require('../src/models/Milestone')
const Payment = require('../src/models/Payment')
const User = require('../src/models/User')
const Contract = require('../src/models/Contract')
const notifications = require('../src/services/notificationService')
const messages = require('../src/services/messageService')

const A = 'a'.repeat(24), B = 'b'.repeat(24), C = 'c'.repeat(24), CT = '1'.repeat(24), MS = '2'.repeat(24), PAY = '3'.repeat(24), JOB = '4'.repeat(24), N1 = '5'.repeat(24), M1 = '6'.repeat(24)
const date = new Date('2025-10-01T10:00:00Z')

// ── linkFor (pure) ─────────────────────────────────────────────────────────────────────────
test('linkFor: role-specific routes that exist in the frontend router', () => {
  const l = notifications.linkFor
  assert.equal(l('Client', { relatedEntityType: 'Job', relatedEntityId: JOB }), `/client/jobs/${JOB}`)
  assert.equal(l('Freelancer', { relatedEntityType: 'Job', relatedEntityId: JOB }), `/freelancer/jobs/${JOB}`)
  assert.equal(l('Admin', { relatedEntityType: 'Job', relatedEntityId: JOB }), '/admin/jobs')
  assert.equal(l('Freelancer', { relatedEntityType: 'Contract', relatedEntityId: CT }), `/freelancer/contracts/${CT}`)
  assert.equal(l('Admin', { relatedEntityType: 'Contract', relatedEntityId: CT }), `/admin/contracts/${CT}`)
  assert.equal(l('Client', { relatedEntityType: 'Payment', relatedEntityId: PAY }), `/client/payments/${PAY}`)
  assert.equal(l('Admin', { relatedEntityType: 'Payment', relatedEntityId: PAY }), `/admin/payments/${PAY}`)
  assert.equal(l('Client', { type: 'message', relatedEntityType: 'User', relatedEntityId: A }), '/messages')
  assert.equal(l('Freelancer', { type: 'message', relatedEntityType: 'User', relatedEntityId: A }), '/freelancer/messages')
  assert.equal(l('Admin', { type: 'account', relatedEntityType: 'User', relatedEntityId: A }), `/admin/users/${A}`)
  assert.equal(l('Client', { type: 'account', relatedEntityType: 'User', relatedEntityId: A }), null)
  assert.equal(l('Admin', { relatedEntityType: 'Issue', relatedEntityId: A }), '/admin/reports')
  assert.equal(l('Client', {}), null)
  assert.equal(l('Nobody', { relatedEntityType: 'Job', relatedEntityId: JOB }), null)
})

test('linkFor: Milestone resolves to the owning contract, falls back to the list when unknown', () => {
  const lookup = (type, id) => (type === 'Milestone' && id === MS ? CT : null)
  assert.equal(notifications.linkFor('Client', { relatedEntityType: 'Milestone', relatedEntityId: MS }, lookup), `/client/contracts/${CT}`)
  assert.equal(notifications.linkFor('Freelancer', { relatedEntityType: 'Milestone', relatedEntityId: MS }, lookup), `/freelancer/contracts/${CT}`)
  assert.equal(notifications.linkFor('Client', { relatedEntityType: 'Milestone', relatedEntityId: C }, lookup), '/client/contracts')
})

// ── notificationService ────────────────────────────────────────────────────────────────────
const chain = (rows) => { const p = Promise.resolve(rows); const c = { sort: () => c, skip: () => c, limit: () => c, select: () => c, then: p.then.bind(p), catch: p.catch.bind(p) }; return c }

test('list: returns the frontend DTO (read, link, createdAt), unreadCount, resolves milestone/payment contract ids in batch', async (t) => {
  const rows = [
    { _id: N1, userId: A, type: 'milestone', title: 'Milestone submitted', message: 'm', relatedEntityId: MS, relatedEntityType: 'Milestone', isRead: false, createdAt: date },
    { _id: M1, userId: A, type: 'payment', title: 'Paid', message: 'p', relatedEntityId: PAY, relatedEntityType: 'Payment', isRead: true, createdAt: date },
  ]
  t.mock.method(Notification, 'find', () => chain(rows))
  t.mock.method(Notification, 'countDocuments', async (f) => (f.isRead === false && Object.keys(f).length === 2 ? 1 : 2))
  const msFind = t.mock.method(Milestone, 'find', () => chain([{ _id: MS, contractId: CT }]))
  const payFind = t.mock.method(Payment, 'find', () => chain([{ _id: PAY, contractId: CT }]))
  const out = await notifications.list(A, {}, { _id: A, role: 'Client' })
  assert.equal(msFind.mock.callCount(), 1)
  assert.equal(payFind.mock.callCount(), 1)
  assert.equal(out.unreadCount, 1)
  assert.deepEqual(out.items[0], { notificationId: N1, userId: A, type: 'milestone', title: 'Milestone submitted', message: 'm', link: `/client/contracts/${CT}`, read: false, createdAt: '2025-10-01T10:00:00.000Z' })
  assert.equal(out.items[1].link, `/client/payments/${PAY}`)
  assert.equal(out.items[1].read, true)
})

test('list: a failing link lookup degrades to list-page links instead of failing the request', async (t) => {
  t.mock.method(console, 'error', () => {})
  t.mock.method(Notification, 'find', () => chain([{ _id: N1, userId: A, type: 'milestone', title: 't', message: 'm', relatedEntityId: MS, relatedEntityType: 'Milestone', isRead: false, createdAt: date }]))
  t.mock.method(Notification, 'countDocuments', async () => 1)
  t.mock.method(Milestone, 'find', () => { throw new Error('db down') })
  const out = await notifications.list(A, {}, { _id: A, role: 'Freelancer' })
  assert.equal(out.items[0].link, '/freelancer/contracts')
})

test('markRead: owner-scoped filter (another user\'s notification is a 404) and returns the DTO', async (t) => {
  let filter
  t.mock.method(Notification, 'findOneAndUpdate', async (f) => { filter = f; return null })
  await assert.rejects(() => notifications.markRead(N1, { _id: B, role: 'Client' }), (e) => e.statusCode === 404 || e.status === 404)
  assert.equal(String(filter.userId), B)
  t.mock.method(Notification, 'findOneAndUpdate', async () => ({ _id: N1, userId: B, type: 'bid', title: 't', message: 'm', relatedEntityId: JOB, relatedEntityType: 'Job', isRead: true, createdAt: date }))
  const dto = await notifications.markRead(N1, { _id: B, role: 'Freelancer' })
  assert.equal(dto.read, true)
  assert.equal(dto.link, `/freelancer/jobs/${JOB}`)
})

test('notify never throws', async (t) => {
  t.mock.method(console, 'error', () => {})
  t.mock.method(Notification, 'create', async () => { throw new Error('boom') })
  assert.equal(await notifications.notify(A, { type: 'bid', title: 't', message: 'm' }), null)
})

// ── messageService ─────────────────────────────────────────────────────────────────────────
test('send: sender from the token, DTO shape, contract required between non-admins', async (t) => {
  const sender = { _id: A, name: 'Aisha', role: 'Client' }
  t.mock.method(User, 'findById', async () => ({ _id: B, role: 'Freelancer', status: 'Active' }))
  t.mock.method(notifications, 'notify', async () => null)
  t.mock.method(Contract, 'exists', async () => null)
  await assert.rejects(() => messages.send(sender, { receiverId: B, messageText: 'hi' }), (e) => (e.statusCode ?? e.status) === 403)
  t.mock.method(Contract, 'exists', async () => ({ _id: CT }))
  let saved
  t.mock.method(Message, 'create', async (d) => { saved = d; return { _id: M1, createdAt: date, read: false, ...d } })
  const dto = await messages.send(sender, { receiverId: B, messageText: 'hi' })
  assert.equal(saved.senderId, A)
  assert.deepEqual(dto, { messageId: M1, senderId: A, receiverId: B, messageText: 'hi', sentAt: '2025-10-01T10:00:00.000Z', read: false })
  await assert.rejects(() => messages.send(sender, { receiverId: A, messageText: 'me' }), (e) => (e.statusCode ?? e.status) === 400)
})

test('conversation: returns oldest->newest DTOs and marks the other side\'s messages read', async (t) => {
  const rows = [
    { _id: 'f'.repeat(24), senderId: B, receiverId: A, messageText: 'newer', createdAt: new Date('2025-10-02T00:00:00Z'), read: false },
    { _id: M1, senderId: A, receiverId: B, messageText: 'older', createdAt: date, read: true },
  ]
  t.mock.method(Message, 'find', () => chain(rows))
  t.mock.method(Message, 'countDocuments', async () => 2)
  let upd
  t.mock.method(Message, 'updateMany', async (f, u) => { upd = { f, u } })
  const out = await messages.conversation({ _id: A }, B, {})
  assert.deepEqual(out.items.map((m) => m.messageText), ['older', 'newer'])
  assert.equal(out.items[0].sentAt, '2025-10-01T10:00:00.000Z')
  assert.equal(String(upd.f.senderId), B)
  assert.equal(upd.f.receiverId, A)
  assert.deepEqual(upd.u, { $set: { read: true } })
})

test('listForUser: mailboxes are private, even for admins', async () => {
  await assert.rejects(() => messages.listForUser(B, { _id: A, role: 'Admin' }, {}), (e) => (e.statusCode ?? e.status) === 403)
})

test('listForUser ?view=conversations: DTO-shaped rows', async (t) => {
  t.mock.method(Message, 'aggregate', async () => [{ _id: B, unreadCount: 2, lastMessage: { _id: M1, senderId: B, messageText: 'yo', createdAt: date } }])
  t.mock.method(User, 'find', () => chain([{ _id: B, name: 'Meera', role: 'Freelancer' }]))
  const out = await messages.listForUser(A, { _id: A }, { view: 'conversations' })
  assert.deepEqual(out.items[0], { userId: B, name: 'Meera', role: 'Freelancer', unreadCount: 2, lastMessage: { messageId: M1, senderId: B, messageText: 'yo', sentAt: '2025-10-01T10:00:00.000Z' } })
})
