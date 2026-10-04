require('dotenv').config()

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/freelanceflow',
  jwtSecret: process.env.JWT_SECRET || 'change_this_secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  // Per-user rate limiting (Phase 16): signed-in users are counted by user id, anonymous callers by IP.
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  rateLimitUserMax: Number(process.env.RATE_LIMIT_USER_MAX) || 600,
  rateLimitIpMax: Number(process.env.RATE_LIMIT_IP_MAX) || 300,
  shutdownTimeoutMs: Number(process.env.SHUTDOWN_TIMEOUT_MS) || 10000,
}

// Pure: returns a list of problems for the given env object (empty = OK). Production is strict; other modes only
// warn-worthy items are not errors so local dev and tests keep working with a bare .env.
function findEnvProblems(e, processEnv = process.env) {
  if (e.nodeEnv !== 'production') return []
  const problems = []
  if (e.jwtSecret === 'change_this_secret' || e.jwtSecret.length < 32) problems.push('JWT_SECRET must be a strong value (32+ chars)')
  if (!processEnv.MONGODB_URI) problems.push('MONGODB_URI is required')
  else if (/127\.0\.0\.1|localhost/.test(e.mongoUri)) problems.push('MONGODB_URI must not point at localhost in production')
  if (!e.razorpayKeyId || !e.razorpayKeySecret) problems.push('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required')
  if (!e.razorpayWebhookSecret) problems.push('RAZORPAY_WEBHOOK_SECRET is required')
  if (!processEnv.CLIENT_URL) problems.push('CLIENT_URL is required (CORS allow-list)')
  else if (e.clientUrl.split(',').some((u) => u.trim() === '*' )) problems.push('CLIENT_URL must not be "*"')
  return problems
}

// Fail fast in production (all problems reported at once).
function validateEnv(e = env, processEnv = process.env) {
  const problems = findEnvProblems(e, processEnv)
  if (problems.length) throw new Error(`Invalid production configuration:\n - ${problems.join('\n - ')}`)
}

module.exports = env
module.exports.findEnvProblems = findEnvProblems
module.exports.validateEnv = validateEnv
