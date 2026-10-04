const mongoose = require('mongoose')
const Message = require('../models/Message')
const User = require('../models/User')
const Contract = require('../models/Contract')
const ApiError = require('../utils/ApiError')
const notifications = require('./notificationService')
const { MESSAGING_REQUIRES_CONTRACT } = require('../models/constants')
const { parsePagination, pageMeta } = require('../utils/pagination')
const { toMessageDTO, idOf, iso } = require('../utils/dto')

const oid = (id) => new mongoose.Types.ObjectId(String(id))
const assertId = (id, label) => {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, `Invalid ${label}`)
}

async function canMessage(sender, receiver) {
  if (sender.role === 'Admin' || receiver.role === 'Admin' || !MESSAGING_REQUIRES_CONTRACT) return true
  return Boolean(await Contract.exists({
    $or: [{ clientId: sender._id, freelancerId: receiver._id }, { clientId: receiver._id, freelancerId: sender._id }],
  }))
}

// senderId always comes from the authenticated user, never from the body.
async function send(sender, { receiverId, messageText }) {
  assertId(receiverId, 'receiverId')
  if (String(receiverId) === String(sender._id)) throw new ApiError(400, 'You cannot message yourself')
  const receiver = await User.findById(receiverId)
  if (!receiver || receiver.status !== 'Active') throw new ApiError(404, 'Recipient not found')
  if (!(await canMessage(sender, receiver))) throw new ApiError(403, 'You can only message people you have a contract with')

  const message = await Message.create({ senderId: sender._id, receiverId: receiver._id, messageText })
  await notifications.notify(receiver._id, {
    type: 'message', title: 'New message', message: `${sender.name} sent you a message.`, relatedEntityId: sender._id, relatedEntityType: 'User',
  })
  return toMessageDTO(message)
}

// "Get user's messages": the caller's own inbox/outbox. Default = flat list (newest first).
// ?view=conversations => one row per counterpart with the last message and unread count.
async function listForUser(userId, viewer, query) {
  assertId(userId, 'userId')
  // Private by design: only the user themself (not even admins) can read a mailbox through this route.
  if (String(userId) !== String(viewer._id)) throw new ApiError(403, 'You can only read your own messages')
  const me = oid(userId)

  if (query.view === 'conversations') {
    const rows = await Message.aggregate([
      { $match: { $or: [{ senderId: me }, { receiverId: me }] } },
      { $sort: { createdAt: -1, _id: -1 } },
      { $addFields: { otherId: { $cond: [{ $eq: ['$senderId', me] }, '$receiverId', '$senderId'] } } },
      {
        $group: {
          _id: '$otherId',
          lastMessage: { $first: '$$ROOT' },
          unreadCount: { $sum: { $cond: [{ $and: [{ $eq: ['$receiverId', me] }, { $eq: ['$read', false] }] }, 1, 0] } },
        },
      },
      { $sort: { 'lastMessage.createdAt': -1 } },
      { $limit: 100 },
    ])
    const users = await User.find({ _id: { $in: rows.map((r) => r._id) } }).select('name role')
    const byId = new Map(users.map((u) => [String(u._id), u]))
    return {
      items: rows.map((r) => ({
        userId: idOf(r._id),
        name: byId.get(String(r._id))?.name ?? 'Unknown user',
        role: byId.get(String(r._id))?.role,
        unreadCount: r.unreadCount,
        lastMessage: { messageId: idOf(r.lastMessage._id), senderId: idOf(r.lastMessage.senderId), messageText: r.lastMessage.messageText, sentAt: iso(r.lastMessage.createdAt) },
      })),
    }
  }

  const p = parsePagination(query)
  const filter = { $or: [{ senderId: me }, { receiverId: me }] }
  const [items, total] = await Promise.all([
    Message.find(filter).sort({ createdAt: -1, _id: -1 }).skip(p.skip).limit(p.limit),
    Message.countDocuments(filter),
  ])
  return { items: items.map(toMessageDTO), pagination: pageMeta(p, total) }
}

// Conversation between the caller and one other user. The two ids in the filter ARE the participant
// check: a third party can never match, and the caller's id is taken from the token.
// Paged newest-first (page 1 = latest); items are returned oldest->newest for display.
async function conversation(viewer, otherUserId, query) {
  assertId(otherUserId, 'otherUserId')
  const me = viewer._id
  const other = oid(otherUserId)
  const p = parsePagination(query, { defaultLimit: 50 })
  const filter = { $or: [{ senderId: me, receiverId: other }, { senderId: other, receiverId: me }] }
  const [items, total] = await Promise.all([
    Message.find(filter).sort({ createdAt: -1, _id: -1 }).skip(p.skip).limit(p.limit),
    Message.countDocuments(filter),
  ])
  // Opening the conversation marks the other person's messages to me as read.
  await Message.updateMany({ senderId: other, receiverId: me, read: false }, { $set: { read: true } })
  return { items: items.reverse().map(toMessageDTO), pagination: pageMeta(p, total) }
}

module.exports = { send, listForUser, conversation }
