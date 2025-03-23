const authService = require("../services/auth.service");
const asyncHandler = require("../utils/async.handler");
const { badRequest } = require("../utils/api.error");
const ApiResponse = require("../utils/api.response");

// register a new employee
const registerEmployee = asyncHandler(async (req, res) => {
  const { email, password, name, roleId, startDate, endDate, empCode } = req.body;

  const result = await authService.registerEmployee({
    email,
    name,
    roleId,
    startDate,
    endDate,
    empCode,
  });

  return ApiResponse.created(res, "Employee registered successfully", {
    employee: result.employee,
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  });
});
/**
 * Register a new user
 */
const register = asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName, roleId, department } = req.body;

  // Validate required fields
  if (!email || !password || !firstName || !lastName || !roleId) {
    throw badRequest("Missing required fields");
  }

  const result = await authService.register({
    email,
    password,
    firstName,
    lastName,
    roleId,
    department,
  });

  // Set HTTP-only cookie with refresh token
  res.cookie("refreshToken", result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return ApiResponse.created(res, "User registered successfully", {
    user: result.user,
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    refreshTokenExpiry: result.refreshTokenExpiry,
  });
});

/**
 * Login a user
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Validate required fields
  if (!email || !password) {
    throw badRequest("Email and password are required");
  }

  const result = await authService.login({ email, password });

  // Set HTTP-only cookie with refresh token
  res.cookie("refreshToken", result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return ApiResponse.ok(res, "Login successful", {
    user: result.user,
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    refreshTokenExpiry: result.refreshTokenExpiry,
  });
});

/**
 * Refresh access token
 */
const refreshAccessToken = asyncHandler(async (req, res) => {
  // Get refresh token from cookie or request body
  const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

  if (!refreshToken) {
    throw badRequest("Refresh token is required");
  }

  const tokens = await authService.refreshToken(refreshToken);

  // Set HTTP-only cookie with new refresh token
  res.cookie("refreshToken", tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return ApiResponse.ok(res, "Token refreshed successfully", {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    refreshTokenExpiry: tokens.refreshTokenExpiry,
  });
});

/**
 * Logout a user
 */
const logout = asyncHandler(async (req, res) => {
  // Get refresh token from cookie or request body
  const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

  await authService.logout(refreshToken);

  // Clear refresh token cookie
  res.clearCookie("refreshToken");

  return ApiResponse.ok(res, "Logout successful");
});

/**
 * Logout from all devices
 */
const logoutAll = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  await authService.logoutAll(userId);

  // Clear refresh token cookie
  res.clearCookie("refreshToken");

  return ApiResponse.ok(res, "Logged out from all devices");
});

/**
 * Get current user profile
 */
const getProfile = asyncHandler(async (req, res) => {
  // User data is already attached to the request in authenticate middleware
  return ApiResponse.ok(res, "User profile retrieved successfully", {
    user: req.user,
  });
});

module.exports = {
  register,
  login,
  refreshAccessToken,
  logout,
  logoutAll,
  getProfile,
  registerEmployee,
};
