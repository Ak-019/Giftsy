const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Review = require('../models/Review');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { escapeRegex, paginate, dayKey, DAY_MS, round2 } = require('../utils/helpers');
const { cancelOrder, advanceStatus } = require('../services/orderService');
const { STATUS_TRANSITIONS, LOW_STOCK_THRESHOLD, REPORT_TIMEZONE } = require('../config/constants');

// GET /api/admin/stats?days=30  -> everything the dashboard needs in one call
exports.stats = asyncHandler(async (req, res) => {
  const { days } = req.query;
  const now = new Date();
  const since = new Date(now.getTime() - days * DAY_MS);
  const active = { status: { $ne: 'Cancelled' } };
  const inRange = { createdAt: { $gte: since } };

  const [totalsRow, perDayRows, statusRows, topProducts, lowStock, recentOrders, customers, products] = await Promise.all([
    Order.aggregate([
      { $match: { ...active, ...inRange } },
      { $group: { _id: null, revenue: { $sum: '$total' }, orders: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $match: inRange },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: REPORT_TIMEZONE } },
          orders: { $sum: 1 },
          revenue: { $sum: { $cond: [{ $eq: ['$status', 'Cancelled'] }, 0, '$total'] } },
        },
      },
    ]),
    Order.aggregate([{ $match: inRange }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Order.aggregate([
      { $match: { ...active, ...inRange } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          name: { $first: '$items.name' },
          sold: { $sum: '$items.qty' },
          revenue: { $sum: { $multiply: ['$items.price', '$items.qty'] } },
        },
      },
      { $sort: { sold: -1 } },
      { $limit: 5 },
    ]),
    Product.find({ stock: { $lte: LOW_STOCK_THRESHOLD } }).select('name slug stock images').sort('stock').limit(20),
    Order.find().sort('-createdAt').limit(5).populate('user', 'name email')
      .select('orderNumber user total status paymentStatus createdAt'),
    User.countDocuments({ role: 'user' }),
    Product.countDocuments(),
  ]);

  // One row per day, including days with no orders, so the chart has no gaps
  const byDay = Object.fromEntries(perDayRows.map((r) => [r._id, r]));
  const ordersPerDay = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = dayKey(new Date(now.getTime() - i * DAY_MS), REPORT_TIMEZONE);
    ordersPerDay.push({ date, orders: byDay[date]?.orders || 0, revenue: round2(byDay[date]?.revenue || 0) });
  }

  const revenue = round2(totalsRow[0]?.revenue || 0);
  const orderCount = totalsRow[0]?.orders || 0;
  const statusBreakdown = Object.fromEntries(Object.keys(STATUS_TRANSITIONS).map((s) => [s, 0]));
  statusRows.forEach((r) => { statusBreakdown[r._id] = r.count; });

  res.json({
    success: true,
    days,
    totals: {
      revenue,
      orders: orderCount,
      avgOrderValue: orderCount ? round2(revenue / orderCount) : 0,
      customers,
      products,
      pendingOrders: statusBreakdown.Placed + statusBreakdown.Packed,
    },
    ordersPerDay,
    statusBreakdown,
    topProducts: topProducts.map((p) => ({ productId: p._id, name: p.name, sold: p.sold, revenue: round2(p.revenue) })),
    lowStock,
    lowStockThreshold: LOW_STOCK_THRESHOLD,
    recentOrders,
  });
});

// ---------- orders ----------
// GET /api/admin/orders?status=&paymentStatus=&search=&from=&to=&page=
exports.listOrders = asyncHandler(async (req, res) => {
  const { status, paymentStatus, search, from, to, page, limit } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (paymentStatus) filter.paymentStatus = paymentStatus;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = from;
    if (to) filter.createdAt.$lte = to;
  }
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    const users = await User.find({ $or: [{ email: rx }, { name: rx }] }).select('_id').limit(200);
    filter.$or = [{ orderNumber: rx }, { user: { $in: users.map((u) => u._id) } }];
  }

  const [orders, total] = await Promise.all([
    Order.find(filter).populate('user', 'name email').sort('-createdAt').skip((page - 1) * limit).limit(limit),
    Order.countDocuments(filter),
  ]);
  res.json({ success: true, ...paginate(page, limit, total), orders });
});

// PUT /api/admin/orders/:id/status  { status, note }
exports.updateOrderStatus = asyncHandler(async (req, res) => {
  const { status, note = '' } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError('Order not found', 404);

  const allowed = STATUS_TRANSITIONS[order.status] || [];
  if (!allowed.includes(status)) {
    throw new AppError(`Cannot change status from ${order.status} to ${status}. Allowed: ${allowed.join(', ') || 'none'}`);
  }

  let updated;
  if (status === 'Cancelled') {
    updated = await cancelOrder(order._id, { allowedFrom: [order.status], reason: note || 'Cancelled by admin' });
  } else {
    if (order.paymentMethod === 'ONLINE' && order.paymentStatus !== 'Paid') {
      throw new AppError('This online order has not been paid yet');
    }
    updated = await advanceStatus(order, status, note);
  }
  if (!updated) throw new AppError('The order was changed by someone else. Refresh and try again.', 409);
  res.json({ success: true, order: updated });
});

// ---------- users ----------
// GET /api/admin/users?search=&role=&blocked=&page=
exports.listUsers = asyncHandler(async (req, res) => {
  const { search, role, blocked, page, limit } = req.query;
  const filter = {};
  if (role) filter.role = role;
  if (blocked !== undefined) filter.isBlocked = blocked;
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }

  const [users, total] = await Promise.all([
    User.find(filter).select('name email phone role isBlocked createdAt').sort('-createdAt').skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  // Add order count and total spent per user
  const stats = await Order.aggregate([
    { $match: { user: { $in: users.map((u) => u._id) }, status: { $ne: 'Cancelled' } } },
    { $group: { _id: '$user', orders: { $sum: 1 }, spent: { $sum: '$total' } } },
  ]);
  const byUser = Object.fromEntries(stats.map((s) => [s._id.toString(), s]));
  const rows = users.map((u) => ({ ...u, orders: byUser[u._id]?.orders || 0, spent: round2(byUser[u._id]?.spent || 0) }));

  res.json({ success: true, ...paginate(page, limit, total), users: rows });
});

// PUT /api/admin/users/:id/block  { isBlocked: true|false }
exports.setBlocked = asyncHandler(async (req, res) => {
  if (req.params.id === req.user._id.toString()) throw new AppError('You cannot block yourself');
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found', 404);
  if (user.role === 'admin') throw new AppError('Admins cannot be blocked');

  user.isBlocked = req.body.isBlocked;
  if (user.isBlocked) user.tokenVersion += 1; // end their sessions right away
  await user.save();
  res.json({ success: true, user });
});

// ---------- reviews (moderation) ----------
// GET /api/admin/reviews?product=&rating=&page=   (delete with DELETE /api/reviews/:id)
exports.listReviews = asyncHandler(async (req, res) => {
  const { product, rating, page, limit } = req.query;
  const filter = {};
  if (product) filter.product = product;
  if (rating) filter.rating = rating;

  const [reviews, total] = await Promise.all([
    Review.find(filter).populate('user', 'name email').populate('product', 'name slug')
      .sort('-createdAt').skip((page - 1) * limit).limit(limit),
    Review.countDocuments(filter),
  ]);
  res.json({ success: true, ...paginate(page, limit, total), reviews });
});
