const mongoose = require('mongoose')
const PaymentMethod = require('../models/PaymentMethod')
const User = require('../models/User')
const ApiError = require('../utils/ApiError')
const { toPaymentMethodDTO, idOf } = require('../utils/dto')

const MAX_METHODS_PER_CLIENT = 10
const assertId = (id, label) => {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, `Invalid ${label}`)
}

async function list(clientId) {
  assertId(clientId, 'clientId')
  const rows = await PaymentMethod.find({ clientId }).sort({ isDefault: -1, createdAt: -1 })
  return rows.map(toPaymentMethodDTO)
}

async function add(clientId, data) {
  assertId(clientId, 'clientId')
  const user = await User.findById(clientId)
  if (!user || user.role !== 'Client') throw new ApiError(404, 'Client not found')
  if ((await PaymentMethod.countDocuments({ clientId })) >= MAX_METHODS_PER_CLIENT) {
    throw new ApiError(409, `You can save at most ${MAX_METHODS_PER_CLIENT} payment methods`)
  }
  const isFirst = !(await PaymentMethod.exists({ clientId }))
  const isDefault = isFirst || data.isDefault === true
  if (isDefault && !isFirst) await PaymentMethod.updateMany({ clientId }, { $set: { isDefault: false } })
  return toPaymentMethodDTO(await PaymentMethod.create({ ...data, clientId, isDefault }))
}

// Owner-only, and a foreign id looks exactly like a missing one.
async function loadOwned(paymentMethodId, viewer) {
  assertId(paymentMethodId, 'paymentMethodId')
  const method = await PaymentMethod.findOne({ _id: paymentMethodId, clientId: viewer._id })
  if (!method) throw new ApiError(404, 'Payment method not found')
  return method
}

async function remove(paymentMethodId, viewer) {
  const method = await loadOwned(paymentMethodId, viewer)
  await method.deleteOne()
  if (method.isDefault) {
    // Promote the most recent remaining method so a client with methods always has a default.
    const next = await PaymentMethod.findOne({ clientId: viewer._id }).sort({ createdAt: -1 })
    if (next) await PaymentMethod.updateOne({ _id: next._id }, { $set: { isDefault: true } })
  }
  return { paymentMethodId: idOf(method) }
}

async function setDefault(paymentMethodId, viewer) {
  const method = await loadOwned(paymentMethodId, viewer)
  await PaymentMethod.updateMany({ clientId: viewer._id, _id: { $ne: method._id } }, { $set: { isDefault: false } })
  method.isDefault = true
  await method.save()
  return toPaymentMethodDTO(method)
}

module.exports = { list, add, remove, setDefault }
