const { app, request, createUser, createAdmin, createProduct, addToCart, placeOrder, validAddress, binaryParser, dateIn } = require('../helpers');
const Product = require('../../models/Product');
const Coupon = require('../../models/Coupon');
const Order = require('../../models/Order');
const { expireUnpaidOrders } = require('../../services/jobs');
const { hmacHex } = require('../../utils/payments');

async function customerWithCart({ price = 500, stock = 5, qty = 1 } = {}) {
  const customer = await createUser();
  const product = await createProduct({ price, stock });
  await addToCart(customer.auth, product._id, qty).expect(201);
  return { ...customer, product };
}
const stockOf = async (p) => (await Product.findById(p._id)).stock;
const setStatus = (auth, id, status) => request(app).put(`/api/admin/orders/${id}/status`).set(auth).send({ status });

describe('placing orders', () => {
  test('totals come from the server, stock is deducted and the cart is cleared', async () => {
    const { auth, product } = await customerWithCart({ price: 500, qty: 2 });
    const res = await placeOrder(auth, { giftWrap: true, giftMessage: 'Happy birthday!', total: 1, subtotal: 1, items: [] });

    expect(res.status).toBe(201);
    expect(res.body.order).toMatchObject({
      subtotal: 1000, giftWrapFee: 49, shippingFee: 0, total: 1049, status: 'Placed', giftMessage: 'Happy birthday!',
    });
    expect(res.body.order.items[0]).toMatchObject({ name: product.name, price: 500, qty: 2 });
    expect(res.body.order.orderNumber).toMatch(/^GS-/);
    expect(res.body.payment).toBeNull();

    const p = await Product.findById(product._id);
    expect(p.stock).toBe(3);
    expect(p.soldCount).toBe(2);
    expect((await request(app).get('/api/cart').set(auth)).body.items).toHaveLength(0);
  });

  test('order keeps a price snapshot when the product price changes later', async () => {
    const { auth, product } = await customerWithCart({ price: 500 });
    const { body } = await placeOrder(auth);
    await Product.updateOne({ _id: product._id }, { price: 9999, finalPrice: 9999 });
    const again = await request(app).get(`/api/orders/${body.order._id}`).set(auth);
    expect(again.body.order.items[0].price).toBe(500);
  });

  test('empty cart -> 400', async () => {
    const { auth } = await createUser();
    expect((await placeOrder(auth)).body.message).toMatch(/empty/);
  });

  test('can ship to a saved address', async () => {
    const { auth } = await customerWithCart();
    const saved = await request(app).post('/api/account/addresses').set(auth).send({ ...validAddress, city: 'Mysuru' });
    const res = await request(app).post('/api/orders').set(auth).send({ addressId: saved.body.addresses[0]._id });
    expect(res.status).toBe(201);
    expect(res.body.order.shippingAddress.city).toBe('Mysuru');
  });

  test('delivery date must be at least 3 days away', async () => {
    const { auth, product } = await customerWithCart();
    expect((await placeOrder(auth, { deliveryDate: dateIn(1) })).body.message).toMatch(/Earliest/);
    expect(await stockOf(product)).toBe(5);
    expect((await placeOrder(auth, { deliveryDate: dateIn(5) })).status).toBe(201);
  });

  test('if one item lacks stock, nothing is deducted (rollback)', async () => {
    const { auth } = await createUser();
    const a = await createProduct({ stock: 5 });
    const b = await createProduct({ stock: 1 });
    await addToCart(auth, a._id, 2);
    await addToCart(auth, b._id, 1);
    await Product.updateOne({ _id: b._id }, { stock: 0 }); // someone else bought it meanwhile

    const res = await placeOrder(auth);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/does not have enough stock/);
    expect(await stockOf(a)).toBe(5);
    expect((await request(app).get('/api/cart').set(auth)).body.items).toHaveLength(2);
  });

  test('two buyers, one last unit: exactly one order succeeds', async () => {
    const p = await createProduct({ stock: 1 });
    const [u1, u2] = await Promise.all([createUser(), createUser()]);
    await addToCart(u1.auth, p._id, 1);
    await addToCart(u2.auth, p._id, 1);

    const results = await Promise.all([placeOrder(u1.auth), placeOrder(u2.auth)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 400]);
    expect(await stockOf(p)).toBe(0);
    expect(await Order.countDocuments()).toBe(1);
  });
});

describe('coupons at checkout', () => {
  test('discount applied, coupon use counted, then given back on cancel', async () => {
    await Coupon.create({ code: 'SAVE10', type: 'percent', value: 10, expiresAt: new Date(Date.now() + 86400000) });
    const { auth, product } = await customerWithCart({ price: 1000 });
    await request(app).post('/api/cart/coupon').set(auth).send({ code: 'SAVE10' }).expect(200);

    const res = await placeOrder(auth);
    expect(res.body.order).toMatchObject({ subtotal: 1000, discount: 100, shippingFee: 49, total: 949, couponCode: 'SAVE10' });
    expect((await Coupon.findOne({ code: 'SAVE10' })).usedCount).toBe(1);

    await request(app).put(`/api/orders/${res.body.order._id}/cancel`).set(auth).expect(200);
    const coupon = await Coupon.findOne({ code: 'SAVE10' });
    expect(coupon.usedCount).toBe(0);
    expect(coupon.usedBy).toHaveLength(0);
    expect(await stockOf(product)).toBe(5);
  });

  test('a one-per-user coupon cannot be used twice', async () => {
    await Coupon.create({ code: 'ONCE', type: 'flat', value: 50, expiresAt: new Date(Date.now() + 86400000) });
    const { auth, product } = await customerWithCart();
    await request(app).post('/api/cart/coupon').set(auth).send({ code: 'ONCE' }).expect(200);
    await placeOrder(auth).expect(201);

    await addToCart(auth, product._id, 1);
    expect((await request(app).post('/api/cart/coupon').set(auth).send({ code: 'ONCE' })).body.message).toMatch(/already used/);
  });

  test('usage limit holds when two people check out at the same moment', async () => {
    await Coupon.create({ code: 'LIMIT1', type: 'flat', value: 50, usageLimit: 1, onePerUser: false, expiresAt: new Date(Date.now() + 86400000) });
    const c1 = await customerWithCart();
    const c2 = await customerWithCart();
    await request(app).post('/api/cart/coupon').set(c1.auth).send({ code: 'LIMIT1' }).expect(200);
    await request(app).post('/api/cart/coupon').set(c2.auth).send({ code: 'LIMIT1' }).expect(200);

    const results = await Promise.all([placeOrder(c1.auth), placeOrder(c2.auth)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 400]);
    expect((await Coupon.findOne({ code: 'LIMIT1' })).usedCount).toBe(1);
    const stocks = [await stockOf(c1.product), await stockOf(c2.product)].sort();
    expect(stocks).toEqual([4, 5]); // the failed order gave its stock back
  });
});

describe('cancelling and status changes', () => {
  test('customer can cancel while Placed; a second cancel does not restore stock again', async () => {
    const { auth, product } = await customerWithCart({ qty: 2 });
    const { body } = await placeOrder(auth);
    expect(await stockOf(product)).toBe(3);

    const first = await request(app).put(`/api/orders/${body.order._id}/cancel`).set(auth).send({ reason: 'Changed my mind' });
    expect(first.body.order).toMatchObject({ status: 'Cancelled', cancelReason: 'Changed my mind' });
    expect(await stockOf(product)).toBe(5);

    expect((await request(app).put(`/api/orders/${body.order._id}/cancel`).set(auth)).status).toBe(400);
    expect(await stockOf(product)).toBe(5);
  });

  test('customer cannot cancel after the order is packed', async () => {
    const admin = await createAdmin();
    const { auth } = await customerWithCart();
    const { body } = await placeOrder(auth);
    await setStatus(admin.auth, body.order._id, 'Packed').expect(200);
    expect((await request(app).put(`/api/orders/${body.order._id}/cancel`).set(auth)).body.message).toMatch(/can no longer/);
  });

  test('admin must follow Placed -> Packed -> Shipped -> Delivered; COD becomes Paid on delivery', async () => {
    const admin = await createAdmin();
    const { auth } = await customerWithCart();
    const id = (await placeOrder(auth)).body.order._id;

    expect((await setStatus(admin.auth, id, 'Delivered')).body.message).toMatch(/Cannot change status/);
    await setStatus(admin.auth, id, 'Packed').expect(200);
    await setStatus(admin.auth, id, 'Shipped').expect(200);
    const done = await setStatus(admin.auth, id, 'Delivered');
    expect(done.body.order).toMatchObject({ status: 'Delivered', paymentStatus: 'Paid' });
    expect(done.body.order.statusHistory.map((h) => h.status)).toEqual(['Placed', 'Packed', 'Shipped', 'Delivered']);
    expect((await setStatus(admin.auth, id, 'Cancelled')).status).toBe(400);
  });

  test('admin cancel restores stock', async () => {
    const admin = await createAdmin();
    const { auth, product } = await customerWithCart();
    const id = (await placeOrder(auth)).body.order._id;
    await setStatus(admin.auth, id, 'Packed').expect(200);
    await setStatus(admin.auth, id, 'Cancelled').expect(200);
    expect(await stockOf(product)).toBe(5);
  });
});

describe('viewing orders', () => {
  test('customers only see their own orders; admins see all', async () => {
    const owner = await customerWithCart();
    const other = await createUser();
    const admin = await createAdmin();
    const id = (await placeOrder(owner.auth)).body.order._id;

    expect((await request(app).get(`/api/orders/${id}`).set(owner.auth)).status).toBe(200);
    expect((await request(app).get(`/api/orders/${id}`).set(other.auth)).status).toBe(403);
    expect((await request(app).get(`/api/orders/${id}`).set(admin.auth)).status).toBe(200);
    expect((await request(app).put(`/api/orders/${id}/cancel`).set(other.auth)).status).toBe(404);

    const mine = await request(app).get('/api/orders/my').set(owner.auth);
    expect(mine.body).toMatchObject({ total: 1 });
  });

  test('invoice downloads as a PDF', async () => {
    const { auth } = await customerWithCart();
    const id = (await placeOrder(auth, { giftMessage: 'Enjoy!' })).body.order._id;
    const res = await request(app).get(`/api/orders/${id}/invoice`).set(auth).buffer(true).parse(binaryParser);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.body.subarray(0, 4).toString()).toBe('%PDF');
  });
});

describe('online payments', () => {
  afterEach(() => {
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
  });

  test('mock payment flow; admin cannot pack an unpaid online order', async () => {
    const admin = await createAdmin();
    const { auth } = await customerWithCart();
    const res = await placeOrder(auth, { paymentMethod: 'ONLINE' });
    expect(res.body.payment).toMatchObject({ provider: 'mock' });
    expect(res.body.order.paymentStatus).toBe('Pending');
    const id = res.body.order._id;

    expect((await setStatus(admin.auth, id, 'Packed')).body.message).toMatch(/not been paid/);
    const paid = await request(app).post('/api/payments/mock-pay').set(auth).send({ orderId: id });
    expect(paid.body.order.paymentStatus).toBe('Paid');
    await setStatus(admin.auth, id, 'Packed').expect(200);
  });

  test('cancelling a paid order marks it for refund', async () => {
    const { auth } = await customerWithCart();
    const id = (await placeOrder(auth, { paymentMethod: 'ONLINE' })).body.order._id;
    await request(app).post('/api/payments/mock-pay').set(auth).send({ orderId: id }).expect(200);
    const res = await request(app).put(`/api/orders/${id}/cancel`).set(auth);
    expect(res.body.order.paymentStatus).toBe('Refund Pending');
  });

  test('unpaid online orders expire and give their stock back', async () => {
    const { auth, product } = await customerWithCart();
    const id = (await placeOrder(auth, { paymentMethod: 'ONLINE' })).body.order._id;
    await Order.collection.updateOne({ _id: new Order.base.Types.ObjectId(id) }, { $set: { createdAt: new Date(Date.now() - 60 * 60 * 1000) } });

    expect(await expireUnpaidOrders()).toBe(1);
    expect((await Order.findById(id)).status).toBe('Cancelled');
    expect(await stockOf(product)).toBe(5);
  });

  test('Razorpay verify accepts only a correct signature', async () => {
    const { auth } = await customerWithCart();
    const id = (await placeOrder(auth, { paymentMethod: 'ONLINE' })).body.order._id; // created in mock mode
    await Order.updateOne({ _id: id }, { razorpayOrderId: 'order_test_1' });
    process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
    process.env.RAZORPAY_KEY_SECRET = 'rzp_secret';

    const body = { orderId: id, razorpay_order_id: 'order_test_1', razorpay_payment_id: 'pay_1' };
    const bad = await request(app).post('/api/payments/verify').set(auth).send({ ...body, razorpay_signature: 'wrong' });
    expect(bad.status).toBe(400);

    const sig = hmacHex('rzp_secret', 'order_test_1|pay_1');
    const good = await request(app).post('/api/payments/verify').set(auth).send({ ...body, razorpay_signature: sig });
    expect(good.body.order).toMatchObject({ paymentStatus: 'Paid', paymentId: 'pay_1' });
  });

  test('webhook marks the order paid only with a valid signature', async () => {
    const { auth } = await customerWithCart();
    const id = (await placeOrder(auth, { paymentMethod: 'ONLINE' })).body.order._id;
    await Order.updateOne({ _id: id }, { razorpayOrderId: 'order_wh_1' });
    process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec';

    const payload = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_wh', order_id: 'order_wh_1' } } } });
    const send = (sig) => request(app).post('/api/payments/webhook')
      .set('Content-Type', 'application/json').set('x-razorpay-signature', sig).send(payload);

    expect((await send('bad')).status).toBe(400);
    expect((await Order.findById(id)).paymentStatus).toBe('Pending');
    expect((await send(hmacHex('whsec', payload))).status).toBe(200);
    expect((await Order.findById(id)).paymentStatus).toBe('Paid');
  });
});
