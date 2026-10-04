// Card handling that runs ONLY in the browser. The full card number is validated here and reduced to
// { brand, last4 }; the number itself is never put in a request, a Redux store or a log line.
// Error strings are the frontend's own strings (they are what the form shows).

// Brand from the leading digits. Anything unrecognised stays a generic "Card".
export function detectBrand(digits) {
  if (/^4/.test(digits)) return 'Visa'
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard'
  if (/^3[47]/.test(digits)) return 'Amex'
  if (/^(60|65|81|82|508)/.test(digits)) return 'RuPay'
  return 'Card'
}

// Returns { error: string } or { brand, last4, expiry, holderName }.
export function reduceCard({ cardNumber, expiry, holderName }) {
  const digits = String(cardNumber ?? '').replace(/\s+/g, '')
  if (!/^\d{13,19}$/.test(digits)) return { error: 'Enter a valid card number.' }
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry || '')) return { error: 'Enter expiry as MM/YY.' }
  if (!holderName?.trim()) return { error: "Enter the cardholder's name." }
  return { brand: detectBrand(digits), last4: digits.slice(-4), expiry, holderName: holderName.trim() }
}
