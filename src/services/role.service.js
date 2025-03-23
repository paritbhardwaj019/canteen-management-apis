const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/**
 * Create a new role
 * @param {Object} roleData - Role data
 * @returns {Object} Newly created role
 */
const createRole = async (roleData) => {
  const { name, description, permissionIds } = roleData;

  const existingRole = await prisma.role.findUnique({
    where: { name },
  });

  if (existingRole) {
    throw new Error("Role with this name already exists");
  }

  const newRole = await prisma.role.create({
    data: {
      name,
      description,
      permissions: {
        connect: permissionIds.map((id) => ({ id })),
      },
    },
    include: {
      permissions: true,
    },
  });

  return newRole;
};

/**
 * Get all roles
 * @returns {Array} List of roles
 */
const getAllRoles = async () => {
  return await prisma.role.findMany({
    include: {
      permissions: true,
      users: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });
};

/**
 * Get role by ID
 * @param {String} id - Role ID
 * @returns {Object} Role data
 */
const getRoleById = async (id) => {
  const role = await prisma.role.findUnique({
    where: { id },
    include: {
      permissions: true,
      users: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!role) {
    throw new Error("Role not found");
  }

  return role;
};

/**
 * Update a role
 * @param {String} id - Role ID
 * @param {Object} roleData - Role data to update
 * @returns {Object} Updated role
 */
const updateRole = async (id, roleData) => {
  const { name, description, permissionIds } = roleData;

  const existingRole = await prisma.role.findUnique({
    where: { id },
  });

  if (!existingRole) {
    throw new Error("Role not found");
  }

  if (name && name !== existingRole.name) {
    const roleWithSameName = await prisma.role.findUnique({
      where: { name },
    });

    if (roleWithSameName) {
      throw new Error("Role with this name already exists");
    }
  }

  let updateData = {
    name,
    description,
  };

  Object.keys(updateData).forEach((key) => {
    if (updateData[key] === undefined) {
      delete updateData[key];
    }
  });

  const updatedRole = await prisma.role.update({
    where: { id },
    data: updateData,
    include: {
      permissions: true,
    },
  });

  // Update permissions if provided
  if (permissionIds) {
    // Get current permissions
    const currentPermissions = await prisma.permission.findMany({
      where: {
        roles: {
          some: {
            id,
          },
        },
      },
    });

    const currentPermissionIds = currentPermissions.map((p) => p.id);

    // Disconnect removed permissions
    const permissionsToRemove = currentPermissionIds.filter(
      (pId) => !permissionIds.includes(pId)
    );

    if (permissionsToRemove.length > 0) {
      await prisma.role.update({
        where: { id },
        data: {
          permissions: {
            disconnect: permissionsToRemove.map((id) => ({ id })),
          },
        },
      });
    }

    const permissionsToAdd = permissionIds.filter(
      (pId) => !currentPermissionIds.includes(pId)
    );

    if (permissionsToAdd.length > 0) {
      await prisma.role.update({
        where: { id },
        data: {
          permissions: {
            connect: permissionsToAdd.map((id) => ({ id })),
          },
        },
      });
    }

    return await prisma.role.findUnique({
      where: { id },
      include: {
        permissions: true,
      },
    });
  }

  return updatedRole;
};

/**
 * Delete a role
 * @param {String} id - Role ID
 * @returns {Object} Deleted role
 */
const deleteRole = async (id) => {
  const existingRole = await prisma.role.findUnique({
    where: { id },
    include: {
      users: true,
    },
  });

  if (!existingRole) {
    throw new Error("Role not found");
  }

  if (existingRole.users.length > 0) {
    throw new Error("Cannot delete role with assigned users");
  }

  return await prisma.role.delete({
    where: { id },
  });
};

/**
 * Create a new permission
 * @param {Object} permissionData - Permission data
 * @returns {Object} Newly created permission
 */
const createPermission = async (permissionData) => {
  const { name, description } = permissionData;

  // Check if permission already exists
  const existingPermission = await prisma.permission.findUnique({
    where: { name },
  });

  if (existingPermission) {
    throw new Error("Permission with this name already exists");
  }

  // Create permission
  return await prisma.permission.create({
    data: {
      name,
      description,
    },
  });
};

/**
 * Get all permissions
 * @returns {Array} List of permissions
 */
const getAllPermissions = async () => {
  return await prisma.permission.findMany({
    include: {
      roles: true,
    },
  });
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
