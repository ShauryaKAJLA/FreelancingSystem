const mongoose = require('mongoose')
const ApiError = require('../utils/ApiError')

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const isString = (v) => typeof v === 'string'
const isEmail = (v) => isString(v) && v.length <= 254 && EMAIL_RE.test(v.trim())
const isObjectId = (v) => isString(v) && mongoose.isValidObjectId(v)

// Throws a 400 with the collected messages, if any.
const fail = (errors) => {
  if (errors.length) throw new ApiError(400, 'Validation failed', errors)
}

// Strips control characters and HTML tags from user-supplied free text (defence in depth for any
// consumer that renders it unescaped). React already escapes; this protects emails/PDFs/admin tools.
// eslint-disable-next-line no-control-regex
const cleanText = (v) => String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/<[^>]*>/g, '').trim()

module.exports = { isString, isEmail, isObjectId, fail, cleanText }
