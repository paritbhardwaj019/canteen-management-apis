const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const bcrypt = require("bcrypt");
const {
  generateAccessToken,
  generateRefreshToken,
  findRefreshToken,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
} = require("../config/jwt");
const {
  ApiError,
  badRequest,
  unauthorized,
  forbidden,
} = require("../utils/api.error");

/**
 * Format role name to uppercase with underscores
 * @param {String} roleName - Original role name
 * @returns {String} Formatted role name
 */
const formatRoleName = (roleName) => {
  if (!roleName) return "";
  return roleName.toUpperCase().replace(/\s+/g, "_");
};

const registerEmployee = async (userData) => {
  const { email, password, name, roleId, startDate, endDate, empCode } =
    userData;
  const existingEmployee = await prisma.employee.findUnique({
    where: { email: email, empCode: empCode },
  });
  if (existingEmployee) {
    throw new ApiError(409, "Employee with this email already exists");
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const newEmployee = await prisma.employee.create({
    data: {
      email,
      password: hashedPassword,
      name,
      empCode,
      startDate,
      endDate,
      roleId: "cac87de3-96f9-4486-892f-27299fd6fa5b",
    },
    include: {
      role: true,
    },
  });

  // Generate tokens
  const accessToken = generateAccessToken({
    userId: newEmployee.id,
    email: newEmployee.email,
    role: newEmployee.role.name,
  });

  const refreshTokenObj = await generateRefreshToken(newEmployee.id);

  // Return user data without password
  const { password: _, ...employeeWithoutPassword } = newEmployee;

  return {
    employee: employeeWithoutPassword,
    roleName: formatRoleName(newEmployee.role.name),
    accessToken,
    refreshToken: refreshTokenObj.token, // Return just the token string
    refreshTokenExpiry: refreshTokenObj.expiresAt, // Optionally include expiry
  };
};

/**
 * Register a new user
 * @param {Object} userData - User registration data
 * @returns {Object} Newly created user, access token and refresh token
 */
const register = async (userData) => {
  const { email, password, firstName, lastName, roleId, department, type } =
    userData;

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new ApiError(409, "User with this email already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      firstName,
      lastName,
      roleId,
      department,
    },
    include: {
      role: true,
    },
  });

  // Generate tokens
  const accessToken = generateAccessToken({
    userId: newUser.id,
    email: newUser.email,
    role: newUser.role.name,
  });

  const refreshTokenObj = await generateRefreshToken(newUser.id);

  // Return user data without password
  const { password: _, ...userWithoutPassword } = newUser;

  return {
    user: userWithoutPassword,
    roleName: formatRoleName(newUser.role.name),
    accessToken,
    refreshToken: refreshTokenObj.token,
    refreshTokenExpiry: refreshTokenObj.expiresAt,
  };
};

/**
 * Login a user
 * @param {Object} credentials - User login credentials
 * @returns {Object} User data, access token and refresh token
 */
const login = async (credentials) => {
  const { email, password } = credentials;

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      role: {
        include: {
          permissions: true,
        },
      },
    },
  });

  if (!user) {
    throw unauthorized("Invalid email or password");
  }

  if (!user.isActive) {
    throw forbidden("User account is deactivated");
  }

  // Check password
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw unauthorized("Invalid email or password");
  }

  // Generate tokens
  const accessToken = generateAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role.name,
  });

  const refreshTokenObj = await generateRefreshToken(user.id);

  // Return user data without password
  const { password: _, ...userWithoutPassword } = user;

  return {
    user: {
      ...userWithoutPassword,
      permissions: user.role.permissions.map((p) => p.name),
    },
    roleName: formatRoleName(user.role.name),
    accessToken,
    refreshToken: refreshTokenObj.token, // Return just the token string
    refreshTokenExpiry: refreshTokenObj.expiresAt, // Optionally include expiry
  };
};

/**
 * Refresh access token using refresh token
 * @param {String} token - Refresh token
 * @returns {Object} New access token and refresh token
 */
const refreshToken = async (token) => {
  // Find and validate refresh token
  const refreshTokenData = await findRefreshToken(token);
  const { user } = refreshTokenData;

  // Revoke current refresh token
  await revokeRefreshToken(token);

  // Generate new tokens
  const accessToken = generateAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role.name,
  });

  const newRefreshTokenObj = await generateRefreshToken(user.id);

  return {
    accessToken,
    refreshToken: newRefreshTokenObj.token,
    refreshTokenExpiry: newRefreshTokenObj.expiresAt,
  };
};

/**
 * Logout a user
 * @param {String} refreshToken - Refresh token
 * @returns {Boolean} Success status
 */
const logout = async (refreshToken) => {
  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }

  return true;
};

/**
 * Logout a user from all devices
 * @param {String} userId - User ID
 * @returns {Boolean} Success status
 */
const logoutAll = async (userId) => {
  await revokeAllUserRefreshTokens(userId);

  return true;
};

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  logoutAll,
  registerEmployee,
};
