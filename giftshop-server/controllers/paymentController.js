const crypto = require('crypto');
const Order = require('../models/Order');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { isRazorpayEnabled, verifyPaymentSignature, verifyWebhookSignature } = require('../utils/payments');
const { markPaid } = require('../services/orderService');

// GET /api/payments/config  -> tells the frontend which checkout to show
exports.config = (req, res) => {
  res.json({
    success: true,
    provider: isRazorpayEnabled() ? 'razorpay' : 'mock',
    keyId: isRazorpayEnabled() ? process.env.RAZORPAY_KEY_ID : null,
  });
};

async function loadPayableOrder(orderId, userId) {
  const order = await Order.findOne({ _id: orderId, user: userId });
  if (!order) throw new AppError('Order not found', 404);
  if (order.paymentMethod !== 'ONLINE') throw new AppError('This order is cash on delivery');
  if (order.status === 'Cancelled') throw new AppError('This order was cancelled');
  return order;
}

// POST /api/payments/verify  (called by the frontend after Razorpay checkout succeeds)
// Never trust "payment succeeded" from the browser: check the signature with our secret.
exports.verify = asyncHandler(async (req, res) => {
  if (!isRazorpayEnabled()) throw new AppError('Online payments are not configured');
  const { orderId, razorpay_order_id: rpOrderId, razorpay_payment_id: rpPaymentId, razorpay_signature: signature } = req.body;

  const order = await loadPayableOrder(orderId, req.user._id);
  if (order.paymentStatus === 'Paid') return res.json({ success: true, order }); // already confirmed (e.g. by webhook)
  if (order.razorpayOrderId !== rpOrderId) throw new AppError('Payment does not belong to this order');
  if (!verifyPaymentSignature(rpOrderId, rpPaymentId, signature)) throw new AppError('Payment verification failed');

  const paid = await markPaid(order._id, rpPaymentId);
  return res.json({ success: true, order: paid || (await Order.findById(order._id)) });
});

// POST /api/payments/mock-pay  (demo mode only, when Razorpay keys are not set)
exports.mockPay = asyncHandler(async (req, res) => {
  if (isRazorpayEnabled()) throw new AppError('Mock payments are disabled when Razorpay is configured');
  const order = await loadPayableOrder(req.body.orderId, req.user._id);
  if (order.paymentStatus === 'Paid') return res.json({ success: true, order });

  const paid = await markPaid(order._id, `mock_${crypto.randomBytes(6).toString('hex')}`);
  if (!paid) throw new AppError('This order can no longer be paid');
  return res.json({ success: true, order: paid });
});

// POST /api/payments/webhook  (called by Razorpay's servers; body is raw so the signature can be checked)
exports.webhook = asyncHandler(async (req, res) => {
  const signature = req.get('x-razorpay-signature');
  if (!Buffer.isBuffer(req.body) || !verifyWebhookSignature(req.body, signature)) {
    throw new AppError('Invalid webhook signature', 400);
  }

  const event = JSON.parse(req.body.toString('utf8'));
  if (['payment.captured', 'order.paid'].includes(event.event)) {
    const payment = event.payload?.payment?.entity;
    if (payment?.order_id) {
      const order = await Order.findOne({ razorpayOrderId: payment.order_id });
      if (order) await markPaid(order._id, payment.id); // no-op if the client already verified it
    }
  }
  res.json({ success: true }); // always 200 for valid events so Razorpay stops retrying
});
