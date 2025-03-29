/**
 * Custom API Error class
 * @class ApiError
 * @extends Error
 */
class ApiError extends Error {
  /**
   * Create an API error
   * @param {number} statusCode - HTTP status code
   * @param {string} message - Error message
   * @param {Object} errors - Validation errors
   * @param {boolean} isOperational - Is this an operational error
   * @param {string} eventKey - Optional event key for specific error types
   */
  constructor(
    statusCode,
    message,
    errors = {},
    isOperational = true,
    eventKey = null
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith("4") ? "error" : "fail";
    this.eventKey = eventKey;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Create a Bad Request error (400)
 * @param {string} message - Error message
 * @param {Object} errors - Validation errors
 * @returns {ApiError} API error object
 */
const badRequest = (message = "Bad request", errors = {}) => {
  return new ApiError(400, message, errors);
};

/**
 * Create an Unauthorized error (401)
 * @param {string} message - Error message
 * @param {string} eventKey - Optional event key
 * @returns {ApiError} API error object
 */
const unauthorized = (message = "Unauthorized", eventKey = null) => {
  return new ApiError(401, message, {}, true, eventKey);
};

/**
 * Create a Forbidden error (403)
 * @param {string} message - Error message
 * @returns {ApiError} API error object
 */
const forbidden = (message = "Forbidden") => {
  return new ApiError(403, message);
};

/**
 * Create a Not Found error (404)
 * @param {string} message - Error message
 * @returns {ApiError} API error object
 */
const notFound = (message = "Resource not found") => {
  return new ApiError(404, message);
};

/**
 * Create a Conflict error (409)
 * @param {string} message - Error message
 * @returns {ApiError} API error object
 */
const conflict = (message = "Resource already exists") => {
  return new ApiError(409, message);
};

/**
 * Create a validation error (422)
 * @param {string} message - Error message
 * @param {Object} errors - Validation errors
 * @returns {ApiError} API error object
 */
const validationError = (message = "Validation error", errors = {}) => {
  return new ApiError(422, message, errors);
};

/**
 * Create a Server error (500)
 * @param {string} message - Error message
 * @returns {ApiError} API error object
 */
const serverError = (message = "Internal server error") => {
  return new ApiError(500, message, {}, false);
};

/**
 * Express error handler middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const errorHandler = (err, req, res, next) => {
  let error = err;

  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 500;
    const message = error.message || "Something went wrong";
    const eventKey = error.eventKey || null;
    error = new ApiError(statusCode, message, {}, false, eventKey);
  }

  const responseBody = {
    status: error.status,
    message: error.message,
    ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
    ...(Object.keys(error.errors).length > 0 && { errors: error.errors }),
  };

  if (error.eventKey) {
    responseBody.eventKey = error.eventKey;
  }

  res.status(error.statusCode).json(responseBody);
};

/**
 * Express middleware to handle 404 errors
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const notFoundHandler = (req, res, next) => {
  next(notFound(`Cannot ${req.method} ${req.originalUrl}`));
};

module.exports = {
  ApiError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  validationError,
  serverError,
  errorHandler,
  notFoundHandler,
};
