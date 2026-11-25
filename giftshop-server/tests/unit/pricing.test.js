const { unitPrice, couponProblem, couponDiscount, computeTotals, deliveryWindow } = require('../../utils/pricing');

const future = new Date(Date.now() + 86400000);
const coupon = (o = {}) => ({ code: 'X', isActive: true, type: 'percent', value: 10, minOrder: 0, expiresAt: future, usageLimit: null, usedCount: 0, onePerUser: true, usedBy: [], ...o });

describe('unitPrice', () => {
  const product = { price: 500, finalPrice: 400, variants: [{ name: 'Large', priceDelta: 150 }] };
  test('uses the discounted price', () => expect(unitPrice(product)).toBe(400));
  test('adds the variant price difference', () => expect(unitPrice(product, 'Large')).toBe(550));
  test('falls back to price when finalPrice is missing', () => expect(unitPrice({ price: 99, variants: [] })).toBe(99));
});

describe('couponProblem', () => {
  test('valid coupon', () => expect(couponProblem(coupon(), 500, 'u1')).toBeNull());
  test('missing or inactive', () => {
    expect(couponProblem(null, 500)).toMatch(/Invalid/);
    expect(couponProblem(coupon({ isActive: false }), 500)).toMatch(/Invalid/);
  });
  test('expired', () => expect(couponProblem(coupon({ expiresAt: new Date(Date.now() - 1000) }), 500)).toMatch(/expired/));
  test('usage limit reached', () => expect(couponProblem(coupon({ usageLimit: 2, usedCount: 2 }), 500)).toMatch(/limit/));
  test('already used by this user', () => expect(couponProblem(coupon({ usedBy: ['u1'] }), 500, 'u1')).toMatch(/already used/));
  test('below minimum order', () => expect(couponProblem(coupon({ minOrder: 999 }), 500)).toMatch(/499 more/));
});

describe('couponDiscount', () => {
  test('percent', () => expect(couponDiscount(coupon({ value: 10 }), 750)).toBe(75));
  test('percent with a cap', () => expect(couponDiscount(coupon({ value: 50, maxDiscount: 200 }), 1000)).toBe(200));
  test('flat never exceeds the subtotal', () => expect(couponDiscount(coupon({ type: 'flat', value: 500 }), 300)).toBe(300));
});

describe('computeTotals', () => {
  test('charges shipping below the free-shipping threshold', () => {
    expect(computeTotals({ subtotal: 500 })).toEqual({ subtotal: 500, discount: 0, giftWrapFee: 0, shippingFee: 49, total: 549 });
  });
  test('free shipping at 999 and above, gift wrap added', () => {
    expect(computeTotals({ subtotal: 1000, giftWrap: true })).toEqual({ subtotal: 1000, discount: 0, giftWrapFee: 49, shippingFee: 0, total: 1049 });
  });
  test('discount can bring the order back under the threshold', () => {
    expect(computeTotals({ subtotal: 1000, discount: 100 }).total).toBe(949);
  });
  test('rounds to 2 decimals', () => expect(computeTotals({ subtotal: 0.1 + 0.2 }).subtotal).toBe(0.3));
});

test('deliveryWindow is 3 to 7 days from today', () => {
  const { earliest, latest } = deliveryWindow(new Date('2026-01-10T15:00:00Z'));
  expect(earliest.toISOString()).toBe('2026-01-13T00:00:00.000Z');
  expect(latest.toISOString()).toBe('2026-01-17T00:00:00.000Z');
});
