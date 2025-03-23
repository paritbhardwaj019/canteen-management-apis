const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { notFound, conflict } = require("../utils/api.error");

const createPermission = async (permissionData) => {
  const { name, description } = permissionData;

  const existingPermission = await prisma.permission.findUnique({
    where: { name },
  });

  if (existingPermission) {
    throw conflict("Permission with this name already exists");
  }

  return await prisma.permission.create({
    data: {
      name,
      description,
    },
  });
};

const getAllPermissions = async () => {
  return await prisma.permission.findMany({
    orderBy: {
      name: "asc",
    },
  });
};

const getPermissionById = async (id) => {
  const permission = await prisma.permission.findUnique({
    where: { id },
    include: {
      roles: {
        select: {
          id: true,
          name: true,
          description: true,
        },
      },
    },
  });

  if (!permission) {
    throw notFound("Permission not found");
  }

  return permission;
};

const updatePermission = async (id, permissionData) => {
  const { name, description } = permissionData;

  const existingPermission = await prisma.permission.findUnique({
    where: { id },
  });

  if (!existingPermission) {
    throw notFound("Permission not found");
  }

  if (name && name !== existingPermission.name) {
    const permissionWithSameName = await prisma.permission.findUnique({
      where: { name },
    });

    if (permissionWithSameName) {
      throw conflict("Permission with this name already exists");
    }
  }

  return await prisma.permission.update({
    where: { id },
    data: {
      name,
      description,
    },
  });
};

const deletePermission = async (id) => {
  const existingPermission = await prisma.permission.findUnique({
    where: { id },
    include: {
      roles: true,
    },
  });

  if (!existingPermission) {
    throw notFound("Permission not found");
  }

  if (existingPermission.roles.length > 0) {
    throw conflict("Cannot delete permission that is assigned to roles");
  }

  return await prisma.permission.delete({
    where: { id },
  });
};

const assignPermissionsToRole = async (roleId, permissionIds) => {
  const role = await prisma.role.findUnique({
    where: { id: roleId },
  });

  if (!role) {
    throw notFound("Role not found");
  }

  const existingPermissions = await prisma.permission.findMany({
    where: {
      id: {
        in: permissionIds,
      },
    },
  });

  if (existingPermissions.length !== permissionIds.length) {
    throw notFound("One or more permissions not found");
  }

  return await prisma.role.update({
    where: { id: roleId },
    data: {
      permissions: {
        connect: permissionIds.map((id) => ({ id })),
      },
    },
    include: {
      permissions: true,
    },
  });
};

const removePermissionsFromRole = async (roleId, permissionIds) => {
  const role = await prisma.role.findUnique({
    where: { id: roleId },
  });

  if (!role) {
    throw notFound("Role not found");
  }

  return await prisma.role.update({
    where: { id: roleId },
    data: {
      permissions: {
        disconnect: permissionIds.map((id) => ({ id })),
      },
    },
    include: {
      permissions: true,
    },
  });
};

module.exports = {
  createPermission,
  getAllPermissions,
  getPermissionById,
  updatePermission,
  deletePermission,
  assignPermissionsToRole,
  removePermissionsFromRole,
};
