import api from '../api/client';

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Could not load the payment window. Check your connection.'));
    document.body.appendChild(s);
  });
}

/**
 * Opens Razorpay checkout for an order and verifies the result on the server.
 * Resolves with the paid order, rejects if the customer closes the window or the payment fails.
 */
export async function payWithRazorpay(payment, user) {
  await loadRazorpay();
  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: payment.keyId,
      order_id: payment.razorpayOrderId,
      amount: payment.amount,
      currency: payment.currency,
      name: 'Giftsy',
      description: 'Gift order',
      prefill: { name: user?.name, email: user?.email },
      theme: { color: '#5E3A4D' },
      handler: async (response) => {
        try {
          // The browser's "success" is not trusted: the server checks the signature
          const { data } = await api.post('/payments/verify', { orderId: payment.orderId, ...response });
          resolve(data.order);
        } catch (err) {
          reject(err);
        }
      },
      modal: { ondismiss: () => reject(new Error('Payment was cancelled. You can pay later from your orders.')) },
    });
    rzp.on('payment.failed', (r) => reject(new Error(r.error?.description || 'Payment failed')));
    rzp.open();
  });
}

// Payment details for an existing unpaid order (used by "Pay now" on the order page)
export function paymentForOrder(order, config) {
  if (config.provider === 'razorpay') {
    return { provider: 'razorpay', keyId: config.keyId, razorpayOrderId: order.razorpayOrderId, amount: Math.round(order.total * 100), currency: 'INR', orderId: order._id };
  }
  return { provider: 'mock', amount: order.total, orderId: order._id };
}
