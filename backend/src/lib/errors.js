class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
const notFound = (what = 'Resource') => new ApiError(404, `${what} not found`);
const forbidden = (msg = 'You do not have permission to perform this action') => new ApiError(403, msg);
const badRequest = (msg, details) => new ApiError(400, msg, details);
module.exports = { ApiError, notFound, forbidden, badRequest };
