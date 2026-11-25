// Profile, password, saved addresses, wishlist and occasion reminders for the logged-in user
const User = require('../models/User');
const Product = require('../models/Product');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { sendAuth } = require('../utils/tokens');
const { upcomingOccasions } = require('../utils/occasions');
const { MAX_ADDRESSES } = require('../config/constants');

// ---------- profile ----------
exports.updateProfile = asyncHandler(async (req, res) => {
  req.user.set(req.body); // only name / phone survive validation
  await req.user.save();
  res.json({ success: true, user: req.user });
});

exports.changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.matchPassword(req.body.currentPassword))) throw new AppError('Current password is incorrect', 401);

  user.password = req.body.newPassword;
  user.tokenVersion += 1; // log out other devices
  await user.save();
  sendAuth(res, user); // fresh tokens for this device
});

// ---------- addresses ----------
const ensureOneDefault = (user) => {
  if (user.addresses.length && !user.addresses.some((a) => a.isDefault)) user.addresses[0].isDefault = true;
};

exports.listAddresses = (req, res) => res.json({ success: true, addresses: req.user.addresses });

exports.addAddress = asyncHandler(async (req, res) => {
  const user = req.user;
  if (user.addresses.length >= MAX_ADDRESSES) throw new AppError(`You can save up to ${MAX_ADDRESSES} addresses`);

  if (req.body.isDefault) user.addresses.forEach((a) => { a.isDefault = false; });
  user.addresses.push(req.body);
  ensureOneDefault(user); // the first address becomes the default
  await user.save();
  res.status(201).json({ success: true, addresses: user.addresses });
});

exports.updateAddress = asyncHandler(async (req, res) => {
  const user = req.user;
  const address = user.addresses.id(req.params.id);
  if (!address) throw new AppError('Address not found', 404);

  if (req.body.isDefault) user.addresses.forEach((a) => { a.isDefault = false; });
  address.set(req.body);
  ensureOneDefault(user);
  await user.save();
  res.json({ success: true, addresses: user.addresses });
});

exports.deleteAddress = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user.addresses.id(req.params.id)) throw new AppError('Address not found', 404);
  user.addresses.pull(req.params.id);
  ensureOneDefault(user);
  await user.save();
  res.json({ success: true, addresses: user.addresses });
});

// ---------- wishlist ----------
const WISHLIST_FIELDS = 'name slug price discountPrice finalPrice images stock ratingAvg ratingCount';

exports.getWishlist = asyncHandler(async (req, res) => {
  await req.user.populate({ path: 'wishlist', select: WISHLIST_FIELDS });
  res.json({ success: true, wishlist: req.user.wishlist.filter(Boolean) });
});

// POST /api/account/wishlist/:productId  -> adds it, or removes it if it is already there
exports.toggleWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  if (!(await Product.exists({ _id: productId }))) throw new AppError('Product not found', 404);

  const inList = req.user.wishlist.some((id) => id.toString() === productId);
  const update = inList ? { $pull: { wishlist: productId } } : { $addToSet: { wishlist: productId } };
  const user = await User.findByIdAndUpdate(req.user._id, update, { new: true });
  res.json({ success: true, inWishlist: !inList, wishlist: user.wishlist });
});

exports.removeFromWishlist = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.user._id, { $pull: { wishlist: req.params.productId } }, { new: true });
  res.json({ success: true, inWishlist: false, wishlist: user.wishlist });
});

// ---------- occasions (reminders) ----------
exports.listOccasions = (req, res) => {
  const occasions = [...req.user.occasions].sort((a, b) => a.date - b.date);
  res.json({ success: true, occasions });
};

exports.upcoming = (req, res) => {
  res.json({ success: true, days: req.query.days, occasions: upcomingOccasions(req.user.occasions, req.query.days) });
};

exports.addOccasion = asyncHandler(async (req, res) => {
  if (req.user.occasions.length >= 50) throw new AppError('You can save up to 50 occasions');
  req.user.occasions.push(req.body);
  await req.user.save();
  res.status(201).json({ success: true, occasion: req.user.occasions[req.user.occasions.length - 1] });
});

exports.updateOccasion = asyncHandler(async (req, res) => {
  const occasion = req.user.occasions.id(req.params.id);
  if (!occasion) throw new AppError('Occasion not found', 404);
  occasion.set(req.body);
  await req.user.save();
  res.json({ success: true, occasion });
});

exports.deleteOccasion = asyncHandler(async (req, res) => {
  if (!req.user.occasions.id(req.params.id)) throw new AppError('Occasion not found', 404);
  req.user.occasions.pull(req.params.id);
  await req.user.save();
  res.json({ success: true, message: 'Occasion deleted' });
});
