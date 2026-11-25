const { app, request, createUser, createProduct, addToCart } = require('../helpers');
const Coupon = require('../../models/Coupon');

const future = () => new Date(Date.now() + 7 * 86400000);

describe('cart', () => {
  test('add, merge, update and remove; totals are computed on the server', async () => {
    const { auth } = await createUser();
    const p = await createProduct({ price: 300, stock: 5 });

    let res = await addToCart(auth, p._id, 1);
    expect(res.status).toBe(201);
    res = await addToCart(auth, p._id, 2);
    expect(res.body.items).toHaveLength(1);
    expect(res.body).toMatchObject({ itemCount: 3, subtotal: 900, shippingFee: 49, total: 949, amountForFreeShipping: 99 });

    const itemId = res.body.items[0]._id;
    res = await request(app).put(`/api/cart/items/${itemId}`).set(auth).send({ qty: 4 });
    expect(res.body).toMatchObject({ subtotal: 1200, shippingFee: 0, total: 1200 });

    res = await request(app).delete(`/api/cart/items/${itemId}`).set(auth);
    expect(res.body.items).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });

  test('stock and quantity checks', async () => {
    const { auth } = await createUser();
    const p = await createProduct({ stock: 2 });
    expect((await addToCart(auth, p._id, 3)).body.message).toMatch(/Only 2/);
    expect((await addToCart(auth, p._id, 0)).status).toBe(400);
    expect((await addToCart(auth, p._id, 'abc')).status).toBe(400);
    expect((await addToCart(auth, p._id, 11)).status).toBe(400);
    expect((await addToCart(auth, '0'.repeat(24), 1)).status).toBe(404);
  });

  test('variants: required when a product has options, price includes the difference', async () => {
    const { auth } = await createUser();
    const p = await createProduct({ price: 500, variants: [{ name: 'Small', priceDelta: -100 }, { name: 'Large', priceDelta: 200 }] });
    expect((await addToCart(auth, p._id, 1)).body.message).toMatch(/choose an option/);
    expect((await addToCart(auth, p._id, 1, 'Huge')).status).toBe(400);

    await addToCart(auth, p._id, 1, 'Small');
    const res = await addToCart(auth, p._id, 1, 'Large');
    expect(res.body.items.map((i) => [i.variant, i.unitPrice])).toEqual([['Small', 400], ['Large', 700]]);
  });

  test('save for later and move back to cart', async () => {
    const { auth } = await createUser();
    const p = await createProduct();
    const added = await addToCart(auth, p._id, 2);
    const itemId = added.body.items[0]._id;

    let res = await request(app).post(`/api/cart/items/${itemId}/save-for-later`).set(auth);
    expect(res.body.items).toHaveLength(0);
    expect(res.body.savedForLater).toHaveLength(1);

    res = await request(app).post(`/api/cart/saved/${res.body.savedForLater[0]._id}/move-to-cart`).set(auth);
    expect(res.body.items[0].qty).toBe(2);
    expect(res.body.savedForLater).toHaveLength(0);
  });

  test('coupons: invalid, expired, minimum order, cap, remove', async () => {
    await Coupon.create([
      { code: 'WELCOME10', type: 'percent', value: 10, maxDiscount: 50, expiresAt: future() },
      { code: 'FLAT100', type: 'flat', value: 100, minOrder: 1000, expiresAt: future() },
      { code: 'OLD5', type: 'percent', value: 5, expiresAt: new Date(Date.now() - 1000) },
    ]);
    const { auth } = await createUser();
    const p = await createProduct({ price: 600 });

    expect((await request(app).post('/api/cart/coupon').set(auth).send({ code: 'WELCOME10' })).body.message).toMatch(/Add items/);
    await addToCart(auth, p._id, 1);

    const apply = (code) => request(app).post('/api/cart/coupon').set(auth).send({ code });
    expect((await apply('FLAT100')).body.message).toMatch(/Add items worth/);
    expect((await apply('OLD5')).body.message).toMatch(/expired/);
    expect((await apply('NOPE1')).body.message).toMatch(/Invalid/);

    const ok = await apply('welcome10'); // lower-case is fine
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ discount: 50, total: 599, coupon: { code: 'WELCOME10' } });

    const removed = await request(app).delete('/api/cart/coupon').set(auth);
    expect(removed.body).toMatchObject({ discount: 0, coupon: null });
  });

  test('public coupon list shows only usable coupons', async () => {
    await Coupon.create([
      { code: 'LIVE10', type: 'percent', value: 10, expiresAt: future() },
      { code: 'USEDUP', type: 'flat', value: 50, expiresAt: future(), usageLimit: 1, usedCount: 1 },
      { code: 'OFF', type: 'flat', value: 50, expiresAt: future(), isActive: false },
    ]);
    const res = await request(app).get('/api/coupons');
    expect(res.body.coupons.map((c) => c.code)).toEqual(['LIVE10']);
    expect(res.body.coupons[0].usedBy).toBeUndefined();
  });
});
