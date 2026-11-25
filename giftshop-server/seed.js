// Resets the database and fills it with demo data: products, users, coupons, orders over the last 30 days and reviews.
// Run with: npm run seed
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Product = require('./models/Product');
const Order = require('./models/Order');
const Cart = require('./models/Cart');
const Review = require('./models/Review');
const Coupon = require('./models/Coupon');
const productData = require('./data/products');
const { unitPrice, computeTotals } = require('./utils/pricing');
const { recalcRating } = require('./utils/ratings');
const { DAY_MS } = require('./utils/helpers');

// Small deterministic random generator, so every seed run produces the same demo data
let state = 42;
const rand = () => { state = (state * 1664525 + 1013904223) % 4294967296; return state / 4294967296; };
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

const daysFromNow = (n) => new Date(Date.now() + n * DAY_MS);
// Date for an occasion that is `n` days away, set in an earlier year (it repeats every year)
const occasionIn = (n, yearsAgo) => { const d = daysFromNow(n); d.setUTCFullYear(d.getUTCFullYear() - yearsAgo); return d; };

const address = {
  label: 'Home', fullName: 'Demo User', phone: '9876543210', line1: '12, MG Road', line2: 'Near City Mall',
  city: 'Bengaluru', state: 'Karnataka', pincode: '560001', isDefault: true,
};

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Clearing old data...');
  await Promise.all([User, Product, Order, Cart, Review, Coupon].map((M) => M.deleteMany({})));
  await Promise.all([User, Product, Order, Cart, Review, Coupon].map((M) => M.syncIndexes()));

  // ---------- products ----------
  const products = await Product.create(productData); // create() runs hooks, so slugs and finalPrice are set

  // ---------- users ----------
  const admin = await User.create({ name: 'Admin', email: 'admin@giftshop.com', password: 'admin123', role: 'admin' });
  const demo = await User.create({
    name: 'Demo User',
    email: 'user@giftshop.com',
    password: 'user123',
    phone: '9876543210',
    addresses: [address, {
      label: "Mom's place", fullName: 'Lakshmi Rao', phone: '9123456780', line1: '45, 3rd Cross, Jayanagar',
      city: 'Bengaluru', state: 'Karnataka', pincode: '560011', isDefault: false,
    }],
    occasions: [
      { title: "Mom's Birthday", type: 'Birthday', personName: 'Mom', date: occasionIn(6, 55) },
      { title: 'Wedding Anniversary', type: 'Anniversary', personName: 'Partner', date: occasionIn(19, 3) },
      { title: "Rahul's Birthday", type: 'Birthday', personName: 'Rahul', date: occasionIn(80, 28) },
    ],
    wishlist: [products[3]._id, products[8]._id, products[13]._id],
  });
  const shoppers = await User.create([
    { name: 'Priya Sharma', email: 'priya@example.com', password: 'priya123', addresses: [{ ...address, fullName: 'Priya Sharma' }] },
    { name: 'Arjun Mehta', email: 'arjun@example.com', password: 'arjun123', addresses: [{ ...address, fullName: 'Arjun Mehta', city: 'Mumbai', state: 'Maharashtra', pincode: '400001' }] },
    { name: 'Sneha Iyer', email: 'sneha@example.com', password: 'sneha123', addresses: [{ ...address, fullName: 'Sneha Iyer', city: 'Chennai', state: 'Tamil Nadu', pincode: '600001' }] },
  ]);
  const customers = [demo, ...shoppers];

  // ---------- coupons ----------
  await Coupon.create([
    { code: 'WELCOME10', description: '10% off your order (up to ₹200)', type: 'percent', value: 10, maxDiscount: 200, expiresAt: daysFromNow(90) },
    { code: 'FLAT150', description: '₹150 off orders above ₹999', type: 'flat', value: 150, minOrder: 999, expiresAt: daysFromNow(60), onePerUser: false },
    { code: 'FESTIVE20', description: '20% off orders above ₹1499 (up to ₹500)', type: 'percent', value: 20, minOrder: 1499, maxDiscount: 500, usageLimit: 100, expiresAt: daysFromNow(30) },
    { code: 'OLD5', description: 'Expired coupon, for testing', type: 'percent', value: 5, expiresAt: daysFromNow(-5) },
  ]);

  // ---------- orders spread over the last 30 days (fills the admin charts) ----------
  const orderDocs = [];
  for (let i = 0; i < 40; i++) {
    const customer = i < 6 ? demo : pick(customers);
    const ageDays = Math.floor(rand() * 30);
    const lines = [];
    const count = 1 + Math.floor(rand() * 3);
    for (let j = 0; j < count; j++) {
      const p = pick(products);
      if (lines.some((l) => l.product.equals(p._id))) continue;
      const variant = p.variants.length ? p.variants[0].name : '';
      lines.push({ product: p._id, name: p.name, image: p.images[0], variant, price: unitPrice(p, variant), qty: 1 + Math.floor(rand() * 2) });
    }
    const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
    const giftWrap = rand() < 0.4;
    const totals = computeTotals({ subtotal, giftWrap });

    // Older orders are further along. The demo user's first orders are Delivered so they can write reviews.
    let status;
    if (customer === demo && i < 4) status = 'Delivered';
    else if (ageDays > 10) status = rand() < 0.1 ? 'Cancelled' : 'Delivered';
    else if (ageDays > 5) status = pick(['Shipped', 'Delivered']);
    else status = pick(['Placed', 'Packed', 'Shipped']);
    const flow = ['Placed', 'Packed', 'Shipped', 'Delivered'];
    const created = new Date(Date.now() - ageDays * DAY_MS - Math.floor(rand() * 8) * 3600000);
    const history = status === 'Cancelled'
      ? [{ status: 'Placed', at: created }, { status: 'Cancelled', at: new Date(created.getTime() + 3600000) }]
      : flow.slice(0, flow.indexOf(status) + 1).map((s, k) => ({ status: s, at: new Date(created.getTime() + k * DAY_MS) }));
    const online = rand() < 0.5;

    orderDocs.push({
      doc: {
        user: customer._id,
        items: lines,
        shippingAddress: (({ label, isDefault, ...a }) => a)(customer.addresses[0]?.toObject?.() || address),
        giftWrap,
        giftMessage: giftWrap ? pick(['Happy Birthday!', 'Congratulations to you both!', 'With love', 'Thank you for everything']) : '',
        paymentMethod: online ? 'ONLINE' : 'COD',
        paymentStatus: status === 'Cancelled' ? (online ? 'Refund Pending' : 'Pending') : (online || status === 'Delivered' ? 'Paid' : 'Pending'),
        paymentId: online ? `mock_seed_${i}` : undefined,
        ...totals,
        status,
        statusHistory: history,
        deliveredAt: status === 'Delivered' ? history[history.length - 1].at : undefined,
        cancelledAt: status === 'Cancelled' ? history[1].at : undefined,
      },
      created,
    });
  }
  const orders = await Order.create(orderDocs.map((o) => o.doc));
  // Back-date createdAt (Mongoose timestamps would otherwise set "now")
  await Order.collection.bulkWrite(orders.map((o, i) => ({
    updateOne: { filter: { _id: o._id }, update: { $set: { createdAt: orderDocs[i].created, updatedAt: orderDocs[i].created } } },
  })));

  // soldCount from the orders, so "popular" sorting works
  const sold = {};
  orders.filter((o) => o.status !== 'Cancelled').forEach((o) => o.items.forEach((it) => {
    sold[it.product] = (sold[it.product] || 0) + it.qty;
  }));
  await Product.bulkWrite(Object.entries(sold).map(([id, qty]) => ({ updateOne: { filter: { _id: id }, update: { $set: { soldCount: qty } } } })));

  // ---------- reviews from customers who bought (other shoppers only, so the demo user can still write some) ----------
  const comments = {
    5: ['Absolutely loved it!', 'Perfect gift, arrived on time.', 'Beautiful packaging and great quality.'],
    4: ['Very nice, would buy again.', 'Good quality for the price.'],
    3: ['Decent, but delivery took a while.', 'It is okay.'],
  };
  const reviewed = new Set();
  const reviews = [];
  orders.filter((o) => o.status === 'Delivered' && !o.user.equals(demo._id)).forEach((o) => o.items.forEach((it) => {
    const key = `${o.user}-${it.product}`;
    if (reviewed.has(key)) return;
    reviewed.add(key);
    const rating = pick([5, 5, 4, 4, 3]);
    reviews.push({ user: o.user, product: it.product, rating, comment: pick(comments[rating]) });
  }));
  await Review.insertMany(reviews);
  await Promise.all(products.map((p) => recalcRating(p._id)));

  console.log(`Seeded ${products.length} products, ${customers.length + 1} users, 4 coupons, ${orders.length} orders, ${reviews.length} reviews.`);
  console.log('Logins: admin@giftshop.com / admin123   user@giftshop.com / user123');
  console.log('Coupons: WELCOME10, FLAT150, FESTIVE20 (OLD5 is expired)');
  console.log(`Admin id: ${admin._id}`);
}

seed()
  .then(() => mongoose.disconnect())
  .catch(async (err) => {
    console.error('Seeding failed:', err);
    await mongoose.disconnect();
    process.exit(1);
  });
