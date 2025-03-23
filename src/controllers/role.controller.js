const roleService = require("../services/role.service");

/**
 * Create a new role
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createRole = async (req, res) => {
  try {
    const { name, description, permissionIds } = req.body;

    // Validate required fields
    if (!name || !permissionIds || !Array.isArray(permissionIds)) {
      return res.status(400).json({
        status: "error",
        message: "Name and permissionIds array are required",
      });
    }

    const newRole = await roleService.createRole({
      name,
      description,
      permissionIds,
    });

    return res.status(201).json({
      status: "success",
      message: "Role created successfully",
      data: newRole,
    });
  } catch (error) {
    return res.status(400).json({
      status: "error",
      message: error.message,
    });
  }
};

/**
 * Get all roles
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAllRoles = async (req, res) => {
  try {
    const roles = await roleService.getAllRoles();

    return res.status(200).json({
      status: "success",
      data: roles,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

/**
 * Get role by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getRoleById = async (req, res) => {
  try {
    const { id } = req.params;

    const role = await roleService.getRoleById(id);

    return res.status(200).json({
      status: "success",
      data: role,
    });
  } catch (error) {
    return res.status(404).json({
      status: "error",
      message: error.message,
    });
  }
};

/**
 * Update a role
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, permissionIds } = req.body;

    const updatedRole = await roleService.updateRole(id, {
      name,
      description,
      permissionIds,
    });

    return res.status(200).json({
      status: "success",
      message: "Role updated successfully",
      data: updatedRole,
    });
  } catch (error) {
    return res.status(400).json({
      status: "error",
      message: error.message,
    });
  }
};

/**
 * Delete a role
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;

    await roleService.deleteRole(id);

    return res.status(200).json({
      status: "success",
      message: "Role deleted successfully",
    });
  } catch (error) {
    return res.status(400).json({
      status: "error",
      message: error.message,
    });
  }
};

/**
 * Create a new permission
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createPermission = async (req, res) => {
  try {
    const { name, description } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        status: "error",
        message: "Permission name is required",
      });
    }

    const newPermission = await roleService.createPermission({
      name,
      description,
    });

    return res.status(201).json({
      status: "success",
      message: "Permission created successfully",
      data: newPermission,
    });
  } catch (error) {
    return res.status(400).json({
      status: "error",
      message: error.message,
    });
  }
};

/**
 * Get all permissions
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAllPermissions = async (req, res) => {
  try {
    const permissions = await roleService.getAllPermissions();

    return res.status(200).json({
      status: "success",
      data: permissions,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

module.exports = {
  createRole,
  getAllRoles,
  getRoleById,
  updateRole,
  deleteRole,
  createPermission,
  getAllPermissions,
};
