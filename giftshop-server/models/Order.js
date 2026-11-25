const crypto = require('crypto');
const mongoose = require('mongoose');
const { ORDER_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES } = require('../config/constants');

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, unique: true }, // human-friendly id, e.g. GS-M3K9X2AB-4F1A9C
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

  // Snapshot of name and price so old orders stay correct if the product changes later
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: String,
    image: String,
    variant: { type: String, default: '' },
    price: Number,
    qty: Number,
  }],

  shippingAddress: {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    line1: { type: String, required: true },
    line2: { type: String, default: '' },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
  },
  shipToSomeoneElse: { type: Boolean, default: false },
  giftMessage: { type: String, maxlength: 250, default: '' },
  giftWrap: { type: Boolean, default: false },
  deliveryDate: Date,

  paymentMethod: { type: String, enum: PAYMENT_METHODS, default: 'COD' },
  paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'Pending' },
  paymentId: String,
  razorpayOrderId: { type: String, index: true },
  paidAt: Date,

  couponCode: { type: String, default: null },
  subtotal: Number,
  discount: { type: Number, default: 0 },
  giftWrapFee: Number,
  shippingFee: Number,
  total: Number,

  status: { type: String, enum: ORDER_STATUSES, default: 'Placed', index: true },
  statusHistory: [{ status: String, note: String, at: { type: Date, default: Date.now } }],
  deliveredAt: Date,
  cancelledAt: Date,
  cancelReason: String,
}, { timestamps: true });

orderSchema.index({ createdAt: -1 });

orderSchema.pre('validate', function setOrderNumber() {
  if (!this.orderNumber) {
    const stamp = Date.now().toString(36).toUpperCase();
    this.orderNumber = `GS-${stamp}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  }
});

module.exports = mongoose.model('Order', orderSchema);
