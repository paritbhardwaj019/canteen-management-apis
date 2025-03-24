const app = require("./src/app");
const config = require("./src/config/config");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

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
        name: "manage_plants",
        description: "Create, update and delete plants",
      },
      {
        name: "manage_plant_users",
        description: "Assign users to plants",
      },
      {
        name: "view_plants",
        description: "View plant information",
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
    const allDefinedRoles = [
      {
        name: "Super Admin",
        description: "Full system access with all permissions",
      },
      {
        name: "Plant Head",
        description: "Manages a specific plant and its operations",
      },
      {
        name: "HR",
        description: "Handles employee management and visitor registration",
      },
      {
        name: "Caterer",
        description: "Manages canteen operations and meal approvals",
      },
      {
        name: "Employee",
        description: "Regular employee with basic access rights",
      },
      {
        name: "Visitor",
        description: "Temporary visitor access",
      },
    ];

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

    const allPermissions = [...existingPermissions, ...newlyCreatedPermissions];

    const existingRoles = await prisma.role.findMany();
    const existingRoleNames = existingRoles.map((r) => r.name);

    const rolePermissionMap = {
      "Super Admin": allPermissions.map((p) => ({ id: p.id })),
      "Plant Head": allPermissions
        .filter((p) =>
          [
            "view_plants",
            "manage_plant_users",
            "manage_users",
            "manage_meals",
            "manage_requests",
            "approve_meal_requests",
            "view_all_requests",
            "view_reports",
            "manage_devices",
            "view_logs",
            "manage_visitors",
            "approve_visitors",
            "view_visitors",
            "view_visitor_records",
          ].includes(p.name)
        )
        .map((p) => ({ id: p.id })),
      HR: allPermissions
        .filter((p) =>
          [
            "manage_users",
            "view_plants",
            "view_logs",
            "view_reports",
            "view_all_requests",
            "register_visitor",
            "view_visitors",
            "view_visitor_records",
            "view_visitor_status",
          ].includes(p.name)
        )
        .map((p) => ({ id: p.id })),
      Caterer: allPermissions
        .filter((p) =>
          [
            "manage_meals",
            "view_reports",
            "approve_meal_requests",
            "view_all_requests",
          ].includes(p.name)
        )
        .map((p) => ({ id: p.id })),
      Employee: allPermissions
        .filter((p) =>
          ["register_visitor", "view_visitor_status"].includes(p.name)
        )
        .map((p) => ({ id: p.id })),
      Visitor: [],
    };

    const rolesToCreate = allDefinedRoles.filter(
      (r) => !existingRoleNames.includes(r.name)
    );

    if (rolesToCreate.length > 0) {
      console.log(`Creating ${rolesToCreate.length} missing roles...`);

      await Promise.all(
        rolesToCreate.map(async (role) => {
          const permissions = rolePermissionMap[role.name] || [];
          return await prisma.role.create({
            data: {
              name: role.name,
              description: role.description,
              isPlantRole: ["Plant Head", "HR", "Caterer", "Employee"].includes(
                role.name
              ),
              permissions: {
                connect: permissions,
              },
            },
          });
        })
      );

      console.log("Missing roles created successfully");
    } else {
      console.log("Updating existing roles with current permissions...");

      for (const roleName of Object.keys(rolePermissionMap)) {
        const role = existingRoles.find((r) => r.name === roleName);
        if (role) {
          const roleWithPerms = await prisma.role.findUnique({
            where: { id: role.id },
            include: { permissions: true },
          });

          const currentPermIds = roleWithPerms.permissions.map((p) => p.id);
          const targetPermIds = rolePermissionMap[roleName].map((p) => p.id);

          const permsToAdd = targetPermIds.filter(
            (id) => !currentPermIds.includes(id)
          );
          const permsToRemove = currentPermIds.filter(
            (id) => !targetPermIds.includes(id)
          );

          if (permsToAdd.length > 0) {
            await prisma.role.update({
              where: { id: role.id },
              data: {
                permissions: {
                  connect: permsToAdd.map((id) => ({ id })),
                },
              },
            });
          }

          if (permsToRemove.length > 0) {
            await prisma.role.update({
              where: { id: role.id },
              data: {
                permissions: {
                  disconnect: permsToRemove.map((id) => ({ id })),
                },
              },
            });
          }
        }
      }
    }

    const superAdminRole = await prisma.role.findUnique({
      where: { name: "Super Admin" },
    });

    if (superAdminRole) {
      const superAdminExists = await prisma.user.findFirst({
        where: {
          roleId: superAdminRole.id,
        },
      });

      if (!superAdminExists) {
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
