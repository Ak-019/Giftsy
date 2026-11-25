const Product = require('../models/Product');
const Review = require('../models/Review');
const Order = require('../models/Order');
const User = require('../models/User');
const Cart = require('../models/Cart');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { escapeRegex, paginate } = require('../utils/helpers');
const { OCCASIONS, RECIPIENTS } = require('../config/constants');

// _id is a tie-breaker so pagination is stable when many products share a price or rating
const SORTS = {
  newest: { createdAt: -1, _id: -1 },
  priceAsc: { finalPrice: 1, _id: 1 },
  priceDesc: { finalPrice: -1, _id: -1 },
  rating: { ratingAvg: -1, ratingCount: -1, _id: -1 },
  popular: { soldCount: -1, _id: -1 },
  stock: { stock: 1, _id: 1 }, // admin: lowest stock first
};
const CARD_FIELDS = 'name slug price discountPrice finalPrice images stock ratingAvg ratingCount isFeatured category';

// GET /api/products?search=&category=a,b&occasion=&recipient=&minPrice=&maxPrice=&minRating=&inStock=&featured=&sort=&page=&limit=
exports.getProducts = asyncHandler(async (req, res) => {
  const q = req.query; // already validated and type-converted by Zod
  const filter = {};
  if (q.search) filter.$text = { $search: q.search };
  if (q.category?.length) filter.category = { $in: q.category };
  if (q.occasion?.length) filter.occasions = { $in: q.occasion };
  if (q.recipient?.length) filter.recipients = { $in: q.recipient };
  if (q.minPrice != null || q.maxPrice != null) {
    filter.finalPrice = {};
    if (q.minPrice != null) filter.finalPrice.$gte = q.minPrice;
    if (q.maxPrice != null) filter.finalPrice.$lte = q.maxPrice;
  }
  if (q.minRating != null) filter.ratingAvg = { $gte: q.minRating };
  if (q.inStock) filter.stock = { $gt: 0 };
  if (q.featured) filter.isFeatured = true;

  const sortKey = q.sort || (q.search ? 'relevance' : 'newest');
  const byRelevance = sortKey === 'relevance' && q.search;
  const projection = byRelevance ? { score: { $meta: 'textScore' } } : {};
  const sort = byRelevance ? { score: { $meta: 'textScore' }, _id: -1 } : SORTS[sortKey] || SORTS.newest;

  const [products, total] = await Promise.all([
    Product.find(filter, projection).sort(sort).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
    Product.countDocuments(filter),
  ]);
  res.json({ success: true, ...paginate(q.page, q.limit, total), products });
});

// GET /api/products/meta  -> values for the filter sidebar
exports.getMeta = asyncHandler(async (req, res) => {
  const [categories, occasions, recipients, [range]] = await Promise.all([
    Product.distinct('category'),
    Product.distinct('occasions'),
    Product.distinct('recipients'),
    Product.aggregate([{ $group: { _id: null, min: { $min: '$finalPrice' }, max: { $max: '$finalPrice' } } }]),
  ]);
  res.json({
    success: true,
    categories: categories.sort(),
    occasions: OCCASIONS.filter((o) => occasions.includes(o)),
    recipients: RECIPIENTS.filter((r) => recipients.includes(r)),
    priceRange: { min: range?.min || 0, max: range?.max || 0 },
  });
});

// GET /api/products/suggest?q=mu  -> search-box dropdown (matches the start of any word in the name)
exports.suggest = asyncHandler(async (req, res) => {
  const rx = new RegExp(`(^|\\s)${escapeRegex(req.query.q)}`, 'i');
  const products = await Product.find({ name: rx }).select('name slug images finalPrice').sort({ soldCount: -1 }).limit(6);
  res.json({ success: true, products });
});

// GET /api/products/gift-finder?recipient=For Her&occasion=Birthday&budgetMax=1000&interests=Food,Home Decor
// Scores every in-budget product: recipient match +3, occasion +3, interest +2, then rating and popularity break ties.
exports.giftFinder = asyncHandler(async (req, res) => {
  const { recipient, occasion, budgetMin, budgetMax, interests = [], limit } = req.query;
  const filter = { stock: { $gt: 0 }, finalPrice: { $gte: budgetMin } };
  if (budgetMax != null) filter.finalPrice.$lte = budgetMax;

  const candidates = await Product.find(filter).select(`${CARD_FIELDS} occasions recipients soldCount`).limit(500).lean();
  const wanted = (recipient ? 3 : 0) + (occasion ? 3 : 0) + (interests.length ? 2 : 0);

  const scored = candidates.map((p) => {
    let points = 0;
    const matchReasons = [];
    if (recipient && p.recipients?.includes(recipient)) { points += 3; matchReasons.push(recipient); }
    if (occasion && p.occasions?.includes(occasion)) { points += 3; matchReasons.push(`Great for ${occasion}`); }
    if (interests.length && interests.includes(p.category)) { points += 2; matchReasons.push(p.category); }
    const bonus = (p.ratingAvg || 0) / 5 + (p.isFeatured ? 0.5 : 0) + Math.min(p.soldCount || 0, 50) / 100;
    return { ...p, points, bonus, perfectMatch: points === wanted, matchReasons };
  });

  scored.sort((a, b) => b.points - a.points || b.bonus - a.bonus);
  const products = scored.slice(0, limit).map(({ points, bonus, soldCount, ...p }) => p);
  res.json({
    success: true,
    perfectMatches: scored.filter((s) => s.perfectMatch).length,
    // true when nothing matched every answer, so we are showing the closest options
    relaxed: wanted > 0 && !scored.some((s) => s.perfectMatch),
    products,
  });
});

async function productDetail(product, user) {
  const [reviews, related, breakdownRows] = await Promise.all([
    Review.find({ product: product._id }).populate('user', 'name').sort('-createdAt').limit(10),
    Product.find({
      _id: { $ne: product._id },
      stock: { $gt: 0 },
      $or: [{ category: product.category }, { occasions: { $in: product.occasions } }],
    }).sort({ ratingAvg: -1, soldCount: -1 }).limit(4).select(CARD_FIELDS),
    Review.aggregate([{ $match: { product: product._id } }, { $group: { _id: '$rating', count: { $sum: 1 } } }]),
  ]);

  const ratingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  breakdownRows.forEach((r) => { ratingBreakdown[r._id] = r.count; });

  const viewer = { canReview: false, userReview: null, inWishlist: false };
  if (user) {
    const [mine, bought] = await Promise.all([
      Review.findOne({ product: product._id, user: user._id }),
      Order.exists({ user: user._id, 'items.product': product._id, status: { $ne: 'Cancelled' } }),
    ]);
    viewer.userReview = mine;
    viewer.canReview = !mine && Boolean(bought);
    viewer.inWishlist = user.wishlist.some((id) => id.equals(product._id));
  }
  return { success: true, product, reviews, ratingBreakdown, related, ...viewer };
}

// GET /api/products/slug/:slug  (used by the product page)
exports.getProductBySlug = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug.toLowerCase() });
  if (!product) throw new AppError('Product not found', 404);
  res.json(await productDetail(product, req.user));
});

// GET /api/products/:id
exports.getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new AppError('Product not found', 404);
  res.json(await productDetail(product, req.user));
});

// ---------- admin ----------
exports.createProduct = asyncHandler(async (req, res) => {
  const product = await Product.create(req.body); // req.body only holds whitelisted fields
  res.status(201).json({ success: true, product });
});

exports.updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new AppError('Product not found', 404);
  product.set(req.body);
  await product.save(); // save() (not findByIdAndUpdate) so slug and finalPrice hooks run
  res.json({ success: true, product });
});

exports.deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) throw new AppError('Product not found', 404);
  // Clean up references. Past orders keep their snapshot, so they are not touched.
  await Promise.all([
    Review.deleteMany({ product: product._id }),
    User.updateMany({ wishlist: product._id }, { $pull: { wishlist: product._id } }),
    Cart.updateMany({}, { $pull: { items: { product: product._id }, savedForLater: { product: product._id } } }),
  ]);
  res.json({ success: true, message: 'Product deleted' });
});

// PATCH /api/admin/products/stock  { items: [{ id, stock }] }
exports.bulkUpdateStock = asyncHandler(async (req, res) => {
  const result = await Product.bulkWrite(req.body.items.map((i) => ({
    updateOne: { filter: { _id: i.id }, update: { $set: { stock: i.stock } } },
  })));
  res.json({ success: true, matched: result.matchedCount, modified: result.modifiedCount });
});
