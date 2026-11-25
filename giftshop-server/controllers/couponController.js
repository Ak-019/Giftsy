const Coupon = require('../models/Coupon');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const PUBLIC_FIELDS = 'code description type value minOrder maxDiscount expiresAt';

// GET /api/coupons  -> active coupons to show on the cart page
exports.listActive = asyncHandler(async (req, res) => {
  const coupons = await Coupon.find({
    isActive: true,
    expiresAt: { $gt: new Date() },
    $or: [{ usageLimit: null }, { $expr: { $lt: ['$usedCount', '$usageLimit'] } }],
  }).select(PUBLIC_FIELDS).sort({ minOrder: 1 });
  res.json({ success: true, coupons });
});

// ---------- admin ----------
exports.adminList = asyncHandler(async (req, res) => {
  const coupons = await Coupon.find().select('-usedBy').sort('-createdAt');
  res.json({ success: true, coupons });
});

exports.create = asyncHandler(async (req, res) => {
  const coupon = await Coupon.create(req.body);
  res.status(201).json({ success: true, coupon });
});

exports.update = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) throw new AppError('Coupon not found', 404);
  coupon.set(req.body);
  if (coupon.type === 'percent' && coupon.value > 100) throw new AppError('Percent value must be 100 or less');
  await coupon.save();
  res.json({ success: true, coupon });
});

exports.remove = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findByIdAndDelete(req.params.id);
  if (!coupon) throw new AppError('Coupon not found', 404);
  res.json({ success: true, message: 'Coupon deleted' });
});
