const { verifyAccessToken } = require("../config/jwt");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { unauthorized } = require("../utils/api.error");

/**
 * Middleware to authenticate user based on JWT token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw unauthorized("Authentication required");
    }

    const token = authHeader.split(" ")[1];
    let decoded;

    try {
      decoded = verifyAccessToken(token);
    } catch (error) {
      if (error.eventKey === "ACCESS_TOKEN_EXPIRED") {
        return res.status(401).json({
          status: "error",
          message: "Access token has expired",
          eventKey: "ACCESS_TOKEN_EXPIRED",
        });
      }
      throw unauthorized("Invalid or expired token");
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
        plant: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
        headOfPlant: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw unauthorized("User not found or inactive");
    }

    let plantId = user.plantId;
    let plantLocation = user.plant?.location;

    const isPlantHead = user.isPlantHead || user.headOfPlant !== null;
    const plantHeadOf = user.headOfPlant ? user.headOfPlant.id : null;

    if (isPlantHead && !plantId && user.headOfPlant) {
      plantId = user.headOfPlant.id;
      plantLocation = user.headOfPlant.location;
    }

    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roleId: user.roleId,
      role: user.role.name,
      permissions: user.role.permissions.map((p) => p.name),
      plantId: plantId,
      plantLocation: plantLocation,
      isPlantHead: isPlantHead,
      plantHeadOf: plantHeadOf,
    };

    next();
  } catch (error) {
    // Check if error has eventKey before generating response
    if (error.eventKey) {
      return res.status(401).json({
        status: "error",
        message: error.message || "Invalid or expired token",
        eventKey: error.eventKey,
      });
    }

    return res.status(401).json({
      status: "error",
      message: error.message || "Invalid or expired token",
    });
  }
};

/**
 * Optional authentication middleware - does not throw error if token is missing
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next();
    }

    const token = authHeader.split(" ")[1];
    let decoded;

    try {
      decoded = verifyAccessToken(token);
    } catch (error) {
      // If it's a token expiry, we still want to pass it to the client
      // but continue as if there was no token
      if (error.eventKey === "ACCESS_TOKEN_EXPIRED") {
        res.locals.tokenError = {
          message: "Access token has expired",
          eventKey: "ACCESS_TOKEN_EXPIRED",
        };
      }
      return next();
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
        plant: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
        headOfPlant: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
      },
    });

    if (user && user.isActive) {
      let plantId = user.plantId;
      let plantLocation = user.plant?.location;

      const isPlantHead = user.isPlantHead || user.headOfPlant !== null;
      const plantHeadOf = user.headOfPlant ? user.headOfPlant.id : null;

      if (isPlantHead && !plantId && user.headOfPlant) {
        plantId = user.headOfPlant.id;
        plantLocation = user.headOfPlant.location;
      }

      req.user = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roleId: user.roleId,
        role: user.role.name,
        permissions: user.role.permissions.map((p) => p.name),
        plantId: plantId,
        plantLocation: plantLocation,
        isPlantHead: isPlantHead,
        plantHeadOf: plantHeadOf,
      };
    }

    next();
  } catch (error) {
    res.locals.tokenError = {
      message: error.message || "Invalid token",
      eventKey: error.eventKey,
    };
    next();
  }
};

module.exports = { authenticate, optionalAuth };
