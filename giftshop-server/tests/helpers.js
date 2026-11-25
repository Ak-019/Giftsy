const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const Product = require('../models/Product');
const { signAccess } = require('../utils/tokens');
const { DAY_MS } = require('../utils/helpers');

let n = 0;

async function createUser(overrides = {}) {
  n += 1;
  const user = await User.create({ name: `User ${n}`, email: `user${n}@test.com`, password: 'secret123', ...overrides });
  const token = signAccess(user);
  return { user, token, auth: { Authorization: `Bearer ${token}` } };
}
const createAdmin = (overrides = {}) => createUser({ role: 'admin', ...overrides });

function createProduct(overrides = {}) {
  n += 1;
  return Product.create({
    name: `Gift ${n}`, description: 'A lovely gift for testing', price: 500, category: 'Mugs',
    occasions: ['Birthday'], recipients: ['For Her'], stock: 10, ...overrides,
  });
}

const validAddress = {
  fullName: 'Test User', phone: '9876543210', line1: '1 Test Street', city: 'Bengaluru', state: 'Karnataka', pincode: '560001',
};

const addToCart = (auth, productId, qty = 1, variant) =>
  request(app).post('/api/cart').set(auth).send({ productId: String(productId), qty, ...(variant ? { variant } : {}) });

const placeOrder = (auth, body = {}) =>
  request(app).post('/api/orders').set(auth).send({ shippingAddress: validAddress, ...body });

// Collects a binary response (e.g. a PDF) into a Buffer
const binaryParser = (res, cb) => {
  const chunks = [];
  res.on('data', (c) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
};

// A date `days` from now, moved back `yearsAgo` years (for recurring occasions)
const dateIn = (days, yearsAgo = 0) => {
  const d = new Date(Date.now() + days * DAY_MS);
  d.setUTCFullYear(d.getUTCFullYear() - yearsAgo);
  return d.toISOString();
};

module.exports = { app, request, createUser, createAdmin, createProduct, validAddress, addToCart, placeOrder, binaryParser, dateIn };
