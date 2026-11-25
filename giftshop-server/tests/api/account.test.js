const { app, request, createUser, createProduct, validAddress, dateIn } = require('../helpers');

describe('account', () => {
  test('update profile', async () => {
    const { auth } = await createUser();
    const res = await request(app).put('/api/account/profile').set(auth).send({ name: 'New Name', phone: '9123456789', role: 'admin' });
    expect(res.body.user).toMatchObject({ name: 'New Name', phone: '9123456789', role: 'user' });
  });

  test('change password: needs the current one, then old password stops working', async () => {
    const { auth } = await createUser({ email: 'pw@test.com', password: 'oldpass1' });
    const wrong = await request(app).put('/api/account/password').set(auth).send({ currentPassword: 'nope', newPassword: 'newpass1' });
    expect(wrong.status).toBe(401);

    const ok = await request(app).put('/api/account/password').set(auth).send({ currentPassword: 'oldpass1', newPassword: 'newpass1' });
    expect(ok.status).toBe(200);
    expect(ok.body.accessToken).toEqual(expect.any(String));
    expect((await request(app).post('/api/auth/login').send({ email: 'pw@test.com', password: 'oldpass1' })).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ email: 'pw@test.com', password: 'newpass1' })).status).toBe(200);
  });

  test('addresses: first is default, default can move, deleting the default promotes another', async () => {
    const { auth } = await createUser();
    const add = (extra) => request(app).post('/api/account/addresses').set(auth).send({ ...validAddress, ...extra });

    let res = await add({ label: 'Home' });
    expect(res.body.addresses[0].isDefault).toBe(true);
    res = await add({ label: 'Office', isDefault: true });
    expect(res.body.addresses.map((a) => [a.label, a.isDefault])).toEqual([['Home', false], ['Office', true]]);

    const office = res.body.addresses[1]._id;
    res = await request(app).put(`/api/account/addresses/${office}`).set(auth).send({ city: 'Pune' });
    expect(res.body.addresses[1].city).toBe('Pune');

    res = await request(app).delete(`/api/account/addresses/${office}`).set(auth);
    expect(res.body.addresses.map((a) => [a.label, a.isDefault])).toEqual([['Home', true]]);

    expect((await add({ phone: '123' })).status).toBe(400);
  });

  test('wishlist toggle and list', async () => {
    const { auth } = await createUser();
    const p = await createProduct({ name: 'Wish Mug' });

    let res = await request(app).post(`/api/account/wishlist/${p._id}`).set(auth);
    expect(res.body.inWishlist).toBe(true);
    res = await request(app).get('/api/account/wishlist').set(auth);
    expect(res.body.wishlist.map((w) => w.name)).toEqual(['Wish Mug']);

    res = await request(app).post(`/api/account/wishlist/${p._id}`).set(auth);
    expect(res.body.inWishlist).toBe(false);
    expect((await request(app).post(`/api/account/wishlist/${'0'.repeat(24)}`).set(auth)).status).toBe(404);
  });

  test('product page shows inWishlist for the logged-in user', async () => {
    const { auth } = await createUser();
    const p = await createProduct();
    await request(app).post(`/api/account/wishlist/${p._id}`).set(auth);
    const res = await request(app).get(`/api/products/slug/${p.slug}`).set(auth);
    expect(res.body.inWishlist).toBe(true);
  });

  test('occasions: add, edit, delete and upcoming reminders', async () => {
    const { auth } = await createUser();
    const add = (body) => request(app).post('/api/account/occasions').set(auth).send(body);

    await add({ title: "Mom's Birthday", type: 'Birthday', date: dateIn(10, 30) }).expect(201);
    const anniv = await add({ title: 'Anniversary', type: 'Anniversary', date: dateIn(3, 5) });
    await add({ title: 'Far away', date: dateIn(100, 1) });
    expect((await add({ title: 'Bad', date: 'not-a-date' })).status).toBe(400);

    let res = await request(app).get('/api/account/occasions/upcoming?days=30').set(auth);
    expect(res.body.occasions.map((o) => [o.title, o.daysLeft])).toEqual([['Anniversary', 3], ["Mom's Birthday", 10]]);
    expect(res.body.occasions[0].giftFinderQuery).toEqual({ occasion: 'Anniversary' });

    const id = anniv.body.occasion._id;
    res = await request(app).put(`/api/account/occasions/${id}`).set(auth).send({ personName: 'Partner' });
    expect(res.body.occasion.personName).toBe('Partner');
    await request(app).delete(`/api/account/occasions/${id}`).set(auth).expect(200);
    expect((await request(app).get('/api/account/occasions').set(auth)).body.occasions).toHaveLength(2);
  });
});
