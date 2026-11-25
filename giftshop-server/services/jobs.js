// Background job: online orders that were never paid hold stock, so cancel them after a timeout.
const Order = require('../models/Order');
const { cancelOrder } = require('./orderService');
const { PAYMENT_TIMEOUT_MINUTES } = require('../config/constants');

async function expireUnpaidOrders() {
  const cutoff = new Date(Date.now() - PAYMENT_TIMEOUT_MINUTES * 60 * 1000);
  const stale = await Order.find({
    paymentMethod: 'ONLINE', paymentStatus: 'Pending', status: 'Placed', createdAt: { $lt: cutoff },
  }).select('_id');

  let cancelled = 0;
  for (const { _id } of stale) {
    // eslint-disable-next-line no-await-in-loop
    if (await cancelOrder(_id, { allowedFrom: ['Placed'], reason: 'Payment not completed in time' })) cancelled++;
  }
  if (cancelled) console.log(`[jobs] cancelled ${cancelled} unpaid online order(s)`);
  return cancelled;
}

function startJobs() {
  const timer = setInterval(() => expireUnpaidOrders().catch((e) => console.error('[jobs]', e.message)), 5 * 60 * 1000);
  timer.unref(); // don't keep the process alive just for this
}

module.exports = { startJobs, expireUnpaidOrders };
