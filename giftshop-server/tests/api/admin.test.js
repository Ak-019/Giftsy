const { app, request, createUser, createAdmin, createProduct, addToCart, placeOrder } = require('../helpers');
const Product = require('../../models/Product');
const Coupon = require('../../models/Coupon');

async function buy(customer, product) {
  await addToCart(customer.auth, product._id, 1).expect(201);
  return (await placeOrder(customer.auth).expect(201)).body.order;
}

describe('admin access', () => {
  test.each(['/api/admin/stats', '/api/admin/orders', '/api/admin/users', '/api/admin/reviews', '/api/admin/coupons'])(
    '%s is admin-only', async (url) => {
      const { auth } = await createUser();
      expect((await request(app).get(url).set(auth)).status).toBe(403);
    }
  );
});

describe('dashboard stats', () => {
  test('totals, one row per day, top products and low stock', async () => {
    const { auth } = await createAdmin();
    const customer = await createUser();
    const p = await createProduct({ name: 'Best Seller', price: 600, stock: 3 });
    await buy(customer, p);

    const res = await request(app).get('/api/admin/stats?days=7').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.totals).toMatchObject({ orders: 1, revenue: 649, avgOrderValue: 649, customers: 1, pendingOrders: 1 });
    expect(res.body.ordersPerDay).toHaveLength(7);
    expect(res.body.ordersPerDay[6]).toMatchObject({ orders: 1, revenue: 649 }); // today
    expect(res.body.topProducts[0]).toMatchObject({ name: 'Best Seller', sold: 1 });
    expect(res.body.lowStock.map((x) => x.name)).toEqual(['Best Seller']); // stock 2 now
    expect(res.body.statusBreakdown.Placed).toBe(1);
  });
});

describe('admin orders list', () => {
  test('filter by status and search by customer email', async () => {
    const { auth } = await createAdmin();
    const a = await createUser({ email: 'alpha@test.com' });
    const b = await createUser({ email: 'beta@test.com' });
    const p = await createProduct();
    const orderA = await buy(a, p);
    await buy(b, p);
    await request(app).put(`/api/admin/orders/${orderA._id}/status`).set(auth).send({ status: 'Packed' }).expect(200);

    expect((await request(app).get('/api/admin/orders?status=Packed').set(auth)).body.total).toBe(1);
    const search = await request(app).get('/api/admin/orders?search=beta@').set(auth);
    expect(search.body.orders.map((o) => o.user.email)).toEqual(['beta@test.com']);
    const byNumber = await request(app).get(`/api/admin/orders?search=${orderA.orderNumber}`).set(auth);
    expect(byNumber.body.total).toBe(1);
  });
});

describe('users', () => {
  test('list with order counts; block and unblock', async () => {
    const admin = await createAdmin();
    const customer = await createUser({ name: 'Blocky' });
    await buy(customer, await createProduct({ price: 1000 }));

    const list = await request(app).get('/api/admin/users?search=Blocky').set(admin.auth);
    expect(list.body.users[0]).toMatchObject({ name: 'Blocky', orders: 1, spent: 1000 });

    const id = customer.user._id;
    await request(app).put(`/api/admin/users/${id}/block`).set(admin.auth).send({ isBlocked: true }).expect(200);
    expect((await request(app).get('/api/auth/me').set(customer.auth)).status).toBe(403);
    await request(app).put(`/api/admin/users/${id}/block`).set(admin.auth).send({ isBlocked: false }).expect(200);
    expect((await request(app).get('/api/auth/me').set(customer.auth)).status).toBe(200);
  });

  test('cannot block yourself or another admin', async () => {
    const admin = await createAdmin();
    const other = await createAdmin();
    expect((await request(app).put(`/api/admin/users/${admin.user._id}/block`).set(admin.auth).send({ isBlocked: true })).status).toBe(400);
    expect((await request(app).put(`/api/admin/users/${other.user._id}/block`).set(admin.auth).send({ isBlocked: true })).status).toBe(400);
  });
});

describe('reviews', () => {
  test('buyers only, one each, rating recalculated, edit and admin moderation', async () => {
    const admin = await createAdmin();
    const u1 = await createUser();
    const u2 = await createUser();
    const p = await createProduct();
    const review = (u, rating) => request(app).post(`/api/products/${p._id}/reviews`).set(u.auth).send({ rating, comment: 'Nice' });

    expect((await review(u1, 5)).status).toBe(403); // has not bought it
    await buy(u1, p);
    await buy(u2, p);

    const page = await request(app).get(`/api/products/${p._id}`).set(u1.auth);
    expect(page.body.canReview).toBe(true);

    const r1 = await review(u1, 5);
    expect(r1.status).toBe(201);
    expect((await review(u1, 4)).status).toBe(409);
    const r2 = await review(u2, 3);
    let prod = await Product.findById(p._id);
    expect([prod.ratingAvg, prod.ratingCount]).toEqual([4, 2]);

    const list = await request(app).get('/api/admin/reviews').set(admin.auth);
    expect(list.body.total).toBe(2);

    await request(app).delete(`/api/reviews/${r2.body.review._id}`).set(u1.auth).expect(404); // not u1's review
    await request(app).delete(`/api/reviews/${r2.body.review._id}`).set(admin.auth).expect(200);
    prod = await Product.findById(p._id);
    expect([prod.ratingAvg, prod.ratingCount]).toEqual([5, 1]);

    await request(app).put(`/api/reviews/${r1.body.review._id}`).set(u1.auth).send({ rating: 2 }).expect(200);
    expect((await Product.findById(p._id)).ratingAvg).toBe(2);

    const breakdown = (await request(app).get(`/api/products/${p._id}`)).body.ratingBreakdown;
    expect(breakdown).toEqual({ 1: 0, 2: 1, 3: 0, 4: 0, 5: 0 });
  });
});

describe('coupon management', () => {
  const future = () => new Date(Date.now() + 86400000).toISOString();

  test('create, validate, update and delete', async () => {
    const { auth } = await createAdmin();
    const create = (body) => request(app).post('/api/admin/coupons').set(auth).send(body);

    const res = await create({ code: 'summer15', type: 'percent', value: 15, expiresAt: future() });
    expect(res.status).toBe(201);
    expect(res.body.coupon.code).toBe('SUMMER15');
    expect((await create({ code: 'SUMMER15', type: 'flat', value: 10, expiresAt: future() })).status).toBe(409);
    expect((await create({ code: 'BIG', type: 'percent', value: 150, expiresAt: future() })).status).toBe(400);
    expect((await create({ code: 'PAST', type: 'flat', value: 10, expiresAt: '2020-01-01' })).status).toBe(400);

    const id = res.body.coupon._id;
    const upd = await request(app).put(`/api/admin/coupons/${id}`).set(auth).send({ value: 20, usageLimit: 50 });
    expect(upd.body.coupon).toMatchObject({ value: 20, usageLimit: 50 });

    await request(app).delete(`/api/admin/coupons/${id}`).set(auth).expect(200);
    expect(await Coupon.countDocuments()).toBe(0);
  });
});
