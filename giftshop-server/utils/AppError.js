// An expected error with an HTTP status, e.g. "Out of stock" (400) or "Not found" (404).
class AppError extends Error {
  constructor(message, statusCode = 400, details) {
    super(message);
    this.statusCode = statusCode;
    if (details) this.details = details;
  }
}
module.exports = AppError;
