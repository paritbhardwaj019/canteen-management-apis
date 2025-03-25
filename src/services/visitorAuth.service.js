const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const bcrypt = require("bcrypt");
const { ApiError, badRequest, unauthorized } = require("../utils/api.error");
const { generateAccessToken, generateRefreshToken } = require("../config/jwt");

const VISITOR_AUTH_ERRORS = {
  EMAIL_REQUIRED: "Email is required",
  PASSWORD_REQUIRED: "Password is required",
  NAME_REQUIRED: "Name is required",
  EMAIL_EXISTS: "Email is already registered",
  USER_NOT_FOUND: "Visitor not found",
  INVALID_CREDENTIALS: "Invalid credentials",
  PASSWORD_MISMATCH: "Incorrect password",
};

/**
 * Validate visitor signup request
 * @param {Object} data - Visitor signup data
 */
const validateVisitorSignupRequest = (data) => {
  if (!data.email) {
    throw badRequest(VISITOR_AUTH_ERRORS.EMAIL_REQUIRED);
  }
  if (!data.password) {
    throw badRequest(VISITOR_AUTH_ERRORS.PASSWORD_REQUIRED);
  }
  if (!data.firstName) {
    throw badRequest(VISITOR_AUTH_ERRORS.NAME_REQUIRED);
  }
};

/**
 * Create a visitor signup response object
 * @param {Object} visitor - Visitor data
 * @returns {Object} Formatted visitor response
 */
const createVisitorResponse = (visitor) => ({
  id: visitor.id,
  firstName: visitor.firstName,
  lastName: visitor.lastName || "",
  email: visitor.email,
  role: visitor.role.name,
});

/**
 * Register a new visitor user with optional photo
 * @param {Object} data - Visitor signup data including photoUrl
 * @returns {Object} New visitor and access token
 */
const visitorSignup = async (data) => {
  validateVisitorSignupRequest(data);

  const { email, password, firstName, lastName, contact, company, photoUrl } =
    data;

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new ApiError(409, VISITOR_AUTH_ERRORS.EMAIL_EXISTS);
  }

  const visitorRole = await prisma.role.findUnique({
    where: { name: "Visitor" },
  });

  if (!visitorRole) {
    throw new ApiError(500, "Visitor role not found");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const result = await prisma.$transaction(async (prisma) => {
    const newVisitor = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName: lastName || "",
        roleId: visitorRole.id,
        isActive: true,
        visitorProfile: {
          create: {
            contactNumber: contact,
            company,
          },
        },
      },
      include: {
        role: true,
        visitorProfile: true,
      },
    });

    let photo = null;

    // If photo was uploaded, save it
    if (photoUrl) {
      photo = await prisma.visitorPhoto.create({
        data: {
          url: photoUrl,
          visitorId: newVisitor.visitorProfile.id,
        },
      });
    }

    return { visitor: newVisitor, photo };
  });

  // Generate access token
  const accessToken = generateAccessToken({
    userId: result.visitor.id,
    email: result.visitor.email,
    role: result.visitor.role.name,
  });

  // Generate refresh token
  const refreshTokenObj = await generateRefreshToken(result.visitor.id);

  // Return visitor without password
  const { password: _, ...visitorWithoutPassword } = result.visitor;

  return {
    visitor: createVisitorResponse(visitorWithoutPassword),
    profile: result.visitor.visitorProfile,
    photoUrl: result.photo ? result.photo.url : null,
    accessToken,
    refreshToken: refreshTokenObj.token,
  };
};

/**
 * Login a visitor
 * @param {Object} data - Visitor login credentials
 * @returns {Object} Visitor data and access token
 */
const visitorLogin = async (data) => {
  if (!data.email) {
    throw badRequest(VISITOR_AUTH_ERRORS.EMAIL_REQUIRED);
  }
  if (!data.password) {
    throw badRequest(VISITOR_AUTH_ERRORS.PASSWORD_REQUIRED);
  }

  const visitor = await prisma.user.findFirst({
    where: {
      email: data.email,
      role: {
        name: "Visitor",
      },
    },
    include: {
      role: true,
      visitorProfile: {
        include: {
          photos: {
            take: 1, // Get the first photo only
          },
        },
      },
    },
  });

  if (!visitor) {
    throw unauthorized(VISITOR_AUTH_ERRORS.USER_NOT_FOUND);
  }

  if (!visitor.isActive) {
    throw unauthorized("Your account has been deactivated");
  }

  const isPasswordMatch = await bcrypt.compare(data.password, visitor.password);
  if (!isPasswordMatch) {
    throw unauthorized(VISITOR_AUTH_ERRORS.PASSWORD_MISMATCH);
  }

  const accessToken = generateAccessToken({
    userId: visitor.id,
    email: visitor.email,
    role: visitor.role.name,
  });

  const refreshTokenObj = await generateRefreshToken(visitor.id);

  const { password: _, ...visitorWithoutPassword } = visitor;

  // Get photo URL if available
  const photoUrl =
    visitor.visitorProfile?.photos?.length > 0
      ? visitor.visitorProfile.photos[0].url
      : null;

  return {
    visitor: createVisitorResponse(visitorWithoutPassword),
    profile: visitor.visitorProfile,
    photoUrl,
    accessToken,
    refreshToken: refreshTokenObj.token,
    refreshTokenExpiry: refreshTokenObj.expiresAt,
  };
};

module.exports = {
  visitorSignup,
  visitorLogin,
};
