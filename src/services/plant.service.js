const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { notFound, conflict, badRequest } = require("../utils/api.error");
const bcrypt = require("bcrypt");

/**
 * Create a new plant
 * @param {Object} plantData - Plant data
 * @param {Object} loggedInUser - Currently logged in user
 * @returns {Object} Newly created plant
 */
const createPlant = async (plantData, loggedInUser) => {
  const existingPlant = await prisma.plant.findUnique({
    where: { plantCode: plantData.plantCode },
  });

  if (existingPlant) {
    throw badRequest("Plant with this code already exists");
  }

  const plant = await prisma.plant.create({
    data: {
      name: plantData.name,
      plantCode: plantData.plantCode,
      location: plantData.location,
      serialNumber: plantData.serialNumber,
      deviceName: plantData.deviceName,
      createdById: loggedInUser.id,
      updatedById: loggedInUser.id,
    },
  });

  return plant;
};
/**
 * Get all plants with optional filters
 * @param {Object} filter - Filter criteria
 * @param {Object} options - Pagination and sorting options
 * @param {Object} loggedInUser - Currently logged in user
 * @returns {Object} List of plants and metadata
 */
const getAllPlants = async (filter = {}, options = {}, loggedInUser) => {
  const page = options.page || 1;
  const limit = options.limit || 100;
  const skip = (page - 1) * limit;

  const where = {};
  if (filter.name) {
    where.name = { contains: filter.name };
  }
  if (filter.plantCode) {
    where.plantCode = { contains: filter.plantCode };
  }

  // If user is a Plant Head or has a specific role with limited access,
  // only show their assigned plant
  if (loggedInUser.role === "Plant Head" && loggedInUser.plantId) {
    where.id = loggedInUser.plantId;
  }

  const plants = await prisma.plant.findMany({
    where,
    skip,
    take: limit,
    orderBy: options.sortBy
      ? { [options.sortBy]: options.sortOrder || "asc" }
      : { createdAt: "desc" },
    include: {
      plantHead: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      users: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  const count = await prisma.plant.count({ where });

  // Define table columns
  const columns = [
    { field: "plantCode", headerName: "Plant Code", width: 150 },
    { field: "name", headerName: "Plant Name", width: 150 },
    { field: "location", headerName: "Location", width: 150 },
    { field: "deviceName", headerName: "Device Name", width: 150 },
    { field: "serialNumber", headerName: "Serial Number", width: 150 },
    { field: "plantHeadName", headerName: "Plant Head", width: 150 },
    { field: "userCount", headerName: "Users", width: 100 },
    { field: "createdAt", headerName: "Created At", width: 150 },
  ];

  const formattedPlants = plants.map((plant) => ({
    id: plant.id,
    plantCode: plant.plantCode,
    name: plant.name,
    location: plant.location || "",
    deviceName: plant.deviceName || "",
    serialNumber: plant.serialNumber || "",
    plantHeadName: plant.plantHead
      ? `${plant.plantHead.firstName} ${plant.plantHead.lastName}`
      : "",
    userCount: plant.users.length,
    createdAt: plant.createdAt.toISOString(),
    plantHead: plant.plantHead,
    users: plant.users,
    plantHeadId: plant.plantHeadId,
    updatedAt: plant.updatedAt,
    createdById: plant.createdById,
    updatedById: plant.updatedById,
  }));

  return {
    plants: formattedPlants,
    columns: columns,
    page,
    limit,
    totalPages: Math.ceil(count / limit),
    totalItems: count,
  };
};

/**
 * Get plant by ID
 * @param {String} id - Plant ID
 * @returns {Object} Plant data with plantHead and users
 */
const getPlantById = async (id) => {
  const plant = await prisma.plant.findUnique({
    where: { id },
    include: {
      plantHead: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      users: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: {
            select: {
              name: true,
            },
          },
        },
      },
      createdBy: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      updatedBy: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!plant) {
    throw notFound("Plant not found");
  }

  return plant;
};

/**
 * Update a plant
 * @param {String} id - Plant ID
 * @param {Object} plantData - Plant data to update
 * @param {Object} loggedInUser - Currently logged in user
 * @returns {Object} Updated plant
 */
const updatePlant = async (id, plantData, loggedInUser) => {
  const existingPlant = await prisma.plant.findUnique({
    where: { id },
  });

  if (!existingPlant) {
    throw notFound("Plant not found");
  }

  if (plantData.plantCode && plantData.plantCode !== existingPlant.plantCode) {
    const plantWithCode = await prisma.plant.findUnique({
      where: { plantCode: plantData.plantCode },
    });

    if (plantWithCode) {
      throw badRequest("Plant with this code already exists");
    }
  }

  let updateData = {
    name: plantData.name,
    plantCode: plantData.plantCode,
    location: plantData.location,
    serialNumber: plantData.serialNumber,
    deviceName: plantData.deviceName,
    updatedById: loggedInUser.id,
  };

  Object.keys(updateData).forEach((key) => {
    if (updateData[key] === undefined) {
      delete updateData[key];
    }
  });

  if (plantData.removePlantHead && existingPlant.plantHeadId) {
    await prisma.user.update({
      where: { id: existingPlant.plantHeadId },
      data: {
        isPlantHead: false,
      },
    });
    updateData.plantHeadId = null;
  }

  const updatedPlant = await prisma.plant.update({
    where: { id },
    data: updateData,
    include: {
      plantHead: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      users: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  return updatedPlant;
};

/**
 * Delete a plant
 * @param {String} id - Plant ID
 * @returns {Object} Deleted plant
 */
const deletePlant = async (id) => {
  const existingPlant = await prisma.plant.findUnique({
    where: { id },
    include: {
      users: true,
    },
  });

  if (!existingPlant) {
    throw notFound("Plant not found");
  }

  if (existingPlant.users.length > 0) {
    throw conflict(
      "Cannot delete plant with assigned users. Please remove all users first."
    );
  }

  if (existingPlant.plantHeadId) {
    await prisma.user.update({
      where: { id: existingPlant.plantHeadId },
      data: {
        isPlantHead: false,
      },
    });
  }

  const deletedPlant = await prisma.plant.delete({
    where: { id },
  });

  return deletedPlant;
};

/**
 * Add user to plant with optional plant head assignment
 * @param {Object} userData - User data with plant assignment info
 * @param {Object} loggedInUser - Currently logged in user
 * @returns {Object} User with updated plant assignment
 */
const addUserToPlant = async (userData, loggedInUser) => {
  let {
    firstName,
    lastName,
    email,
    password,
    department,
    role,
    plantId,
    isPlantHead,
  } = userData;

  const userRole = await prisma.role.findUnique({
    where: { name: role },
  });

  if (!userRole) {
    throw badRequest(`Role '${role}' not found`);
  }

  if (!plantId) {
    const plant = await prisma.plant.findUnique({
      where: {
        plantHeadId: loggedInUser.id,
      },
    });

    plantId = plant?.id;
  }

  if (plantId) {
    const plant = await prisma.plant.findUnique({
      where: { id: plantId },
    });

    if (!plant) {
      throw notFound("Plant not found");
    }
  }

  let user = await prisma.user.findUnique({
    where: { email },
  });

  const transaction = [];

  if (user) {
    if (user.plantId && user.plantId !== plantId) {
      throw conflict("User is already assigned to another plant");
    }

    const updateData = {
      firstName,
      lastName,
      department,
      plantId,
      isPlantHead: isPlantHead || false,
    };

    if (userRole) {
      updateData.roleId = userRole.id;
    }

    transaction.push(
      prisma.user.update({
        where: { id: user.id },
        data: updateData,
      })
    );
  } else {
    const hashedPassword = await bcrypt.hash(password, 10);

    transaction.push(
      prisma.user.create({
        data: {
          firstName,
          lastName,
          email,
          password: hashedPassword,
          department,
          roleId: userRole.id,
          plantId,
          isPlantHead: isPlantHead || false,
        },
      })
    );
  }

  if (isPlantHead && plantId) {
    const plant = await prisma.plant.findUnique({
      where: { id: plantId },
      include: { plantHead: true },
    });

    if (plant && plant.plantHeadId && plant.plantHeadId !== user?.id) {
      transaction.push(
        prisma.user.update({
          where: { id: plant.plantHeadId },
          data: { isPlantHead: false },
        })
      );
    }

    transaction.push(
      prisma.plant.update({
        where: { id: plantId },
        data: {
          plantHeadId: user ? user.id : undefined,
          updatedById: loggedInUser.id,
        },
      })
    );
  }

  const results = await prisma.$transaction(transaction);

  const userResult = results.find((result) => result.email === email);

  if (!user && isPlantHead && plantId && userResult) {
    await prisma.plant.update({
      where: { id: plantId },
      data: { plantHeadId: userResult.id },
    });
  }

  return await prisma.user.findUnique({
    where: { id: userResult.id },
    include: {
      role: {
        select: {
          id: true,
          name: true,
        },
      },
      plant: {
        select: {
          id: true,
          name: true,
          plantCode: true,
        },
      },
    },
  });
};

/**
 * Remove user from plant
 * @param {String} plantId - Plant ID
 * @param {String} userId - User ID
 * @param {Object} loggedInUser - Currently logged in user
 * @returns {Object} User with updated plant assignment
 */
const removeUserFromPlant = async (plantId, userId, loggedInUser) => {
  // Check if plant exists
  const plant = await prisma.plant.findUnique({
    where: { id: plantId },
  });

  if (!plant) {
    throw notFound("Plant not found");
  }

  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw notFound("User not found");
  }

  // Check if user is assigned to this plant
  if (user.plantId !== plantId) {
    throw badRequest("User is not assigned to this plant");
  }

  // Prepare transaction actions
  const transaction = [];

  // If user is plant head, update the plant to remove the plant head
  if (plant.plantHeadId === userId) {
    transaction.push(
      prisma.plant.update({
        where: { id: plantId },
        data: {
          plantHeadId: null,
          updatedById: loggedInUser.id,
        },
      })
    );
  }

  // Update user to remove plant assignment and plant head status
  transaction.push(
    prisma.user.update({
      where: { id: userId },
      data: {
        plantId: null,
        isPlantHead: false,
      },
    })
  );

  // Execute transaction
  const [updatedUser] = await prisma.$transaction(transaction);

  return updatedUser;
};

/**
 * Get available users for assignment to plant
 * @param {String} plantId - Plant ID to exclude its current users
 * @returns {Array} List of users not currently assigned to the plant
 */
const getAvailableUsers = async (plantId) => {
  const users = await prisma.user.findMany({
    where: {
      OR: [{ plantId: null }, { plantId: { not: plantId } }],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      department: true,
      isPlantHead: true,
      role: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      firstName: "asc",
    },
  });

  return users;
};

/**
 * Get users assigned to a plant
 * @param {String} plantId - Plant ID
 * @returns {Object} Plant with its users
 */
const getPlantUsers = async (plantId) => {
  const plant = await prisma.plant.findUnique({
    where: { id: plantId },
    select: {
      id: true,
      name: true,
      plantCode: true,
      location: true,
      plantHeadId: true,
      users: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          department: true,
          isPlantHead: true,
          createdAt: true,
          role: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!plant) {
    throw notFound("Plant not found");
  }

  const formattedUsers = plant.users.map((user) => ({
    id: user.id,
    plantName: plant.name,
    name: `${user.firstName} ${user.lastName}`,
    email: user.email,
    role: user.role.name,
    department: user.department || "",
    isPlantHead: user.isPlantHead ? "Yes" : "No",
    dateRegistered: user.createdAt.toISOString(),
    createdAt: user.createdAt.toISOString(),
  }));

  const columns = [
    { field: "plantName", headerName: "Plant", width: 150 },
    { field: "name", headerName: "Name", width: 150 },
    { field: "email", headerName: "Email", width: 200 },
    { field: "role", headerName: "Role", width: 150 },
    { field: "department", headerName: "Department", width: 150 },
    { field: "isPlantHead", headerName: "Plant Head", width: 100 },
    { field: "dateRegistered", headerName: "Date Registered", width: 150 },
    { field: "createdAt", headerName: "Created At", width: 150 },
  ];

  return {
    plant: {
      id: plant.id,
      name: plant.name,
      plantCode: plant.plantCode,
      location: plant.location,
      plantHeadId: plant.plantHeadId,
    },
    users: formattedUsers,
    columns: columns,
  };
};





module.exports = {
  createPlant,
  getAllPlants,
  getPlantById,
  updatePlant,
  deletePlant,
  addUserToPlant,
  removeUserFromPlant,
  getAvailableUsers,
  getPlantUsers,
};
