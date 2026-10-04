const mongoose = require('mongoose')

// Idempotency ledger: a webhook event id is inserted before processing; a duplicate insert means
// "already handled". Entries expire after 30 days (well beyond Razorpay's retry window).
const webhookEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true },
  event: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 },
})

module.exports = mongoose.model('WebhookEvent', webhookEventSchema)
