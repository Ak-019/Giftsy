// All money maths lives here and runs on the server only. The client never sends prices or totals.
const {
  GIFT_WRAP_FEE, SHIPPING_FEE, FREE_SHIPPING_ABOVE, DELIVERY_MIN_DAYS, DELIVERY_MAX_DAYS,
} = require('../config/constants');
const { round2, startOfDayUTC, addDays } = require('./helpers');

// Price of one unit: discounted price (if any) plus the variant's price difference
function unitPrice(product, variantName = '') {
  const base = product.finalPrice ?? product.price;
  const variant = variantName ? (product.variants || []).find((v) => v.name === variantName) : null;
  return round2(base + (variant?.priceDelta || 0));
}

// Returns a reason the coupon can't be used, or null if it is fine
function couponProblem(coupon, subtotal, userId, now = new Date()) {
  if (!coupon || !coupon.isActive) return 'Invalid coupon code';
  if (coupon.expiresAt <= now) return 'This coupon has expired';
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) return 'This coupon has reached its usage limit';
  if (coupon.onePerUser && userId && (coupon.usedBy || []).some((id) => id.toString() === userId.toString())) {
    return 'You have already used this coupon';
  }
  if (subtotal < coupon.minOrder) return `Add items worth ₹${round2(coupon.minOrder - subtotal)} more to use this coupon`;
  return null;
}

function couponDiscount(coupon, subtotal) {
  let discount = coupon.type === 'percent' ? (subtotal * coupon.value) / 100 : coupon.value;
  if (coupon.type === 'percent' && coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
  return round2(Math.min(discount, subtotal)); // never more than the subtotal
}

function computeTotals({ subtotal, discount = 0, giftWrap = false }) {
  const afterDiscount = subtotal - discount;
  const giftWrapFee = giftWrap ? GIFT_WRAP_FEE : 0;
  const shippingFee = subtotal === 0 || afterDiscount >= FREE_SHIPPING_ABOVE ? 0 : SHIPPING_FEE;
  return {
    subtotal: round2(subtotal),
    discount: round2(discount),
    giftWrapFee,
    shippingFee,
    total: round2(afterDiscount + giftWrapFee + shippingFee),
  };
}

function deliveryWindow(from = new Date()) {
  const today = startOfDayUTC(from);
  return { earliest: addDays(today, DELIVERY_MIN_DAYS), latest: addDays(today, DELIVERY_MAX_DAYS) };
}

module.exports = { unitPrice, couponProblem, couponDiscount, computeTotals, deliveryWindow };
