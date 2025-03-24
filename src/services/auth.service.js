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
 * Generate a unique user code
 * @param {String} prefix - Code prefix (default: 'US')
 * @returns {Promise<String>} Generated unique code
 */
const generateUniqueUserCode = async (prefix = "US") => {
  const userCount = await prisma.user.count();

  let sequentialNumber = 1000 + userCount;
  let isUnique = false;
  let code;

  while (!isUnique) {
    code = `${prefix}${sequentialNumber.toString().slice(-2)}`;

    const existingUser = await prisma.user.findUnique({
      where: { code },
    });

    if (!existingUser) {
      isUnique = true;
    } else {
      sequentialNumber++;
    }
  }

  return code;
};

/**
 * Register a new user
 * @param {Object} userData - User registration data
 * @returns {Object} Newly created user, access token and refresh token
 */
const register = async (userData) => {
  const {
    email,
    code: providedCode,
    password,
    firstName,
    lastName,
    roleId,
    department,
  } = userData;

  const existingUserByEmail = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUserByEmail) {
    throw new ApiError(409, "User with this email already exists");
  }

  // Use provided code or generate a new one
  let userCode = providedCode;
  if (!userCode) {
    userCode = await generateUniqueUserCode();
  } else {
    // Check if provided code already exists
    const existingUserByCode = await prisma.user.findUnique({
      where: { code: userCode },
    });

    if (existingUserByCode) {
      throw new ApiError(409, "User with this code already exists");
    }
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create new user
  const newUser = await prisma.user.create({
    data: {
      email,
      code: userCode,
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

  const accessToken = generateAccessToken({
    userId: newUser.id,
    email: newUser.email,
    code: newUser.code,
    role: newUser.role.name,
  });

  const refreshTokenObj = await generateRefreshToken(newUser.id);

  const { password: _, ...userWithoutPassword } = newUser;

  return {
    user: userWithoutPassword,
    accessToken,
    refreshToken: refreshTokenObj.token,
    refreshTokenExpiry: refreshTokenObj.expiresAt,
  };
};

/**
 * Register a new employee
 * @param {Object} employeeData - Employee registration data
 * @returns {Object} Newly created employee, access token and refresh token
 */
const registerEmployee = async (employeeData) => {
  const { email, password, firstName, lastName, employeeNo, department } =
    employeeData;

  const existingEmployee = await prisma.employee.findUnique({
    where: { employeeNo },
  });

  if (existingEmployee) {
    throw new ApiError(409, "Employee with this number already exists");
  }

  if (email) {
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ApiError(409, "User with this email already exists");
    }
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const employeeRole = await prisma.role.findFirst({
    where: { name: "Employee" },
  });

  if (!employeeRole) {
    throw new ApiError(404, "Employee role not found");
  }

  const newUser = await prisma.user.create({
    data: {
      email,
      code: employeeNo,
      password: hashedPassword,
      firstName,
      lastName,
      roleId: employeeRole.id,
      department,
      employee: {
        create: {
          employeeNo,
          department,
        },
      },
    },
    include: {
      role: true,
      employee: true,
    },
  });

  const accessToken = generateAccessToken({
    userId: newUser.id,
    email: newUser.email,
    code: newUser.code,
    role: newUser.role.name,
    employeeNo: newUser.employee?.employeeNo,
  });

  const refreshTokenObj = await generateRefreshToken(newUser.id);

  const { password: _, ...userWithoutPassword } = newUser;

  return {
    user: userWithoutPassword,
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
  const { email, code, password, loginType } = credentials;
  let user = null;

  if (loginType === "EMAIL" && email) {
    user = await prisma.user.findUnique({
      where: { email },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
        employee: true,
      },
    });
  } else if (loginType === "CODE" && code) {
    user = await prisma.user.findUnique({
      where: { code },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
        employee: true,
      },
    });

    if (!user) {
      const employee = await prisma.employee.findUnique({
        where: { employeeNo: code },
        include: {
          user: {
            include: {
              role: {
                include: {
                  permissions: true,
                },
              },
            },
          },
        },
      });

      if (employee && employee.user) {
        user = employee.user;
        user.employee = employee;
      }
    }
  }

  if (!user) {
    throw unauthorized("Invalid credentials");
  }

  if (!user.isActive) {
    throw forbidden("User account is deactivated");
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw unauthorized("Invalid credentials");
  }

  // Generate tokens
  console.log("user", user);
  const accessToken = generateAccessToken({
    userId: user.id,
    email: user.email,
    code: user.code,
    role: user.role.name,
    employeeNo: user.employee?.employeeNo,
  });

  const refreshTokenObj = await generateRefreshToken(user.id);

  const { password: _, ...userWithoutPassword } = user;

  return {
    user: {
      ...userWithoutPassword,
      permissions: user.role.permissions.map((p) => p.name),
    },
    accessToken,
    refreshToken: refreshTokenObj.token,
    refreshTokenExpiry: refreshTokenObj.expiresAt,
  };
};

/**
 * Refresh access token using refresh token
 * @param {String} token - Refresh token
 * @returns {Object} New access token and refresh token
 */
const refreshToken = async (token) => {
  const refreshTokenData = await findRefreshToken(token);
  const { user } = refreshTokenData;

  const userWithEmployee = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      employee: true,
      role: true,
    },
  });

  await revokeRefreshToken(token);

  const accessToken = generateAccessToken({
    userId: userWithEmployee.id,
    email: userWithEmployee.email,
    code: userWithEmployee.code,
    role: userWithEmployee.role.name,
    employeeNo: userWithEmployee.employee?.employeeNo,
  });

  const newRefreshTokenObj = await generateRefreshToken(userWithEmployee.id);

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
  registerEmployee,
  login,
  refreshToken,
  logout,
  logoutAll,
};
