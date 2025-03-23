const permissionService = require("../services/permission.service");
const asyncHandler = require("../utils/async.handler");
const { badRequest } = require("../utils/api.error");
const ApiResponse = require("../utils/api.response");

const createPermission = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  if (!name) {
    throw badRequest("Permission name is required");
  }

  const newPermission = await permissionService.createPermission({
    name,
    description,
  });

  return ApiResponse.created(
    res,
    "Permission created successfully",
    newPermission
  );
});

const getAllPermissions = asyncHandler(async (req, res) => {
  const permissions = await permissionService.getAllPermissions();

  return ApiResponse.collection(
    res,
    "Permissions retrieved successfully",
    permissions
  );
});

const getPermissionById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const permission = await permissionService.getPermissionById(id);

  return ApiResponse.ok(res, "Permission retrieved successfully", permission);
});

const updatePermission = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;

  if (!name && !description) {
    throw badRequest("At least one field to update is required");
  }

  const updatedPermission = await permissionService.updatePermission(id, {
    name,
    description,
  });

  return ApiResponse.ok(
    res,
    "Permission updated successfully",
    updatedPermission
  );
});

const deletePermission = asyncHandler(async (req, res) => {
  const { id } = req.params;

  await permissionService.deletePermission(id);

  return ApiResponse.ok(res, "Permission deleted successfully");
});

const assignPermissionsToRole = asyncHandler(async (req, res) => {
  const { roleId } = req.params;
  const { permissionIds } = req.body;

  if (
    !permissionIds ||
    !Array.isArray(permissionIds) ||
    permissionIds.length === 0
  ) {
    throw badRequest("Permission IDs array is required");
  }

  const role = await permissionService.assignPermissionsToRole(
    roleId,
    permissionIds
  );

  return ApiResponse.ok(res, "Permissions assigned to role successfully", role);
});

const removePermissionsFromRole = asyncHandler(async (req, res) => {
  const { roleId } = req.params;
  const { permissionIds } = req.body;

  if (
    !permissionIds ||
    !Array.isArray(permissionIds) ||
    permissionIds.length === 0
  ) {
    throw badRequest("Permission IDs array is required");
  }

  const role = await permissionService.removePermissionsFromRole(
    roleId,
    permissionIds
  );

  return ApiResponse.ok(
    res,
    "Permissions removed from role successfully",
    role
  );
});

module.exports = {
  createPermission,
  getAllPermissions,
  getPermissionById,
  updatePermission,
  deletePermission,
  assignPermissionsToRole,
  removePermissionsFromRole,
};
