const Cart = require('../models/Cart');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const streamInvoice = require('../utils/invoice');
const { orderPlacedEmail } = require('../utils/email');
const { startPayment } = require('../utils/payments');
const { paginate, addDays, startOfDayUTC } = require('../utils/helpers');
const { unitPrice, couponProblem, couponDiscount, computeTotals, deliveryWindow } = require('../utils/pricing');
const { restoreStock, releaseCoupon, cancelOrder } = require('../services/orderService');
const { DELIVERY_DATE_MAX_DAYS } = require('../config/constants');

const pickAddress = (a) => ({
  fullName: a.fullName, phone: a.phone, line1: a.line1, line2: a.line2 || '', city: a.city, state: a.state, pincode: a.pincode,
});

function checkDeliveryDate(date) {
  if (!date) return undefined;
  const { earliest } = deliveryWindow();
  const day = startOfDayUTC(date);
  if (day < earliest) throw new AppError(`Earliest delivery date is ${earliest.toISOString().slice(0, 10)}`);
  if (day > addDays(startOfDayUTC(), DELIVERY_DATE_MAX_DAYS)) {
    throw new AppError(`Delivery date can be at most ${DELIVERY_DATE_MAX_DAYS} days from today`);
  }
  return day;
}

// POST /api/orders
// Items and prices come from the server-side cart and the database, never from the client.
exports.createOrder = asyncHandler(async (req, res) => {
  const { addressId, giftMessage, giftWrap, paymentMethod, shipToSomeoneElse } = req.body;
  const userId = req.user._id;

  let shippingAddress = req.body.shippingAddress;
  if (addressId) {
    const saved = req.user.addresses.id(addressId);
    if (!saved) throw new AppError('Saved address not found', 404);
    shippingAddress = pickAddress(saved);
  }
  const deliveryDate = checkDeliveryDate(req.body.deliveryDate);

  const cart = await Cart.findOne({ user: userId }).populate('items.product');
  const cartItems = (cart?.items || []).filter((i) => i.product);
  if (!cartItems.length) throw new AppError('Your cart is empty');

  const lines = cartItems.map((i) => {
    if (i.variant && !i.product.variants.some((v) => v.name === i.variant)) {
      throw new AppError(`The option "${i.variant}" for "${i.product.name}" is no longer available`);
    }
    return {
      product: i.product._id, name: i.product.name, image: i.product.images?.[0], variant: i.variant || '',
      price: unitPrice(i.product, i.variant), qty: i.qty,
    };
  });
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);

  let coupon = null;
  let discount = 0;
  if (cart.couponCode) {
    coupon = await Coupon.findOne({ code: cart.couponCode });
    const problem = couponProblem(coupon, subtotal, userId);
    if (problem) throw new AppError(`${problem}. Remove the coupon and try again.`);
    discount = couponDiscount(coupon, subtotal);
  }
  const totals = computeTotals({ subtotal, discount, giftWrap });

  const deducted = [];
  let couponClaimed = false;
  let order;
  try {
    // Atomic stock deduction: the "stock >= qty" check and the decrement are ONE database operation,
    // so two buyers can never both purchase the last unit.
    for (const line of lines) {
      // eslint-disable-next-line no-await-in-loop
      const updated = await Product.findOneAndUpdate(
        { _id: line.product, stock: { $gte: line.qty } },
        { $inc: { stock: -line.qty, soldCount: line.qty } }
      );
      if (!updated) throw new AppError(`"${line.name}" does not have enough stock`);
      deducted.push({ product: line.product, qty: line.qty });
    }

    // Same idea for the coupon: claim one use only if it is still under the limit and unused by this user
    if (coupon) {
      const claimFilter = {
        _id: coupon._id,
        isActive: true,
        expiresAt: { $gt: new Date() },
        $or: [{ usageLimit: null }, { $expr: { $lt: ['$usedCount', '$usageLimit'] } }],
      };
      if (coupon.onePerUser) claimFilter.usedBy = { $ne: userId };
      const claimed = await Coupon.findOneAndUpdate(claimFilter, { $inc: { usedCount: 1 }, $addToSet: { usedBy: userId } });
      if (!claimed) throw new AppError('This coupon is no longer available. Remove it and try again.');
      couponClaimed = true;
    }

    order = await Order.create({
      user: userId,
      items: lines,
      shippingAddress,
      shipToSomeoneElse,
      giftMessage,
      giftWrap,
      deliveryDate,
      paymentMethod,
      couponCode: coupon ? coupon.code : null,
      ...totals,
      statusHistory: [{ status: 'Placed' }],
    });
  } catch (err) {
    // Roll back everything already taken
    await restoreStock(deducted);
    if (couponClaimed) await releaseCoupon(coupon.code, userId);
    throw err;
  }

  cart.items = [];
  cart.couponCode = null;
  await cart.save();

  let payment = null;
  if (paymentMethod === 'ONLINE') {
    try {
      payment = await startPayment(order);
    } catch (err) {
      console.error('[payments] could not start payment:', err.message);
      await cancelOrder(order._id, { allowedFrom: ['Placed'], reason: 'Payment could not be started' });
      throw new AppError('Could not start the payment. Please try again.', 502);
    }
  }

  orderPlacedEmail(order, req.user); // fire and forget
  res.status(201).json({ success: true, order, payment });
});

// GET /api/orders/my?page=1
exports.myOrders = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const filter = { user: req.user._id };
  const [orders, total] = await Promise.all([
    Order.find(filter).sort('-createdAt').skip((page - 1) * limit).limit(limit),
    Order.countDocuments(filter),
  ]);
  res.json({ success: true, ...paginate(page, limit, total), orders });
});

async function loadOwnOrder(req) {
  const order = await Order.findById(req.params.id).populate('user', 'name email');
  if (!order) throw new AppError('Order not found', 404);
  if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new AppError('Not allowed', 403);
  }
  return order;
}

// GET /api/orders/:id
exports.getOrder = asyncHandler(async (req, res) => {
  res.json({ success: true, order: await loadOwnOrder(req) });
});

// GET /api/orders/:id/invoice  -> PDF download
exports.invoice = asyncHandler(async (req, res) => {
  const order = await loadOwnOrder(req);
  streamInvoice(order, order.user, res);
});

// PUT /api/orders/:id/cancel  (customers can cancel only while the order is still "Placed")
exports.cancelMyOrder = asyncHandler(async (req, res) => {
  const order = await cancelOrder(req.params.id, {
    allowedFrom: ['Placed'],
    reason: req.body.reason || 'Cancelled by customer',
    filter: { user: req.user._id },
  });
  if (!order) {
    const exists = await Order.exists({ _id: req.params.id, user: req.user._id });
    if (!exists) throw new AppError('Order not found', 404);
    throw new AppError('This order can no longer be cancelled');
  }
  res.json({ success: true, order });
});
