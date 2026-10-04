const ApiError = require('../utils/ApiError')
const { ROLES, SELF_REGISTER_ROLES } = require('../models/constants')
const { isString, isEmail } = require('./helpers')

const fail = (errors) => {
  if (errors.length) throw new ApiError(400, 'Validation failed', errors)
}

// Type checks (isString) also block NoSQL-operator injection like { "email": { "$gt": "" } }.
const validateRegister = (req, _res, next) => {
  const { name, email, password, role } = req.body || {}
  const errors = []
  if (!isString(name) || name.trim().length < 2 || name.trim().length > 100) errors.push('name must be 2-100 characters')
  if (!isEmail(email)) errors.push('a valid email is required')
  if (!isString(password) || password.length < 8 || password.length > 128) errors.push('password must be 8-128 characters')
  else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) errors.push('password must contain a letter and a number')
  if (!SELF_REGISTER_ROLES.includes(role)) errors.push(`role must be one of: ${SELF_REGISTER_ROLES.join(', ')}`)
  fail(errors)
  next()
}

const validateLogin = (req, _res, next) => {
  const { email, password, role } = req.body || {}
  const errors = []
  if (!isEmail(email)) errors.push('a valid email is required')
  if (!isString(password) || !password) errors.push('password is required')
  // Optional: the frontend's login form sends the selected workspace role.
  if (role !== undefined && !ROLES.includes(role)) errors.push(`role must be one of: ${ROLES.join(', ')}`)
  fail(errors)
  next()
}

module.exports = { validateRegister, validateLogin }
