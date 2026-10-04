const rateLimit = require('express-rate-limit')
const env = require('../config/env')
const { verifyToken } = require('../utils/jwt')

// Phase 16: per-user rate limiting. A request carrying a VALID bearer token is counted against that user's id
// (so people sharing one NAT/office IP no longer share a budget, and the 30 s notification/message polling of a
// busy user cannot starve others). Everything else - no token, bad/expired token - is counted per client IP with
// the stricter anonymous budget. A forged token cannot buy a fresh budget: the signature is verified here.
function identify(req) {
  const [scheme, token] = String(req.headers.authorization || '').split(' ')
  if (scheme === 'Bearer' && token) {
    try {
      const { sub } = verifyToken(token)
      if (sub) return { key: `u:${sub}`, kind: 'user' }
    } catch {
      /* fall through to IP */
    }
  }
  return { key: `ip:${req.ip}`, kind: 'ip' }
}

function buildApiLimiter({ windowMs = env.rateLimitWindowMs, userMax = env.rateLimitUserMax, ipMax = env.rateLimitIpMax } = {}) {
  return rateLimit({
    windowMs,
    limit: (req) => (identify(req).kind === 'user' ? userMax : ipMax),
    keyGenerator: (req) => identify(req).key,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests. Please slow down.' },
  })
}

module.exports = { buildApiLimiter, identify }
