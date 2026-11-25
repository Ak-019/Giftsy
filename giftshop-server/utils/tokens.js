// Short-lived access token (sent in the JSON body, kept in memory by the frontend)
// + long-lived refresh token (httpOnly cookie, so JavaScript on the page can't read it).
const jwt = require('jsonwebtoken');

const ACCESS_TTL = process.env.ACCESS_TOKEN_TTL || '15m';
const REFRESH_DAYS = Number(process.env.REFRESH_TOKEN_DAYS || 7);
const REFRESH_COOKIE = 'refreshToken';

const accessSecret = () => process.env.JWT_SECRET;
const refreshSecret = () => process.env.JWT_REFRESH_SECRET || `${process.env.JWT_SECRET}.refresh`;

// The algorithm is pinned so a token can never pick its own (e.g. "none" or an RSA/HMAC mix-up)
const ALG = 'HS256';
const signAccess = (user) => jwt.sign({ id: user._id.toString(), role: user.role }, accessSecret(), { expiresIn: ACCESS_TTL, algorithm: ALG });
const verifyAccess = (token) => jwt.verify(token, accessSecret(), { algorithms: [ALG] });

// "v" is the user's tokenVersion. Bumping it (logout-all, password change) invalidates every refresh token.
const signRefresh = (user) => jwt.sign({ id: user._id.toString(), v: user.tokenVersion || 0 }, refreshSecret(), { expiresIn: `${REFRESH_DAYS}d`, algorithm: ALG });
const verifyRefresh = (token) => jwt.verify(token, refreshSecret(), { algorithms: [ALG] });

function refreshCookieOptions() {
  const prod = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: prod, // HTTPS only in production
    sameSite: prod ? 'none' : 'lax', // 'none' lets a Vercel frontend talk to a Render backend
    path: '/api/auth',
    maxAge: REFRESH_DAYS * 24 * 60 * 60 * 1000,
  };
}

function clearRefreshCookie(res) {
  const { maxAge, ...opts } = refreshCookieOptions(); // Express 4 ignores the "clear" if maxAge is passed
  res.clearCookie(REFRESH_COOKIE, opts);
}

function sendAuth(res, user, status = 200) {
  res.cookie(REFRESH_COOKIE, signRefresh(user), refreshCookieOptions());
  res.status(status).json({ success: true, accessToken: signAccess(user), expiresIn: ACCESS_TTL, user });
}

module.exports = { REFRESH_COOKIE, signAccess, verifyAccess, signRefresh, verifyRefresh, refreshCookieOptions, clearRefreshCookie, sendAuth };
