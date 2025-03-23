const app = require("./src/app");
const config = require("./src/config/config");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const PORT = config.server.port;

const initializeDatabase = async () => {
  try {
    const allDefinedPermissions = [
      {
        name: "manage_roles",
        description: "Create, update and delete roles",
      },
      {
        name: "manage_users",
        description: "Create, update and delete users",
      },
      {
        name: "manage_menus",
        description: "Create, update and delete menus",
      },
      {
        name: "manage_meals",
        description: "Create, update and delete meals",
      },
      {
        name: "manage_requests",
        description: "Manage, update, and delete meal requests",
      },
      {
        name: "approve_meal_requests",
        description: "Approve or reject meal requests",
      },
      {
        name: "view_all_requests",
        description: "View all meal requests in the system",
      },
      {
        name: "manage_devices",
        description: "Manage ESSL devices",
      },
      {
        name: "view_logs",
        description: "View device logs",
      },
      {
        name: "view_reports",
        description: "View system reports",
      },
    ];

    const existingPermissions = await prisma.permission.findMany();
    const existingPermissionNames = existingPermissions.map((p) => p.name);

    const permissionsToCreate = allDefinedPermissions.filter(
      (p) => !existingPermissionNames.includes(p.name)
    );

    let superAdminRole = await prisma.role.findUnique({
      where: { name: "Super Admin" },
      include: { permissions: true },
    });

    let newlyCreatedPermissions = [];
    if (permissionsToCreate.length > 0) {
      console.log(`Creating ${permissionsToCreate.length} new permissions...`);

      newlyCreatedPermissions = await Promise.all(
        permissionsToCreate.map(async (permission) => {
          return await prisma.permission.create({
            data: permission,
          });
        })
      );

      console.log("New permissions created successfully");
    }

    // Sync permissions with Super Admin role if it exists
    if (superAdminRole) {
      // Get all permission IDs that the Super Admin should have
      const allPermissions = [
        ...existingPermissions,
        ...newlyCreatedPermissions,
      ];

      // Calculate which permissions need to be added to the Super Admin role
      const superAdminPermissionIds = superAdminRole.permissions.map(
        (p) => p.id
      );
      const permissionsToAdd = allPermissions.filter(
        (p) => !superAdminPermissionIds.includes(p.id)
      );

      // Add missing permissions to Super Admin
      if (permissionsToAdd.length > 0) {
        console.log(
          `Adding ${permissionsToAdd.length} permissions to Super Admin role...`
        );

        await prisma.role.update({
          where: { id: superAdminRole.id },
          data: {
            permissions: {
              connect: permissionsToAdd.map((p) => ({ id: p.id })),
            },
          },
        });

        console.log("Super Admin role updated with all permissions");
      }
    } else {
      console.log("Creating default roles and permissions...");

      const allPermissions = await prisma.permission.findMany();

      const roles = [
        {
          name: "Super Admin",
          description: "Full system access",
          permissions: {
            connect: allPermissions.map((p) => ({ id: p.id })),
          },
        },
        {
          name: "Manager",
          description: "Can manage and approve meal requests",
          permissions: {
            connect: allPermissions
              .filter((p) =>
                [
                  "manage_requests",
                  "approve_meal_requests",
                  "view_all_requests",
                  "view_reports",
                  "manage_devices",
                  "view_logs",
                ].includes(p.name)
              )
              .map((p) => ({ id: p.id })),
          },
        },
        {
          name: "Approver",
          description: "Can approve meal requests",
          permissions: {
            connect: allPermissions
              .filter((p) =>
                [
                  "approve_meal_requests",
                  "view_all_requests",
                  "view_reports",
                ].includes(p.name)
              )
              .map((p) => ({ id: p.id })),
          },
        },
        {
          name: "Employee",
          description: "Regular employee",
          permissions: { connect: [] },
        },
      ];

      await Promise.all(
        roles.map(async (role) => {
          return await prisma.role.create({
            data: role,
          });
        })
      );

      console.log("Default roles and permissions created successfully");

      superAdminRole = await prisma.role.findUnique({
        where: { name: "Super Admin" },
      });
    }

    const superAdminUser = await prisma.user.findFirst({
      where: {
        role: {
          name: "Super Admin",
        },
      },
    });

    if (!superAdminUser && superAdminRole) {
      const bcrypt = require("bcrypt");
      const hashedPassword = await bcrypt.hash("admin123", 10);

      await prisma.user.create({
        data: {
          email: "admin@canteen.com",
          password: hashedPassword,
          firstName: "Super",
          lastName: "Admin",
          roleId: superAdminRole.id,
        },
      });

      console.log("Default super admin user created successfully");
    }
  } catch (error) {
    console.error("Error initializing database:", error);
  }
};

const startServer = async () => {
  try {
    await prisma.$connect();
    console.log("Connected to database");

    await initializeDatabase();

    app.listen(PORT, () => {
      console.log(
        `Server running in ${config.server.env} mode on port ${PORT}`
      );
      console.log(
        `API available at http://localhost:${PORT}${config.server.apiPrefix}`
      );
    });
  } catch (error) {
    console.error("Unable to start server:", error);
    process.exit(1);
  }
};

process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION:", err);
  process.exit(1);
});

startServer();
