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
      {
        name: "manage_visitors",
        description: "Create, update and delete visitor information",
      },
      {
        name: "approve_visitors",
        description: "Approve or reject visitor requests",
      },
      {
        name: "view_visitors",
        description: "View visitor requests and information",
      },
      {
        name: "register_visitor",
        description: "Register new visitor requests",
      },
      {
        name: "process_visitor",
        description: "Process visitor requests status changes",
      },
      {
        name: "handle_visitor_entry",
        description: "Handle physical entry of visitors to premises",
      },
      {
        name: "view_visitor_records",
        description: "Access and view historical visitor records",
      },
      {
        name: "view_visitor_status",
        description: "Check status of visitor tickets",
      },
    ];

    // Define all roles that should exist in the system
    const allDefinedRoles = [
      {
        name: "Super Admin",
        description: "Full system access",
      },
      {
        name: "Manager",
        description: "Can manage and approve meal requests",
      },
      {
        name: "Approver",
        description: "Can approve meal requests",
      },
      {
        name: "Employee",
        description: "Regular employee",
      },
      {
        name: "Visitor",
        description: "Visitor access",
      },
    ];

    // Check and create missing permissions
    const existingPermissions = await prisma.permission.findMany();
    const existingPermissionNames = existingPermissions.map((p) => p.name);

    const permissionsToCreate = allDefinedPermissions.filter(
      (p) => !existingPermissionNames.includes(p.name)
    );

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

    // Get all available permissions after creation
    const allPermissions = [...existingPermissions, ...newlyCreatedPermissions];

    // Check for existing roles
    const existingRoles = await prisma.role.findMany();
    const existingRoleNames = existingRoles.map((r) => r.name);

    // Filter roles that need to be created
    const rolesToCreate = allDefinedRoles.filter(
      (r) => !existingRoleNames.includes(r.name)
    );

    if (rolesToCreate.length > 0) {
      console.log(`Creating ${rolesToCreate.length} missing roles...`);

      // Role permission mappings
      const rolePermissionMap = {
        "Super Admin": allPermissions.map((p) => ({ id: p.id })),
        Manager: allPermissions
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
        Approver: allPermissions
          .filter((p) =>
            [
              "approve_meal_requests",
              "view_all_requests",
              "view_reports",
            ].includes(p.name)
          )
          .map((p) => ({ id: p.id })),
        Employee: [],
        Visitor: [],
      };

      // Create each missing role with appropriate permissions
      await Promise.all(
        rolesToCreate.map(async (role) => {
          const permissions = rolePermissionMap[role.name] || [];
          return await prisma.role.create({
            data: {
              name: role.name,
              description: role.description,
              permissions: {
                connect: permissions,
              },
            },
          });
        })
      );

      console.log("Missing roles created successfully");
    }

    // Update Super Admin role with any new permissions
    let superAdminRole = await prisma.role.findUnique({
      where: { name: "Super Admin" },
      include: { permissions: true },
    });

    if (superAdminRole) {
      const superAdminPermissionIds = superAdminRole.permissions.map(
        (p) => p.id
      );
      const permissionsToAdd = allPermissions.filter(
        (p) => !superAdminPermissionIds.includes(p.id)
      );

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
    }

    // Create super admin user if doesn't exist
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
