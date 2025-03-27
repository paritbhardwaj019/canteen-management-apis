const userService = require("../services/user.service");
const asyncHandler = require("../utils/async.handler");
const { badRequest } = require("../utils/api.error");
const ApiResponse = require("../utils/api.response");

/**
 * Get all users
 */
const getAllUsers = asyncHandler(async (req, res) => {
  const { roleId, isActive, search } = req.query;

  const users = await userService.getAllUsers({
    roleId,
    isActive,
    search,
  });

  return ApiResponse.collection(res, "Users retrieved successfully", users);
});

/**
 * Get user by ID
 */
const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await userService.getUserById(id);

  return ApiResponse.ok(res, "User retrieved successfully", user);
});

/**
 * Create a new user
 */
const createUser = asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName, roleId, department, isActive } =
    req.body;

  const newUser = await userService.createUser({
    email,
    password,
    firstName,
    lastName,
    roleId,
    department,
    isActive,
  }, req.user);

  return ApiResponse.created(res, "User created successfully", newUser);
});

/**
 * Update a user
 */
const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { email, firstName, lastName, roleId, department, isActive } = req.body;

  const updatedUser = await userService.updateUser(id, {
    email,
    firstName,
    lastName,
    roleId,
    department,
    isActive,
  });

  return ApiResponse.ok(res, "User updated successfully", updatedUser);
});

/**
 * Delete a user
 */
const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  await userService.deleteUser(id);

  return ApiResponse.ok(res, "User deleted successfully");
});

/**
 * Change user password
 */
const changePassword = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { currentPassword, newPassword } = req.body;

  await userService.changePassword(id, currentPassword, newPassword);

  return ApiResponse.ok(res, "Password changed successfully");
});

/**
 * Change own password
 */
const changeOwnPassword = asyncHandler(async (req, res) => {
  const id = req.user.id;
  const { currentPassword, newPassword } = req.body;

  await userService.changePassword(id, currentPassword, newPassword);

  return ApiResponse.ok(res, "Password changed successfully");
});

/**
 * Reset user password (by admin)
 */
const resetUserPassword = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  if (!newPassword) {
    throw badRequest("New password is required");
  }

  await userService.resetUserPassword(id, newPassword);

  return ApiResponse.ok(res, "Password reset successfully");
});

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  changePassword,
  changeOwnPassword,
  resetUserPassword,
};
