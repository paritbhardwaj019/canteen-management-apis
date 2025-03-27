const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const bcrypt = require("bcrypt");
const { getUserColumns } = require("../utils/columnModles");
const { notFound, conflict, unauthorized } = require("../utils/api.error");

/**
 * Get all users
 * @param {Object} filters - Optional filters
 * @returns {Array} List of users
 */
const getAllUsers = async (filters = {}) => {
  const { roleId, isActive, search } = filters;

  const where = {
    // Exclude users with Employee or Visitor roles
    role: {
      name: {
        notIn: ['Employee', 'Visitor']
      }
    }
  };

  if (roleId) {
    where.roleId = roleId;
  }

  if (isActive !== undefined) {
    where.isActive = isActive === "true" || isActive === true;
  }

  if (search) {
    where.OR = [
      { email: { contains: search } },
      { firstName: { contains: search } },
      { lastName: { contains: search } },
      { department: { contains: search } },
    ];
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      department: true,
      isActive: true,
      roleId: true,
      createdAt: true,
      updatedAt: true,
      plant : {
        select: {
          id: true,
          name: true,
          plantCode: true,
        },
      },
      role: {
        select: {
          id: true,
          name: true,
          description: true,
        },
      },
    },
    orderBy: {
      firstName: "asc",
    },
  });

  // Transform the users array to include roleName at the top level
  const transformedUsers = users.map(user => {
    const { role, plant, ...rest } = user;
    return {
      ...rest,
      roleName: role.name,
      plantName: plant?.name || 'N/A',
      plantCode: plant?.plantCode || 'N/A',
      name: `${user.firstName} ${user.lastName}`,
      role
    };
  });

  return {
    users: transformedUsers, 
    columns: getUserColumns(roleId) 
  }
};

/**
 * Get user by ID
 * @param {String} id - User ID
 * @returns {Object} User data
 */
const getUserById = async (id) => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      department: true,
      isActive: true,
      roleId: true,
      createdAt: true,
      updatedAt: true,
      role: {
        select: {
          id: true,
          name: true,
          description: true,
          permissions: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw notFound("User not found");
  }

  return user;
};

/**
 * Create a new user
 * @param {Object} userData - User data
 * @returns {Object} Newly created user
 */
const createUser = async (userData, reqUser) => {
  const { email, password, firstName, lastName, roleId, department, isActive } =
    userData;

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw conflict("User with this email already exists");
  }

  const role = await prisma.role.findUnique({
    where: { id: roleId },
  });

  if (!role) {
    throw notFound("Role not found");
  }

  const hashedPassword = await bcrypt.hash(password, 10); 
  let plantId = null;
  if(userData.plantId){
   plantId = userData.plantId;
  }
   
  
  const newUser = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      firstName,
      lastName,
      roleId,
      department,
      plantId,
      isActive: isActive !== undefined ? isActive : true,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      department: true,
      isActive: true,
      roleId: true,
      createdAt: true,
      updatedAt: true,
      role: {
        select: {
          id: true,
          name: true,
          description: true,
        },
      },
    },
  });

  return newUser;
};

/**
 * Update a user
 * @param {String} id - User ID
 * @param {Object} userData - User data to update
 * @returns {Object} Updated user
 */
const updateUser = async (id, userData) => {
  const { email, firstName, lastName, roleId, department, isActive } = userData;

  const existingUser = await prisma.user.findUnique({
    where: { id },
  });

  if (!existingUser) {
    throw notFound("User not found");
  }

  if (email && email !== existingUser.email) {
    const userWithEmail = await prisma.user.findUnique({
      where: { email },
    });

    if (userWithEmail) {
      throw conflict("Email already in use");
    }
  }

  if (roleId) {
    const role = await prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw notFound("Role not found");
    }
  }

  const updateData = {};

  if (email !== undefined) updateData.email = email;
  if (firstName !== undefined) updateData.firstName = firstName;
  if (lastName !== undefined) updateData.lastName = lastName;
  if (roleId !== undefined) updateData.roleId = roleId;
  if (department !== undefined) updateData.department = department;
  if (isActive !== undefined) updateData.isActive = isActive;

  return await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      department: true,
      isActive: true,
      roleId: true,
      createdAt: true,
      updatedAt: true,
      role: {
        select: {
          id: true,
          name: true,
          description: true,
        },
      },
    },
  });
};

/**
 * Delete a user
 * @param {String} id - User ID
 * @returns {Object} Deleted user
 */
const deleteUser = async (id) => {
  const existingUser = await prisma.user.findUnique({
    where: { id },
    include: {
      mealRequests: {
        where: {
          status: "PENDING",
        },
      },
    },
  });

  if (!existingUser) {
    throw notFound("User not found");
  }

  if (existingUser.mealRequests.length > 0) {
    throw conflict("Cannot delete user with pending meal requests");
  }

  await prisma.refreshToken.deleteMany({
    where: { userId: id },
  });

  return await prisma.user.delete({
    where: { id },
  });
};

/**
 * Change user password
 * @param {String} id - User ID
 * @param {String} currentPassword - Current password
 * @param {String} newPassword - New password
 * @returns {Boolean} Success status
 */
const changePassword = async (id, currentPassword, newPassword) => {
  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    throw notFound("User not found");
  }

  // Verify current password
  const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
  if (!isPasswordValid) {
    throw unauthorized("Current password is incorrect");
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Update password
  await prisma.user.update({
    where: { id },
    data: { password: hashedPassword },
  });

  // Revoke all refresh tokens
  await prisma.refreshToken.updateMany({
    where: { userId: id },
    data: { revoked: true },
  });

  return true;
};

/**
 * Reset user password (by admin)
 * @param {String} id - User ID
 * @param {String} newPassword - New password
 * @returns {Boolean} Success status
 */
const resetUserPassword = async (id, newPassword) => {
  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    throw notFound("User not found");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id },
    data: { password: hashedPassword },
  });

  await prisma.refreshToken.updateMany({
    where: { userId: id },
    data: { revoked: true },
  });

  return true;
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  changePassword,
  resetUserPassword,
};
