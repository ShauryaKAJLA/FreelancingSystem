const bcrypt = require('bcryptjs')
const User = require('../models/User')
const ClientProfile = require('../models/ClientProfile')
const FreelancerProfile = require('../models/FreelancerProfile')
const ApiError = require('../utils/ApiError')
const { signToken } = require('../utils/jwt')
const { toSessionUser, toUserDTO } = require('../utils/dto')

const BCRYPT_ROUNDS = 12
// Compared against when the email is unknown so response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS)

// Frontend shape (userId, ...) - see utils/dto.js. `user` is what the React app stores as currentUser.
const safeUser = toUserDTO
const session = (user) => ({ token: signToken(user), user: toSessionUser(user) })

async function register({ name, email, password, role }) {
  const normalized = email.trim().toLowerCase()
  if (await User.exists({ email: normalized })) throw new ApiError(409, 'An account with this email already exists')

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
  const user = await User.create({ name: name.trim(), email: normalized, passwordHash, role })

  // Standalone MongoDB has no multi-document transactions, so undo the user if profile creation fails.
  try {
    if (role === 'Client') await ClientProfile.create({ userId: user._id })
    else await FreelancerProfile.create({ userId: user._id })
  } catch (err) {
    await User.deleteOne({ _id: user._id })
    throw err
  }

  return session(user)
}

async function login({ email, password, role }) {
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+passwordHash')
  const valid = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH)
  if (!user || !valid) throw new ApiError(401, 'Invalid email or password')
  if (user.status !== 'Active') throw new ApiError(403, 'This account has been flagged. Contact support.')
  // The login screen has a role selector. Checked only AFTER the password is proven, so it can't be used
  // to discover which emails exist.
  if (role && user.role !== role) throw new ApiError(401, 'No account found with that email for the selected role.')

  return session(user)
}

module.exports = { register, login, safeUser }
