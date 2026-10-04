const Notification = require('../models/Notification')
const User = require('../models/User')
const ApiError = require('../utils/ApiError')
const mongoose = require('mongoose')
const { parsePagination, pageMeta } = require('../utils/pagination')
const { toNotificationDTO, idOf } = require('../utils/dto')

// ---- Producer helpers: called by other services. They NEVER throw, so a notification failure can
// never roll back or break the business action (payment, review, ...) that triggered it. ----
async function notify(userId, { type, title, message, relatedEntityId = null, relatedEntityType = null }) {
  try {
    return await Notification.create({ userId, type, title, message, relatedEntityId, relatedEntityType })
  } catch (err) {
    console.error('notify failed:', err.message)
    return null
  }
}

async function notifyMany(userIds, payload) {
  const unique = [...new Set(userIds.filter(Boolean).map(String))]
  return Promise.all(unique.map((id) => notify(id, payload)))
}

async function notifyAdmins(payload) {
  try {
    const admins = await User.find({ role: 'Admin', status: 'Active' }).select('_id')
    return await notifyMany(admins.map((a) => a._id), payload)
  } catch (err) {
    console.error('notifyAdmins failed:', err.message)
    return []
  }
}

// ---- Link resolution (pure) ----
// The frontend navigates to notification.link, and its routes are role-prefixed, so the same
// notification maps to a different URL per recipient role. `contractIdOf(type, id)` resolves the
// owning contract for Milestone/Payment entities (null when unknown -> falls back to the list page).
const ROLE_PREFIX = { Client: '/client', Freelancer: '/freelancer', Admin: '/admin' }
const MESSAGES_PATH = { Client: '/messages', Freelancer: '/freelancer/messages', Admin: '/admin/messages' }

function linkFor(role, n, contractIdOf = () => null) {
  const prefix = ROLE_PREFIX[role]
  if (!prefix) return null
  const id = n.relatedEntityId ? String(n.relatedEntityId) : null
  switch (n.relatedEntityType) {
    case 'Job':
      if (role === 'Admin') return '/admin/jobs'
      return id ? `${prefix}/jobs/${id}` : `${prefix}/jobs`
    case 'Contract':
      return id ? `${prefix}/contracts/${id}` : `${prefix}/contracts`
    case 'Milestone': {
      const contractId = id ? contractIdOf('Milestone', id) : null
      return contractId ? `${prefix}/contracts/${contractId}` : `${prefix}/contracts`
    }
    case 'Payment':
      if (role === 'Admin') return id ? `/admin/payments/${id}` : '/admin/transactions'
      return id ? `${prefix}/payments/${id}` : `${prefix}/payments`
    case 'User':
      if (n.type === 'account') return role === 'Admin' && id ? `/admin/users/${id}` : null
      return MESSAGES_PATH[role]
    case 'Issue':
      return role === 'Admin' ? '/admin/reports' : `${prefix}/contracts`
    default:
      return null
  }
}

// Batch-resolves contract ids for the Milestone / Payment notifications in one page (2 queries max).
async function contractLookup(items) {
  const Milestone = require('../models/Milestone')
  const Payment = require('../models/Payment')
  const ids = (type) => [...new Set(items.filter((n) => n.relatedEntityType === type && n.relatedEntityId).map((n) => String(n.relatedEntityId)))]
  const [msIds, payIds] = [ids('Milestone'), ids('Payment')]
  const [milestones, payments] = await Promise.all([
    msIds.length ? Milestone.find({ _id: { $in: msIds } }).select('contractId') : [],
    payIds.length ? Payment.find({ _id: { $in: payIds } }).select('contractId') : [],
  ])
  const map = new Map()
  milestones.forEach((m) => map.set(`Milestone:${idOf(m)}`, idOf(m.contractId)))
  payments.forEach((p) => map.set(`Payment:${idOf(p)}`, idOf(p.contractId)))
  return (type, id) => map.get(`${type}:${id}`) ?? null
}

async function toDTOs(items, role) {
  let lookup = () => null
  try { lookup = await contractLookup(items) } catch (err) { console.error('notification link lookup failed:', err.message) }
  return items.map((n) => toNotificationDTO(n, linkFor(role, n, lookup)))
}

// ---- Consumer API ----
const assertId = (id, label) => {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, `Invalid ${label}`)
}

async function list(userId, query, viewer) {
  assertId(userId, 'userId')
  const p = parsePagination(query)
  const filter = { userId }
  if (query.unreadOnly === 'true') filter.isRead = false
  const [items, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1, _id: -1 }).skip(p.skip).limit(p.limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ userId, isRead: false }),
  ])
  return { items: await toDTOs(items, viewer?.role), unreadCount, pagination: pageMeta(p, total) }
}

async function markRead(notificationId, viewer) {
  assertId(notificationId, 'notificationId')
  // Owner-scoped filter: someone else's notification behaves exactly like a missing one (no id probing).
  const n = await Notification.findOneAndUpdate({ _id: notificationId, userId: viewer._id }, { $set: { isRead: true } }, { new: true })
  if (!n) throw new ApiError(404, 'Notification not found')
  return (await toDTOs([n], viewer.role))[0]
}

async function markAllRead(viewer) {
  const r = await Notification.updateMany({ userId: viewer._id, isRead: false }, { $set: { isRead: true } })
  return { updated: r.modifiedCount }
}

module.exports = { notify, notifyMany, notifyAdmins, list, markRead, markAllRead, linkFor }
