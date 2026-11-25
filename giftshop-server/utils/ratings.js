const mongoose = require('mongoose');
const Review = require('../models/Review');
const Product = require('../models/Product');

// Recalculates a product's average rating after a review is added, edited or deleted
async function recalcRating(productId) {
  const id = new mongoose.Types.ObjectId(String(productId));
  const [stats] = await Review.aggregate([
    { $match: { product: id } },
    { $group: { _id: '$product', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  await Product.updateOne(
    { _id: id },
    { ratingAvg: stats ? Math.round(stats.avg * 10) / 10 : 0, ratingCount: stats ? stats.count : 0 }
  );
}

module.exports = { recalcRating };
