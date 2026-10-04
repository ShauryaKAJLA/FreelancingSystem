const { PAYMENT_METHOD_TYPES } = require('../models/constants')
const { isString, isObjectId, fail, cleanText } = require('./helpers')

// NOTE: no amount field is accepted anywhere -- the amount always comes from the milestone record.
const validateCreateOrder = (req, _res, next) => {
  const { milestoneId } = req.body || {}
  fail(isObjectId(milestoneId) ? [] : ['milestoneId must be a valid id'])
  req.body = { milestoneId }
  next()
}

// Type checks also stop operator injection ({ "$ne": null }) reaching the DB query.
const validateVerify = (req, _res, next) => {
  const { razorpay_order_id: o, razorpay_payment_id: p, razorpay_signature: s } = req.body || {}
  const errors = []
  if (!isString(o) || !/^order_[A-Za-z0-9]{6,40}$/.test(o)) errors.push('razorpay_order_id is invalid')
  if (!isString(p) || !/^pay_[A-Za-z0-9]{6,40}$/.test(p)) errors.push('razorpay_payment_id is invalid')
  if (!isString(s) || !/^[0-9a-fA-F]{64}$/.test(s)) errors.push('razorpay_signature is invalid')
  fail(errors)
  req.body = { razorpay_order_id: o, razorpay_payment_id: p, razorpay_signature: s }
  next()
}

const validatePayout = (req, _res, next) => {
  const { payoutReference } = req.body || {}
  const errors = []
  if (payoutReference !== undefined && (!isString(payoutReference) || payoutReference.length > 100)) errors.push('payoutReference must be text up to 100 characters')
  fail(errors)
  req.body = payoutReference ? { payoutReference: cleanText(payoutReference) } : {}
  next()
}

// Anything that looks like raw card data is refused outright rather than silently dropped.
const FORBIDDEN_KEYS = ['cardNumber', 'card_number', 'number', 'pan', 'cvv', 'cvc', 'securityCode', 'pin']
const validatePaymentMethod = (req, _res, next) => {
  const b = req.body || {}
  const errors = []
  const bad = FORBIDDEN_KEYS.filter((k) => k in b)
  if (bad.length) errors.push('Raw card details must never be sent to this API; send only brand, last4 and expiry')
  if (!PAYMENT_METHOD_TYPES.includes(b.type)) errors.push(`type must be one of: ${PAYMENT_METHOD_TYPES.join(', ')}`)
  if (b.isDefault !== undefined && typeof b.isDefault !== 'boolean') errors.push('isDefault must be true or false')

  const data = { type: b.type, isDefault: b.isDefault === true }
  if (b.type === 'Card') {
    if (!isString(b.last4) || !/^\d{4}$/.test(b.last4)) errors.push('last4 must be exactly 4 digits')
    if (!isString(b.expiry) || !/^(0[1-9]|1[0-2])\/\d{2}$/.test(b.expiry)) errors.push('expiry must be MM/YY')
    else {
      const [mm, yy] = b.expiry.split('/').map(Number)
      const now = new Date()
      if (2000 + yy < now.getFullYear() || (2000 + yy === now.getFullYear() && mm < now.getMonth() + 1)) errors.push('card has expired')
    }
    if (!isString(b.brand) || !b.brand.trim() || b.brand.length > 30) errors.push('brand is required (max 30 characters)')
    if (!isString(b.holderName) || !b.holderName.trim() || b.holderName.length > 100) errors.push('holderName is required (max 100 characters)')
    Object.assign(data, { last4: b.last4, expiry: b.expiry, brand: isString(b.brand) ? cleanText(b.brand) : '', holderName: isString(b.holderName) ? cleanText(b.holderName) : '' })
  } else if (b.type === 'UPI') {
    if (!isString(b.upiId) || !/^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z]{2,32}$/.test(b.upiId)) errors.push('upiId must look like name@bank')
    Object.assign(data, { upiId: b.upiId, brand: 'UPI', holderName: isString(b.holderName) ? cleanText(b.holderName).slice(0, 100) : '' })
  }
  fail(errors)
  req.body = data
  next()
}

const validateRefund = (req, _res, next) => {
  const b = req.body || {}
  const errors = []
  if (b.reason !== undefined && (typeof b.reason !== 'string' || b.reason.length > 300)) errors.push('reason must be text up to 300 characters')
  fail(errors)
  req.body = { reason: typeof b.reason === 'string' ? b.reason.trim() : '' }
  next()
}

module.exports = { validateCreateOrder, validateVerify, validatePayout, validatePaymentMethod, validateRefund }
