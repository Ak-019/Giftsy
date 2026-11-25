// Routes that answer before touching the database (auth checks, validation, 404s), so no MongoDB is needed.
const request = require('supertest');
const app = require('../../app');

test('health', async () => {
  const res = await request(app).get('/api/health');
  expect(res.status).toBe(200);
  expect(res.body.ok).toBe(true);
});

test('unknown route returns JSON 404', async () => {
  const res = await request(app).get('/api/nope');
  expect(res.status).toBe(404);
  expect(res.body).toMatchObject({ success: false });
});

test.each([
  ['get', '/api/auth/me'], ['get', '/api/cart'], ['post', '/api/orders'], ['get', '/api/account/wishlist'],
  ['get', '/api/admin/stats'], ['post', '/api/products'], ['post', '/api/uploads'],
])('%s %s requires login', async (method, url) => {
  const res = await request(app)[method](url);
  expect(res.status).toBe(401);
});

test('bad token is rejected', async () => {
  const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-token');
  expect(res.status).toBe(401);
});

test('register validation errors list every field', async () => {
  const res = await request(app).post('/api/auth/register').send({ name: 'A', email: 'bad', password: '1' });
  expect(res.status).toBe(400);
  expect(res.body.details.map((d) => d.field).sort()).toEqual(['email', 'name', 'password']);
});

test('malformed JSON gives a clear 400', async () => {
  const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":');
  expect(res.status).toBe(400);
  expect(res.body.message).toMatch(/Malformed JSON/);
});

test('invalid ids and query values are rejected', async () => {
  expect((await request(app).get('/api/products/not-an-id')).status).toBe(400);
  expect((await request(app).get('/api/products?sort=bogus')).status).toBe(400);
  expect((await request(app).get('/api/products/gift-finder?recipient=Aliens')).status).toBe(400);
});

test('payments config defaults to the mock provider', async () => {
  const res = await request(app).get('/api/payments/config');
  expect(res.body).toMatchObject({ provider: 'mock', keyId: null });
});

test('webhook with a bad signature is rejected', async () => {
  const res = await request(app).post('/api/payments/webhook')
    .set('Content-Type', 'application/json').set('x-razorpay-signature', 'abc').send('{"event":"payment.captured"}');
  expect(res.status).toBe(400);
});

test('security headers are set', async () => {
  const res = await request(app).get('/api/health');
  expect(res.headers['x-content-type-options']).toBe('nosniff');
  expect(res.headers['x-powered-by']).toBeUndefined();
});

test('refresh and logout require the X-Requested-With header (CSRF protection)', async () => {
  expect((await request(app).post('/api/auth/refresh')).status).toBe(403);
  expect((await request(app).post('/api/auth/logout')).status).toBe(403);
  expect((await request(app).post('/api/auth/logout').set('X-Requested-With', 'XMLHttpRequest')).status).toBe(200);
});

test('tokens signed with another algorithm are rejected', async () => {
  const jwt = require('jsonwebtoken');
  const forged = jwt.sign({ id: 'a'.repeat(24) }, '', { algorithm: 'none' });
  expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${forged}`)).status).toBe(401);
});

test('CORS allows the configured frontend only', async () => {
  const ok = await request(app).options('/api/products').set('Origin', 'http://localhost:5173').set('Access-Control-Request-Method', 'GET');
  expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  const bad = await request(app).options('/api/products').set('Origin', 'https://evil.example').set('Access-Control-Request-Method', 'GET');
  expect(bad.headers['access-control-allow-origin']).toBeUndefined();
});

test('NoSQL operators in the body are stripped', async () => {
  const res = await request(app).post('/api/auth/login').send({ email: { $gt: '' }, password: 'x' });
  expect(res.status).toBe(400);
});
