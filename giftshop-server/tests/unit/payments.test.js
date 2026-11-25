const { verifyPaymentSignature, verifyWebhookSignature, hmacHex } = require('../../utils/payments');

test('payment signature: correct one passes, tampered one fails', () => {
  const sig = hmacHex('secret', 'order_1|pay_1');
  expect(verifyPaymentSignature('order_1', 'pay_1', sig, 'secret')).toBe(true);
  expect(verifyPaymentSignature('order_1', 'pay_2', sig, 'secret')).toBe(false);
  expect(verifyPaymentSignature('order_1', 'pay_1', 'short', 'secret')).toBe(false);
  expect(verifyPaymentSignature('order_1', 'pay_1', sig, undefined)).toBe(false);
});

test('webhook signature is checked against the raw body', () => {
  const body = Buffer.from('{"event":"payment.captured"}');
  const sig = hmacHex('whsec', body);
  expect(verifyWebhookSignature(body, sig, 'whsec')).toBe(true);
  expect(verifyWebhookSignature(Buffer.from('{"event":"x"}'), sig, 'whsec')).toBe(false);
});
