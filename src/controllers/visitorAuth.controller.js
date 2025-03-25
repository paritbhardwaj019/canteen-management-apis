const visitorAuthService = require("../services/visitorAuth.service");
const asyncHandler = require("../utils/async.handler");
const { badRequest } = require("../utils/api.error");
const ApiResponse = require("../utils/api.response");

/**
 * Register a new visitor with optional photo upload
 */
const visitorSignup = asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName, contact, company } = req.body;

  if (!email || !password || !firstName || !contact) {
    throw badRequest("Missing required fields");
  }

  const photoFile = req.file ? req.file.path : null;

  const result = await visitorAuthService.visitorSignup({
    email,
    password,
    firstName,
    lastName,
    contact,
    company,
    photoUrl: photoFile,
  });

  res.cookie("refreshToken", result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return ApiResponse.created(res, "Visitor registered successfully", {
    visitor: result.visitor,
    profile: result.profile,
    accessToken: result.accessToken,
    photoUrl: result.photoUrl,
  });
});

/**
 * Login a visitor
 */
const visitorLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw badRequest("Email and password are required");
  }

  const result = await visitorAuthService.visitorLogin({
    email,
    password,
  });

  res.cookie("refreshToken", result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return ApiResponse.ok(res, "Login successful", {
    visitor: result.visitor,
    profile: result.profile,
    accessToken: result.accessToken,
    photoUrl: result.photoUrl,
  });
});

module.exports = {
  visitorSignup,
  visitorLogin,
};
