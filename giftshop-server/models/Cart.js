const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  qty: { type: Number, required: true, min: 1, default: 1 },
  variant: { type: String, default: '' },
});

// Prices are NOT stored in the cart. They are read fresh from the products every time.
const cartSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  items: [cartItemSchema],
  savedForLater: [cartItemSchema],
  couponCode: { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Cart', cartSchema);
