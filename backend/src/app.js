const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const { buildApiLimiter } = require('./middleware/rateLimit')
const env = require('./config/env')
const routes = require('./routes')
const requestId = require('./middleware/requestId')
const requestLogger = require('./middleware/requestLogger')
const { notFound, errorHandler } = require('./middleware/errorHandler')
const User = require('./models/User')
const bcrypt = require('bcryptjs/dist/bcrypt')

const app = express();
// iffe

app.disable('x-powered-by')
if (env.nodeEnv === 'production') app.set('trust proxy', 1) // behind a load balancer: correct client IPs for rate limits
app.use(requestId)
// This process serves JSON only, so a locked-down CSP is safe; HSTS only in production (it is sticky in browsers).
app.use(
  helmet({
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"], formAction: ["'none'"] } },
    hsts: env.nodeEnv === 'production' ? { maxAge: 15552000, includeSubDomains: true } : false,
    crossOriginResourcePolicy: { policy: 'same-site' },
  })
)
// Exact-match allow-list from CLIENT_URL (comma separated). Requests with no Origin (curl, server-to-server,
// Razorpay webhooks) are allowed through CORS; they are still authenticated/signature-checked by their routes.
const allowedOrigins = env.clientUrl.split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean)
app.use(cors({ origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin)), credentials: true, exposedHeaders: ['X-Request-Id', 'X-Total-Count', 'X-Page', 'X-Limit', 'X-Total-Pages'] }))
// Razorpay webhook: must receive the RAW bytes (the signature is computed over them), so it is
// registered before express.json. Authenticity comes from the HMAC signature, not a login.
app.post('/api/payments/webhook', express.raw({ type: '*/*', limit: '100kb' }), require('./controllers/paymentController').webhook)

app.use(express.json({ limit: '100kb' }))
if (env.nodeEnv !== 'test') app.use(requestLogger)

app.use('/api', buildApiLimiter())

app.use('/api', routes)
app.use(notFound)
app.use(errorHandler)

module.exports = app
