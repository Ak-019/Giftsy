const { app, request, createUser } = require('../helpers');
const User = require('../../models/User');

const refreshCookie = (res) => res.headers['set-cookie'].find((c) => c.startsWith('refreshToken=')).split(';')[0];

describe('auth', () => {
  test('register ignores "role", lower-cases email and sets an httpOnly refresh cookie', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ name: 'Asha', email: 'ASHA@Test.com', password: 'secret123', role: 'admin' });
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ role: 'user', email: 'asha@test.com' });
    expect(res.body.user.password).toBeUndefined();
    expect(res.body.user.tokenVersion).toBeUndefined();
    expect(res.headers['set-cookie'].join(';')).toMatch(/refreshToken=.*HttpOnly/i);
  });

  test('duplicate email -> 409', async () => {
    await createUser({ email: 'dup@test.com' });
    const res = await request(app).post('/api/auth/register').send({ name: 'Dup', email: 'dup@test.com', password: 'secret123' });
    expect(res.status).toBe(409);
  });

  test('login: wrong password 401, right password 200', async () => {
    await createUser({ email: 'log@test.com', password: 'secret123' });
    expect((await request(app).post('/api/auth/login').send({ email: 'log@test.com', password: 'nope123' })).status).toBe(401);
    const ok = await request(app).post('/api/auth/login').send({ email: 'LOG@test.com', password: 'secret123' });
    expect(ok.status).toBe(200);
    expect(ok.body.accessToken).toEqual(expect.any(String));
  });

  test('refresh issues a new access token; logout-all revokes old refresh tokens', async () => {
    const reg = await request(app).post('/api/auth/register').send({ name: 'Ravi', email: 'ravi@test.com', password: 'secret123' });
    const cookie = refreshCookie(reg);

    const r1 = await request(app).post('/api/auth/refresh').set('X-Requested-With', 'XMLHttpRequest').set('Cookie', cookie);
    expect(r1.status).toBe(200);
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${r1.body.accessToken}`);
    expect(me.body.user.email).toBe('ravi@test.com');

    await request(app).post('/api/auth/logout-all').set('Authorization', `Bearer ${r1.body.accessToken}`).expect(200);
    expect((await request(app).post('/api/auth/refresh').set('X-Requested-With', 'XMLHttpRequest').set('Cookie', cookie)).status).toBe(401);
  });

  test('refresh without a cookie -> 401', async () => {
    expect((await request(app).post('/api/auth/refresh').set('X-Requested-With', 'XMLHttpRequest')).status).toBe(401);
  });

  test('blocked users cannot log in or use an existing token', async () => {
    const { user, auth } = await createUser({ email: 'blk@test.com', password: 'secret123' });
    await User.updateOne({ _id: user._id }, { isBlocked: true });
    expect((await request(app).post('/api/auth/login').send({ email: 'blk@test.com', password: 'secret123' })).status).toBe(403);
    expect((await request(app).get('/api/auth/me').set(auth)).status).toBe(403);
  });
});
