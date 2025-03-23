/**
 * Standard API response formatter
 * @class ApiResponse
 */
class ApiResponse {
  /**
   * Create a success response
   * @param {Object} res - Express response object
   * @param {number} statusCode - HTTP status code
   * @param {string} message - Success message
   * @param {*} data - Response data
   * @param {Object} meta - Metadata (pagination, etc.)
   * @returns {Object} Formatted API response
   */
  static success(
    res,
    statusCode = 200,
    message = "Success",
    data = null,
    meta = {}
  ) {
    return res.status(statusCode).json({
      status: "success",
      message,
      data,
      ...(Object.keys(meta).length > 0 && { meta }),
    });
  }

  /**
   * Create an error response
   * @param {Object} res - Express response object
   * @param {number} statusCode - HTTP status code
   * @param {string} message - Error message
   * @param {Object} errors - Validation errors
   * @returns {Object} Formatted API error response
   */
  static error(res, statusCode = 400, message = "Error", errors = {}) {
    return res.status(statusCode).json({
      status: "error",
      message,
      ...(Object.keys(errors).length > 0 && { errors }),
    });
  }

  /**
   * Create a 200 OK response
   * @param {Object} res - Express response object
   * @param {string} message - Success message
   * @param {*} data - Response data
   * @param {Object} meta - Metadata
   * @returns {Object} Formatted API response
   */
  static ok(res, message = "Success", data = null, meta = {}) {
    return this.success(res, 200, message, data, meta);
  }

  /**
   * Create a 201 Created response
   * @param {Object} res - Express response object
   * @param {string} message - Success message
   * @param {*} data - Response data
   * @param {Object} meta - Metadata
   * @returns {Object} Formatted API response
   */
  static created(
    res,
    message = "Resource created successfully",
    data = null,
    meta = {}
  ) {
    return this.success(res, 201, message, data, meta);
  }

  /**
   * Create a 204 No Content response
   * @param {Object} res - Express response object
   * @returns {Object} Formatted API response
   */
  static noContent(res) {
    return res.status(204).send();
  }

  /**
   * Create a paginated response
   * @param {Object} res - Express response object
   * @param {string} message - Success message
   * @param {*} data - Response data
   * @param {Object} pagination - Pagination info
   * @returns {Object} Formatted API response with pagination
   */
  static paginate(res, message = "Success", data = [], pagination = {}) {
    const {
      page = 1,
      limit = 10,
      totalItems = 0,
      totalPages = Math.ceil(totalItems / limit),
    } = pagination;

    return this.success(res, 200, message, data, {
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  }

  /**
   * Create a collection response
   * @param {Object} res - Express response object
   * @param {string} message - Success message
   * @param {*} data - Response data
   * @returns {Object} Formatted API response for collections
   */
  static collection(res, message = "Success", data = []) {
    return this.success(res, 200, message, {
      count: data.length,
      items: data,
    });
  }
}

module.exports = ApiResponse;
