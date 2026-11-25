const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { recalcRating } = require('../utils/ratings');
const { paginate } = require('../utils/helpers');

const SORTS = { newest: { createdAt: -1 }, highest: { rating: -1, createdAt: -1 }, lowest: { rating: 1, createdAt: -1 } };

// GET /api/products/:id/reviews?sort=newest&page=1
exports.listForProduct = asyncHandler(async (req, res) => {
  const { sort, page, limit } = req.query;
  const filter = { product: req.params.id };
  const [reviews, total] = await Promise.all([
    Review.find(filter).populate('user', 'name').sort(SORTS[sort]).skip((page - 1) * limit).limit(limit),
    Review.countDocuments(filter),
  ]);
  res.json({ success: true, ...paginate(page, limit, total), reviews });
});

// POST /api/products/:id/reviews  (only customers who ordered the product)
exports.addReview = asyncHandler(async (req, res) => {
  const productId = req.params.id;
  if (!(await Product.exists({ _id: productId }))) throw new AppError('Product not found', 404);

  const bought = await Order.exists({ user: req.user._id, 'items.product': productId, status: { $ne: 'Cancelled' } });
  if (!bought) throw new AppError('Only customers who bought this product can review it', 403);
  if (await Review.exists({ user: req.user._id, product: productId })) {
    throw new AppError('You have already reviewed this product. Edit your review instead.', 409);
  }

  const review = await Review.create({ user: req.user._id, product: productId, ...req.body });
  await recalcRating(productId);
  res.status(201).json({ success: true, review });
});

// PUT /api/reviews/:id  (own review only)
exports.updateReview = asyncHandler(async (req, res) => {
  const review = await Review.findOne({ _id: req.params.id, user: req.user._id });
  if (!review) throw new AppError('Review not found', 404);
  review.set(req.body);
  await review.save();
  await recalcRating(review.product);
  res.json({ success: true, review });
});

// DELETE /api/reviews/:id  (own review, or any review for admins = moderation)
exports.deleteReview = asyncHandler(async (req, res) => {
  const filter = { _id: req.params.id };
  if (req.user.role !== 'admin') filter.user = req.user._id;
  const review = await Review.findOneAndDelete(filter);
  if (!review) throw new AppError('Review not found', 404);
  await recalcRating(review.product);
  res.json({ success: true, message: 'Review deleted' });
});
