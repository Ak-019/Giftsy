// Validates req.params / req.query / req.body against Zod schemas.
// The parsed result REPLACES the original, so unknown fields (e.g. "role", "total", "ratingAvg") are dropped.
const AppError = require('../utils/AppError');

module.exports = (schemas) => (req, res, next) => {
  for (const key of ['params', 'query', 'body']) {
    if (!schemas[key]) continue;
    const result = schemas[key].safeParse(req[key] ?? {});
    if (!result.success) {
      const details = result.error.issues.map((i) => ({ field: i.path.join('.') || key, message: i.message }));
      const message = details.map((d) => `${d.field}: ${d.message}`).join(', ');
      return next(new AppError(message, 400, details));
    }
    req[key] = result.data;
  }
  return next();
};
