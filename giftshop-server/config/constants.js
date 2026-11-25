// Business rules in one place, so they are easy to find and change.
module.exports = {
  ORDER_STATUSES: ['Placed', 'Packed', 'Shipped', 'Delivered', 'Cancelled'],

  // Allowed admin status changes. Anything not listed is rejected (e.g. Delivered -> Placed).
  STATUS_TRANSITIONS: {
    Placed: ['Packed', 'Cancelled'],
    Packed: ['Shipped', 'Cancelled'],
    Shipped: ['Delivered'],
    Delivered: [],
    Cancelled: [],
  },

  PAYMENT_METHODS: ['COD', 'ONLINE'],
  PAYMENT_STATUSES: ['Pending', 'Paid', 'Refund Pending', 'Refunded'],

  OCCASIONS: ['Birthday', 'Anniversary', 'Wedding', 'Festival', 'Housewarming', 'Thank You', 'Other'],
  RECIPIENTS: ['For Him', 'For Her', 'Kids', 'Couples', 'Parents', 'Friends', 'Colleagues'],

  GIFT_WRAP_FEE: 49,
  SHIPPING_FEE: 49,
  FREE_SHIPPING_ABOVE: 999,

  DELIVERY_MIN_DAYS: 3, // earliest delivery is today + 3 days
  DELIVERY_MAX_DAYS: 7,
  DELIVERY_DATE_MAX_DAYS: 30, // a chosen delivery date can be at most 30 days ahead

  MAX_QTY_PER_ITEM: 10,
  MAX_ADDRESSES: 10,
  LOW_STOCK_THRESHOLD: 5,
  PAYMENT_TIMEOUT_MINUTES: 30, // unpaid online orders are cancelled after this, releasing stock

  REPORT_TIMEZONE: 'Asia/Kolkata', // used to group admin chart data by day
};
