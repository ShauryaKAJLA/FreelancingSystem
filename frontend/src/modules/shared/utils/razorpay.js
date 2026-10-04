// Razorpay Checkout helper: create-order -> Checkout with order_id -> (the caller's fundMilestone) verify.
//   * The amount is NEVER sent to the server; the backend reads it from the milestone record.
//   * payWithRazorpay keeps its contract: it resolves with the Razorpay payment id. The order id and signature
//     Checkout returns are needed by /payments/verify, so they are parked here (takeCheckoutProof) and picked up
//     by liveFundMilestone in clientApi.js. Nothing secret is involved (the signature is useless without the server's key secret).
import { request } from '../api/http'

const SRC = 'https://checkout.razorpay.com/v1/checkout.js'

function loadScript() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve()
    const s = document.createElement('script')
    s.src = SRC
    s.onload = resolve
    s.onerror = () => reject(new Error('Could not load Razorpay. Check your internet connection.'))
    document.body.appendChild(s)
  })
}

// razorpay_payment_id -> { orderId, signature }. In memory only; cleared on read. A page reload loses it, in which
// case the server-side webhook (payment.captured) still funds the milestone.
const proofs = new Map()
export const takeCheckoutProof = (paymentId) => {
  const proof = proofs.get(paymentId)
  proofs.delete(paymentId)
  return proof ?? null
}

function openCheckout(options) {
  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      ...options,
      theme: { color: '#7c3aed' },
      modal: { ondismiss: () => reject(new Error('Payment was cancelled.')) },
      handler: (res) => resolve(res),
    })
    rzp.on('payment.failed', (r) => reject(new Error(r?.error?.description ?? 'Payment failed.')))
    rzp.open()
  })
}

// Resolves with the Razorpay payment id; rejects if the user closes the window or it fails.
// The money goes to the PLATFORM's Razorpay account (the key owner), never directly to a freelancer.
export async function payWithRazorpay({ description, name, email, notes }) {
  const milestoneId = notes?.milestoneId
  if (!milestoneId) throw new Error('Missing milestone for this payment.')
  const order = await request('post', '/payments/create-order', { data: { milestoneId } })
  if (order.error) throw new Error(order.error.data)
  const { orderId, amount: amountPaise, currency, keyId } = order.data
  await loadScript()
  const res = await openCheckout({
    key: keyId, order_id: orderId, amount: amountPaise, currency, name: 'FreelanceFlow', description, prefill: { name, email },
  })
  proofs.set(res.razorpay_payment_id, { orderId: res.razorpay_order_id ?? orderId, signature: res.razorpay_signature })
  return res.razorpay_payment_id
}
