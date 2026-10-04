const mongoose = require('mongoose')
const { PAYMENT_METHOD_TYPES } = require('./constants')

// Display-only saved method. NEVER holds a full card number, CVV or anything usable to charge.
const paymentMethodSchema = new mongoose.Schema(
  {
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: PAYMENT_METHOD_TYPES, required: true },
    brand: { type: String, trim: true, maxlength: 30, default: '' },
    last4: { type: String, match: /^\d{4}$/, default: undefined },
    expiry: { type: String, match: /^(0[1-9]|1[0-2])\/\d{2}$/, default: undefined },
    holderName: { type: String, trim: true, maxlength: 100, default: '' },
    upiId: { type: String, trim: true, maxlength: 100, default: undefined },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
)

module.exports = mongoose.model('PaymentMethod', paymentMethodSchema)
