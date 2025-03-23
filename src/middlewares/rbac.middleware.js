/**
 * Middleware to check if user has required permissions
 * @param {String[]} requiredPermissions - Array of permission names required for access
 * @returns {Function} Express middleware function
 */
const checkPermissions = (requiredPermissions) => {
  return (req, res, next) => {
    try {
      const { permissions } = req.user;

      const hasPermission = requiredPermissions.every((permission) =>
        permissions.includes(permission)
      );

      if (!hasPermission) {
        return res.status(403).json({
          status: "error",
          message: "Access denied: Insufficient permissions",
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        status: "error",
        message: "Error checking permissions",
        error: error.message,
      });
    }
  };
};

/**
 * Middleware to check if user has a specific role
 * @param {String[]} allowedRoles - Array of role names allowed for access
 * @returns {Function} Express middleware function
 */
const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    try {
      const { role } = req.user;

      if (!allowedRoles.includes(role)) {
        return res.status(403).json({
          status: "error",
          message: "Access denied: Role not authorized",
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        status: "error",
        message: "Error checking role",
        error: error.message,
      });
    }
  };
};

module.exports = {
  checkPermissions,
  checkRole,
};
