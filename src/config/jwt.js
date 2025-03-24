const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const config = require("./config");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/**
 * Generate access token for authenticated user
 * @param {Object} payload - User data to include in token
 * @returns {String} JWT access token
 */
const generateAccessToken = (payload) => {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.accessTokenExpiry,
  });
};

/**
 * Generate refresh token for authenticated user
 * @param {String} userId - User ID
 * @returns {Object} Refresh token data
 */
const generateRefreshToken = async (userId) => {
  const token = uuidv4();
  const expiresAt = new Date();

  const expiryDays =
    parseInt(config.jwt.refreshTokenExpiry.replace("d", ""), 10) || 7;
  expiresAt.setDate(expiresAt.getDate() + expiryDays);

  const refreshToken = await prisma.refreshToken.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  return {
    token: refreshToken.token,
    expiresAt: refreshToken.expiresAt,
  };
};

/**
 * Verify access token
 * @param {String} token - JWT token to verify
 * @returns {Object} Decoded token payload
 */
const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (error) {
    throw new Error("Invalid or expired token");
  }
};

/**
 * Find and validate refresh token
 * @param {String} token - Refresh token
 * @returns {Object} Refresh token data with user
 */
const findRefreshToken = async (token) => {
  const refreshToken = await prisma.refreshToken.findUnique({
    where: { token },
    include: {
      user: {
        include: {
          role: {
            include: {
              permissions: true,
            },
          },
          employee: true,
        },
      },
    },
  });

  if (!refreshToken || refreshToken.revoked) {
    throw new Error("Invalid refresh token");
  }

  if (new Date() > refreshToken.expiresAt) {
    await prisma.refreshToken.update({
      where: { id: refreshToken.id },
      data: { revoked: true },
    });
    throw new Error("Refresh token expired");
  }

  return refreshToken;
};

/**
 * Revoke a refresh token
 * @param {String} token - Refresh token to revoke
 */
const revokeRefreshToken = async (token) => {
  await prisma.refreshToken.update({
    where: { token },
    data: { revoked: true },
  });
};

/**
 * Revoke all refresh tokens for a user
 * @param {String} userId - User ID
 */
const revokeAllUserRefreshTokens = async (userId) => {
  await prisma.refreshToken.updateMany({
    where: { userId },
    data: { revoked: true },
  });
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  findRefreshToken,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
  JWT_SECRET: config.jwt.secret,
};
