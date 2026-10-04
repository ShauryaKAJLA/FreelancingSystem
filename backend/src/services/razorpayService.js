// Thin Razorpay client. Uses Node's built-in crypto + fetch (Node >= 18) so there is no SDK dependency.
// The key secret only ever lives in this process; nothing here is sent to the browser except the PUBLIC key id.
const crypto = require('crypto')
const env = require('../config/env')
const ApiError = require('../utils/ApiError')

const API_BASE = 'https://api.razorpay.com/v1'

const isConfigured = () => Boolean(env.razorpayKeyId && env.razorpayKeySecret)

// Razorpay wants integer paise. Math.round guards float artefacts such as 1.1 * 100 = 110.00000000000001.
const toPaise = (rupees) => Math.round(Number(rupees) * 100)

const hmacHex = (secret, payload) => crypto.createHmac('sha256', secret).update(payload).digest('hex')

// Constant-time comparison of two hex digests; false on any malformed/length-mismatched input.
const safeEqualHex = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || !/^[0-9a-f]+$/i.test(a) || !/^[0-9a-f]+$/i.test(b)) return false
  const A = Buffer.from(a, 'hex')
  const B = Buffer.from(b, 'hex')
  return A.length > 0 && A.length === B.length && crypto.timingSafeEqual(A, B)
}

// Checkout signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret)
function verifyPaymentSignature({ orderId, paymentId, signature }) {
  if (!env.razorpayKeySecret) throw new ApiError(503, 'Payments are not configured on this server')
  return safeEqualHex(hmacHex(env.razorpayKeySecret, `${orderId}|${paymentId}`), signature)
}

// Webhook signature = HMAC_SHA256(raw request body, webhook_secret) -- must be the RAW bytes.
function verifyWebhookSignature(rawBody, signature) {
  if (!env.razorpayWebhookSecret) throw new ApiError(503, 'Webhook secret is not configured on this server')
  return safeEqualHex(hmacHex(env.razorpayWebhookSecret, rawBody), signature)
}

async function request(method, path, body) {
  if (!isConfigured()) throw new ApiError(503, 'Payments are not configured on this server')
  let res
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${env.razorpayKeyId}:${env.razorpayKeySecret}`).toString('base64')}`,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    })
  } catch (err) {
    console.error('Razorpay network error:', err.message)
    throw new ApiError(502, 'Could not reach the payment provider. Please try again.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    // Log the provider's detail; return a generic message so internals/keys never leak to clients.
    console.error('Razorpay API error:', res.status, JSON.stringify(data?.error || data))
    throw new ApiError(502, 'The payment provider rejected the request. Please try again.')
  }
  return data
}

// receipt must be <= 40 chars. notes are free-form key/values shown in the Razorpay dashboard.
const createOrder = ({ amountPaise, receipt, notes }) =>
  request('POST', '/orders', { amount: amountPaise, currency: 'INR', receipt, notes })

// Full refund of a captured payment. Razorpay confirms asynchronously via the refund.processed webhook.
// Idempotency: the receipt/notes carry our payment id so a manual retry is traceable in the dashboard.
const refundPayment = (providerPaymentId, { amountPaise, notes } = {}) =>
  request('POST', `/payments/${encodeURIComponent(providerPaymentId)}/refund`, { ...(amountPaise ? { amount: amountPaise } : {}), speed: 'normal', notes })

module.exports = { refundPayment, isConfigured, toPaise, verifyPaymentSignature, verifyWebhookSignature, createOrder, hmacHex, safeEqualHex }
