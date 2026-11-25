// Order state changes shared by customers, admins, payments and the cleanup job.
// Every change is a single conditional update, so two requests can't both apply it.
const Order = require('../models/Order');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const User = require('../models/User');
const { orderStatusEmail } = require('../utils/email');

// Put stock back (used on rollback and on cancel)
const restoreStock = (items) => Promise.all(items.map((i) =>
  Product.updateOne({ _id: i.product }, { $inc: { stock: i.qty, soldCount: -i.qty } })));

// Give a coupon use back to the user (used on rollback and on cancel)
const releaseCoupon = (code, userId) => Coupon.updateOne(
  { code, usedCount: { $gt: 0 } },
  { $inc: { usedCount: -1 }, $pull: { usedBy: userId } }
);

/**
 * Cancels an order if its status is one of `allowedFrom`. Returns the order, or null if it couldn't be cancelled.
 * The status check and the update are one atomic operation, so a double click can't restore stock twice.
 */
async function cancelOrder(orderId, { allowedFrom, reason = '', filter = {} }) {
  const order = await Order.findOneAndUpdate(
    { _id: orderId, ...filter, status: { $in: allowedFrom } },
    {
      $set: { status: 'Cancelled', cancelledAt: new Date(), cancelReason: reason },
      $push: { statusHistory: { status: 'Cancelled', note: reason } },
    },
    { new: true }
  );
  if (!order) return null;

  await restoreStock(order.items);
  if (order.couponCode) await releaseCoupon(order.couponCode, order.user);
  if (order.paymentStatus === 'Paid') {
    order.paymentStatus = 'Refund Pending';
    await order.save();
  }
  return order;
}

// Moves an order forward (Placed -> Packed -> Shipped -> Delivered) only if it is still in `fromStatus`
async function advanceStatus(order, toStatus, note = '') {
  const set = { status: toStatus };
  if (toStatus === 'Delivered') {
    set.deliveredAt = new Date();
    if (order.paymentMethod === 'COD') { set.paymentStatus = 'Paid'; set.paidAt = new Date(); }
  }
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: order.status },
    { $set: set, $push: { statusHistory: { status: toStatus, note } } },
    { new: true }
  );
  if (updated && ['Shipped', 'Delivered'].includes(toStatus)) {
    User.findById(updated.user).then((u) => u && orderStatusEmail(updated, u)).catch(() => {});
  }
  return updated;
}

// Marks an online order as paid. Safe to call twice (webhook + client verify): only the first one changes it.
function markPaid(orderId, paymentId, extraFilter = {}) {
  return Order.findOneAndUpdate(
    { _id: orderId, paymentMethod: 'ONLINE', paymentStatus: 'Pending', status: { $ne: 'Cancelled' }, ...extraFilter },
    { $set: { paymentStatus: 'Paid', paymentId, paidAt: new Date() } },
    { new: true }
  );
}

module.exports = { restoreStock, releaseCoupon, cancelOrder, advanceStatus, markPaid };
