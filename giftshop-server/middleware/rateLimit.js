const rateLimit = require('express-rate-limit');

const skip = () => process.env.NODE_ENV === 'test';
const options = (limit, windowMinutes, message) => ({
  windowMs: windowMinutes * 60 * 1000,
  limit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip,
  message: { success: false, message },
});

// Brute-force protection: 10 login/register attempts per 15 minutes per IP (override with AUTH_RATE_LIMIT)
exports.authLimiter = rateLimit(options(Number(process.env.AUTH_RATE_LIMIT) || 10, 15, 'Too many attempts. Please try again in 15 minutes.'));

// General limit for the whole API: 1000 requests per 15 minutes per IP (override with API_RATE_LIMIT)
// Note: limits are kept in memory per server. With several servers behind a load balancer, use a shared
// store (e.g. rate-limit-redis) so the limit counts across all of them.
exports.apiLimiter = rateLimit(options(Number(process.env.API_RATE_LIMIT) || 1000, 15, 'Too many requests. Please slow down.'));
