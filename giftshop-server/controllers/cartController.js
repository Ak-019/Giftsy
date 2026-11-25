const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { round2 } = require('../utils/helpers');
const { unitPrice, couponProblem, couponDiscount, computeTotals, deliveryWindow } = require('../utils/pricing');
const { GIFT_WRAP_FEE, FREE_SHIPPING_ABOVE, MAX_QTY_PER_ITEM } = require('../config/constants');

const PRODUCT_FIELDS = 'name slug price discountPrice finalPrice images stock variants';

// Upsert avoids a duplicate-key error when two requests create the cart at the same time
const loadCart = (userId) => Cart.findOneAndUpdate(
  { user: userId }, { $setOnInsert: { couponCode: null } }, { upsert: true, new: true }
);

const sameLine = (a, productId, variant) => a.product.toString() === productId.toString() && (a.variant || '') === (variant || '');

function checkVariant(product, variant) {
  if (product.variants.length && !variant) {
    throw new AppError(`Please choose an option: ${product.variants.map((v) => v.name).join(', ')}`);
  }
  if (variant && !product.variants.some((v) => v.name === variant)) throw new AppError('That option is not available');
}

function checkQty(product, qty) {
  if (qty > MAX_QTY_PER_ITEM) throw new AppError(`You can buy at most ${MAX_QTY_PER_ITEM} of one item`);
  if (qty > product.stock) {
    throw new AppError(product.stock === 0 ? `"${product.name}" is out of stock` : `Only ${product.stock} of "${product.name}" left in stock`);
  }
}

const productSummary = (p) => ({
  _id: p._id, name: p.name, slug: p.slug, image: p.images?.[0], price: p.price, finalPrice: p.finalPrice, stock: p.stock,
});

// Builds the cart response with live prices, coupon and totals
async function cartView(cart, userId) {
  await cart.populate([
    { path: 'items.product', select: PRODUCT_FIELDS },
    { path: 'savedForLater.product', select: PRODUCT_FIELDS },
  ]);

  const items = cart.items.filter((i) => i.product).map((i) => {
    const price = unitPrice(i.product, i.variant);
    return {
      _id: i._id, product: productSummary(i.product), variant: i.variant, qty: i.qty,
      unitPrice: price, lineTotal: round2(price * i.qty), inStock: i.product.stock >= i.qty,
    };
  });
  const savedForLater = cart.savedForLater.filter((i) => i.product).map((i) => ({
    _id: i._id, product: productSummary(i.product), variant: i.variant, qty: i.qty, unitPrice: unitPrice(i.product, i.variant),
  }));

  const subtotal = round2(items.reduce((s, i) => s + i.lineTotal, 0));
  let coupon = null;
  let couponError = null;
  let discount = 0;
  if (cart.couponCode) {
    const c = await Coupon.findOne({ code: cart.couponCode });
    couponError = couponProblem(c, subtotal, userId);
    if (!couponError) {
      discount = couponDiscount(c, subtotal);
      coupon = { code: c.code, type: c.type, value: c.value, description: c.description };
    }
  }

  const totals = computeTotals({ subtotal, discount });
  return {
    success: true,
    items,
    savedForLater,
    itemCount: items.reduce((s, i) => s + i.qty, 0),
    coupon,
    couponError, // e.g. a coupon that stopped applying after items were removed
    ...totals,
    giftWrapPrice: GIFT_WRAP_FEE,
    freeShippingAbove: FREE_SHIPPING_ABOVE,
    amountForFreeShipping: Math.max(round2(FREE_SHIPPING_ABOVE - (subtotal - discount)), 0),
    delivery: deliveryWindow(),
  };
}

const findItem = (list, itemId) => {
  const item = list.id(itemId);
  if (!item) throw new AppError('Item not found', 404);
  return item;
};

// GET /api/cart
exports.getCart = asyncHandler(async (req, res) => {
  res.json(await cartView(await loadCart(req.user._id), req.user._id));
});

// POST /api/cart  { productId, qty, variant }
exports.addItem = asyncHandler(async (req, res) => {
  const { productId, qty, variant } = req.body;
  const product = await Product.findById(productId);
  if (!product) throw new AppError('Product not found', 404);
  checkVariant(product, variant);

  const cart = await loadCart(req.user._id);
  const existing = cart.items.find((i) => sameLine(i, productId, variant));
  const newQty = (existing ? existing.qty : 0) + qty;
  checkQty(product, newQty);

  if (existing) existing.qty = newQty;
  else cart.items.push({ product: productId, qty, variant });
  await cart.save();
  res.status(201).json(await cartView(cart, req.user._id));
});

// PUT /api/cart/items/:itemId  { qty }
exports.updateItem = asyncHandler(async (req, res) => {
  const cart = await loadCart(req.user._id);
  const item = findItem(cart.items, req.params.itemId);
  const product = await Product.findById(item.product);
  if (!product) {
    cart.items.pull(item._id);
    await cart.save();
    throw new AppError('This product is no longer available and was removed from your cart', 404);
  }
  checkQty(product, req.body.qty);
  item.qty = req.body.qty;
  await cart.save();
  res.json(await cartView(cart, req.user._id));
});

// DELETE /api/cart/items/:itemId
exports.removeItem = asyncHandler(async (req, res) => {
  const cart = await loadCart(req.user._id);
  findItem(cart.items, req.params.itemId);
  cart.items.pull(req.params.itemId);
  await cart.save();
  res.json(await cartView(cart, req.user._id));
});

// POST /api/cart/items/:itemId/save-for-later
exports.saveForLater = asyncHandler(async (req, res) => {
  const cart = await loadCart(req.user._id);
  const item = findItem(cart.items, req.params.itemId);
  if (!cart.savedForLater.some((s) => sameLine(s, item.product, item.variant))) {
    cart.savedForLater.push({ product: item.product, qty: item.qty, variant: item.variant });
  }
  cart.items.pull(item._id);
  await cart.save();
  res.json(await cartView(cart, req.user._id));
});

// POST /api/cart/saved/:itemId/move-to-cart
exports.moveToCart = asyncHandler(async (req, res) => {
  const cart = await loadCart(req.user._id);
  const saved = findItem(cart.savedForLater, req.params.itemId);
  const product = await Product.findById(saved.product);
  if (!product) {
    cart.savedForLater.pull(saved._id);
    await cart.save();
    throw new AppError('This product is no longer available', 404);
  }
  checkVariant(product, saved.variant);

  const existing = cart.items.find((i) => sameLine(i, saved.product, saved.variant));
  const newQty = (existing ? existing.qty : 0) + saved.qty;
  checkQty(product, newQty);

  if (existing) existing.qty = newQty;
  else cart.items.push({ product: saved.product, qty: saved.qty, variant: saved.variant });
  cart.savedForLater.pull(saved._id);
  await cart.save();
  res.json(await cartView(cart, req.user._id));
});

// DELETE /api/cart/saved/:itemId
exports.removeSaved = asyncHandler(async (req, res) => {
  const cart = await loadCart(req.user._id);
  findItem(cart.savedForLater, req.params.itemId);
  cart.savedForLater.pull(req.params.itemId);
  await cart.save();
  res.json(await cartView(cart, req.user._id));
});

// POST /api/cart/coupon  { code }
exports.applyCoupon = asyncHandler(async (req, res) => {
  const cart = await loadCart(req.user._id);
  const view = await cartView(cart, req.user._id);
  if (!view.items.length) throw new AppError('Add items to your cart before applying a coupon');

  const coupon = await Coupon.findOne({ code: req.body.code });
  const problem = couponProblem(coupon, view.subtotal, req.user._id);
  if (problem) throw new AppError(problem);

  cart.couponCode = coupon.code;
  await cart.save();
  res.json(await cartView(cart, req.user._id));
});

// DELETE /api/cart/coupon
exports.removeCoupon = asyncHandler(async (req, res) => {
  const cart = await loadCart(req.user._id);
  cart.couponCode = null;
  await cart.save();
  res.json(await cartView(cart, req.user._id));
});

// DELETE /api/cart
exports.clearCart = asyncHandler(async (req, res) => {
  const cart = await loadCart(req.user._id);
  cart.items = [];
  cart.couponCode = null;
  await cart.save();
  res.json(await cartView(cart, req.user._id));
});

module.exports.cartView = cartView;
