const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { verifyAccess } = require('../utils/tokens');

const readToken = (req) => {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
};

exports.protect = asyncHandler(async (req, res, next) => {
  const token = readToken(req);
  if (!token) throw new AppError('Please log in first', 401);

  const { id } = verifyAccess(token); // throws on bad/expired token -> 401 in the error handler
  const user = await User.findById(id);
  if (!user) throw new AppError('User no longer exists', 401);
  if (user.isBlocked) throw new AppError('Your account has been blocked. Please contact support.', 403);
  req.user = user;
  next();
});

// Attaches req.user when a valid token is sent, but never blocks the request (used on public pages)
exports.optionalAuth = async (req, res, next) => {
  const token = readToken(req);
  if (!token) return next();
  try {
    const { id } = verifyAccess(token);
    const user = await User.findById(id);
    if (user && !user.isBlocked) req.user = user;
  } catch {
    // ignore bad tokens on public routes
  }
  return next();
};

exports.adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') return next(new AppError('Admin access only', 403));
  return next();
};
