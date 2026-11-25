// Razorpay (test mode) when keys are set in .env, otherwise a mock payment flow for demos.
// Calls the Razorpay REST API directly with fetch, so no extra SDK is needed.
const crypto = require('crypto');

const isRazorpayEnabled = () => Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

const hmacHex = (secret, data) => crypto.createHmac('sha256', secret).update(data).digest('hex');

// Constant-time comparison so the signature can't be guessed byte by byte
function safeEqual(a, b) {
  const ba = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

// Signature the Razorpay checkout returns: HMAC_SHA256(order_id + "|" + payment_id, key_secret)
function verifyPaymentSignature(razorpayOrderId, paymentId, signature, secret = process.env.RAZORPAY_KEY_SECRET) {
  if (!secret) return false;
  return safeEqual(hmacHex(secret, `${razorpayOrderId}|${paymentId}`), signature);
}

// Webhook signature: HMAC_SHA256(raw request body, webhook_secret)
function verifyWebhookSignature(rawBody, signature, secret = process.env.RAZORPAY_WEBHOOK_SECRET) {
  if (!secret) return false;
  return safeEqual(hmacHex(secret, rawBody), signature);
}

async function createRazorpayOrder(order) {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: Math.round(order.total * 100), // paise
      currency: 'INR',
      receipt: order.orderNumber,
      notes: { orderId: order._id.toString() },
    }),
  });
  if (!res.ok) throw new Error(`Razorpay responded with ${res.status}`);
  return res.json();
}

// Called right after an ONLINE order is placed. Returns what the frontend needs to open checkout.
async function startPayment(order) {
  if (!isRazorpayEnabled()) {
    return { provider: 'mock', amount: order.total, currency: 'INR', orderId: order._id };
  }
  const rp = await createRazorpayOrder(order);
  order.razorpayOrderId = rp.id;
  await order.save();
  return {
    provider: 'razorpay', keyId: process.env.RAZORPAY_KEY_ID, razorpayOrderId: rp.id,
    amount: rp.amount, currency: rp.currency, orderId: order._id,
  };
}

module.exports = { isRazorpayEnabled, verifyPaymentSignature, verifyWebhookSignature, startPayment, hmacHex };
