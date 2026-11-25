const bcrypt = require('bcryptjs');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { REFRESH_COOKIE, sendAuth, verifyRefresh, clearRefreshCookie } = require('../utils/tokens');

// POST /api/auth/register
exports.register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (await User.exists({ email })) throw new AppError('Email already registered', 409);

  // role is never taken from the request (the validator strips it), so nobody can self-register as admin
  const user = await User.create({ name, email, password });
  sendAuth(res, user, 201);
});

// Compared against when the email doesn't exist, so a wrong email takes as long as a wrong password
// (otherwise response time would reveal which emails are registered).
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

// POST /api/auth/login
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password');
  const ok = user ? await user.matchPassword(password) : await bcrypt.compare(password, DUMMY_HASH);
  if (!user || !ok) throw new AppError('Invalid email or password', 401);
  if (user.isBlocked) throw new AppError('Your account has been blocked. Please contact support.', 403);
  sendAuth(res, user);
});

// POST /api/auth/refresh  (uses the httpOnly cookie, returns a new access token and rotates the cookie)
exports.refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) throw new AppError('Not logged in', 401);

  let payload;
  try {
    payload = verifyRefresh(token);
  } catch {
    clearRefreshCookie(res);
    throw new AppError('Session expired, please log in again', 401);
  }

  const user = await User.findById(payload.id);
  if (!user || user.tokenVersion !== payload.v) {
    clearRefreshCookie(res);
    throw new AppError('Session expired, please log in again', 401);
  }
  if (user.isBlocked) throw new AppError('Your account has been blocked. Please contact support.', 403);
  sendAuth(res, user);
});

// POST /api/auth/logout  (this device)
exports.logout = (req, res) => {
  clearRefreshCookie(res);
  res.json({ success: true, message: 'Logged out' });
};

// POST /api/auth/logout-all  (every device: old refresh tokens stop working)
exports.logoutAll = asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
  clearRefreshCookie(res);
  res.json({ success: true, message: 'Logged out from all devices' });
});

// GET /api/auth/me
exports.me = (req, res) => res.json({ success: true, user: req.user });
