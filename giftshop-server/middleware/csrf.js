// The refresh-token cookie is sent automatically by the browser, so routes that read it need CSRF protection.
// Requiring a custom header works because a browser on another site can't add custom headers to a
// cross-origin request without a CORS preflight, and our CORS config only allows our own frontend.
const AppError = require('../utils/AppError');

module.exports = function requireAjaxHeader(req, res, next) {
  if (req.get('x-requested-with') !== 'XMLHttpRequest') {
    return next(new AppError('Missing X-Requested-With header', 403));
  }
  return next();
};
