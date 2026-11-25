const mongoose = require('mongoose');
const { uniqueSlug } = require('../utils/slugify');
const AppError = require('../utils/AppError');
const { OCCASIONS, RECIPIENTS } = require('../config/constants');

// Stock is tracked per product; a variant only changes the price (e.g. Large = +100)
const variantSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  priceDelta: { type: Number, default: 0 },
}, { _id: false });

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  slug: { type: String, unique: true },
  description: { type: String, required: true, maxlength: 2000 },
  price: { type: Number, required: true, min: 0 },
  discountPrice: { type: Number, min: 0, default: null },
  // What the customer actually pays (discountPrice or price). Stored so filters and sorting can use it.
  finalPrice: { type: Number, min: 0 },
  category: { type: String, required: true, trim: true },
  occasions: [{ type: String, enum: OCCASIONS }],
  recipients: [{ type: String, enum: RECIPIENTS }],
  images: [String],
  stock: { type: Number, required: true, min: 0, default: 0 },
  variants: [variantSchema],
  ratingAvg: { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 },
  soldCount: { type: Number, default: 0 }, // powers "trending" / "popular" sort
  isFeatured: { type: Boolean, default: false },
}, { timestamps: true });

productSchema.index({ name: 'text', description: 'text', category: 'text' }, { weights: { name: 5, category: 2, description: 1 } });
productSchema.index({ category: 1, finalPrice: 1 });
productSchema.index({ occasions: 1 });
productSchema.index({ recipients: 1 });

productSchema.pre('validate', async function syncDerivedFields() {
  if (this.discountPrice != null && this.discountPrice >= this.price) {
    throw new AppError('Discount price must be lower than the price', 400);
  }
  this.finalPrice = this.discountPrice != null ? this.discountPrice : this.price;
  if (!this.slug || this.isModified('name')) {
    this.slug = await uniqueSlug(this.constructor, this.name, this._id);
  }
});

module.exports = mongoose.model('Product', productSchema);
