const visitorAuthService = require("../services/visitorAuth.service");
const asyncHandler = require("../utils/async.handler");
const { badRequest } = require("../utils/api.error");
const ApiResponse = require("../utils/api.response");

/**
 * @module controllers/visitor-auth
 * @description Controllers for visitor authentication
 */

/**
 * Register a new visitor
 */
const visitorSignup = asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName, contact, company } = req.body;

  // Validate required fields
  if (!email || !password || !firstName || !contact) {
    throw badRequest("Missing required fields");
  }

  const result = await visitorAuthService.visitorSignup({
    email,
    password,
    firstName,
    lastName,
    contact,
    company,
  });

  // Set HTTP-only cookie with refresh token
  res.cookie("refreshToken", result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return ApiResponse.created(res, "Visitor registered successfully", {
    visitor: result.visitor,
    profile: result.profile,
    accessToken: result.accessToken,
  });
});

/**
 * Login a visitor
 */
const visitorLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Validate required fields
  if (!email || !password) {
    throw badRequest("Email and password are required");
  }

  const result = await visitorAuthService.visitorLogin({
    email,
    password,
  });

  // Set HTTP-only cookie with refresh token
  res.cookie("refreshToken", result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return ApiResponse.ok(res, "Login successful", {
    visitor: result.visitor,
    profile: result.profile,
    accessToken: result.accessToken,
  });
});

module.exports = {
  visitorSignup,
  visitorLogin,
};
