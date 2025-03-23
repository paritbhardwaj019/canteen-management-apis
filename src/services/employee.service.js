const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const bcrypt = require("bcrypt");
const { notFound, conflict, badRequest } = require("../utils/api.error");
const { deleteFile } = require("../middlewares/upload.middleware");

/**
 * Create a new employee
 * @param {Object} employeeData - Employee data
 * @returns {Object} Newly created employee
 */
const createEmployee = async (employeeData) => {
  const {
    email,
    firstName,
    lastName,
    employeeNo,
    department,
    designation,
    photoUrl,
    password,
  } = employeeData;

  const existingEmployee = await prisma.employee.findUnique({
    where: { employeeNo },
  });

  if (existingEmployee) {
    throw conflict(
      `Employee with employee number ${employeeNo} already exists`
    );
  }

  const result = await prisma.$transaction(async (prisma) => {
    const employeeRole = await prisma.role.findFirst({
      where: { name: "Employee" },
    });

    if (!employeeRole) {
      throw badRequest("Employee role not found");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email: email,
        password: hashedPassword,
        firstName,
        lastName,
        roleId: employeeRole.id,
        department,
        isActive: true,
      },
    });

    const employee = await prisma.employee.create({
      data: {
        userId: user.id,
        employeeNo,
        email,
        department,
        designation,
        ...(photoUrl && {
          photos: {
            create: [{ url: photoUrl }],
          },
        }),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            department: true,
            isActive: true,
            role: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        photos: true,
      },
    });

    return { employee, user };
  });

  return {
    id: result.employee.id,
    userId: result.user.id,
    employeeNo: result.employee.employeeNo,
    firstName: result.user.firstName,
    lastName: result.user.lastName,
    email: result.employee.email || result.user.email,
    department: result.employee.department || result.user.department,
    designation: result.employee.designation,
    isActive: result.user.isActive,
    photos: result.employee.photos,
    createdAt: result.employee.createdAt,
  };
};

/**
 * Add a photo to an employee
 * @param {String} employeeId - Employee ID
 * @param {String} photoUrl - URL of the uploaded photo
 * @returns {Object} Added photo information
 */
const addEmployeePhoto = async (employeeId, photoUrl) => {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
  });

  if (!employee) {
    throw notFound("Employee not found");
  }

  const photo = await prisma.employeePhoto.create({
    data: {
      url: photoUrl,
      employeeId: employee.id,
    },
  });

  return photo;
};

/**
 * Get all employees with pagination and filtering
 * @param {Object} options - Filter and pagination options
 * @returns {Object} Paginated list of employees and total count
 */
const getAllEmployees = async (options) => {
  const {
    page = 1,
    limit = 10,
    search,
    department,
    includePhotos = false,
  } = options;

  const skip = (page - 1) * limit;

  const where = {};

  if (search) {
    where.OR = [
      { user: { firstName: { contains: search } } },
      { user: { lastName: { contains: search } } },
      { employeeNo: { contains: search } },
      { email: { contains: search } },
    ];
  }

  if (department) {
    where.OR = [
      { department: { contains: department } },
      { user: { department: { contains: department } } },
    ];
  }

  // Count total employees matching criteria
  const totalCount = await prisma.employee.count({ where });

  // Get employees with pagination
  const employees = await prisma.employee.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          department: true,
          isActive: true,
          plant: {
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
            },
          },
        },
      },
      ...(includePhotos && { photos: true }),
    },
    skip,
    take: limit,
    orderBy: { employeeNo: "asc" },
  });

  // Define table columns
  const columns = [
    { field: "employeeNo", headerName: "Employee No.", width: 150 },
    { field: "name", headerName: "Name", width: 180 },
    { field: "email", headerName: "Email", width: 200 },
    { field: "department", headerName: "Department", width: 150 },
    { field: "designation", headerName: "Designation", width: 150 },
    { field: "status", headerName: "Status", width: 100 },
    { field: "plant", headerName: "Plant", width: 150 },
    { field: "role", headerName: "Role", width: 120 },
    { field: "createdAt", headerName: "Created At", width: 180 },
  ];

  const formattedEmployees = employees.map((employee) => ({
    id: employee.id,
    userId: employee.userId,
    employeeNo: employee.employeeNo,
    name: `${employee.user.firstName} ${employee.user.lastName}`,
    firstName: employee.user.firstName,
    lastName: employee.user.lastName,
    email: employee.email || employee.user.email,
    department: employee.department || employee.user.department,
    designation: employee.designation || "",
    status: employee.user.isActive ? "Active" : "Inactive",
    isActive: employee.user.isActive,
    plant: employee.user.plant ? employee.user.plant.name : "",
    plantId: employee.user.plant?.id,
    plantCode: employee.user.plant?.plantCode,
    role: employee.user.role.name,
    roleId: employee.user.role.id,
    isEsslRegistered: employee.isEsslRegistered,
    ...(includePhotos && { photos: employee.photos }),
    createdAt: employee.createdAt.toISOString(),
  }));

  return {
    employees: formattedEmployees,
    columns: columns,
    page,
    limit,
    totalPages: Math.ceil(totalCount / limit),
    totalItems: totalCount,
  };
};

/**
 * Get employee by ID
 * @param {String} id - Employee ID
 * @param {Boolean} includePhotos - Whether to include employee photos
 * @returns {Object} Employee data
 */
const getEmployeeById = async (id, includePhotos = false) => {
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          department: true,
          isActive: true,
          role: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      ...(includePhotos && { photos: true }),
    },
  });

  if (!employee) {
    throw notFound("Employee not found");
  }

  return {
    id: employee.id,
    userId: employee.userId,
    employeeNo: employee.employeeNo,
    firstName: employee.user.firstName,
    lastName: employee.user.lastName,
    email: employee.email || employee.user.email,
    department: employee.department || employee.user.department,
    designation: employee.designation,
    isActive: employee.user.isActive,
    isEsslRegistered: employee.isEsslRegistered,
    ...(includePhotos && { photos: employee.photos }),
    createdAt: employee.createdAt,
    updatedAt: employee.updatedAt,
  };
};

/**
 * Get employee by employee number
 * @param {String} employeeNo - Employee number
 * @returns {Object} Employee data
 */
const getEmployeeByEmployeeNo = async (employeeNo) => {
  const employee = await prisma.employee.findUnique({
    where: { employeeNo },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          department: true,
          isActive: true,
        },
      },
    },
  });

  if (!employee) {
    return null;
  }

  return {
    id: employee.id,
    userId: employee.userId,
    employeeNo: employee.employeeNo,
    firstName: employee.user.firstName,
    lastName: employee.user.lastName,
    email: employee.email || employee.user.email,
    department: employee.department || employee.user.department,
    designation: employee.designation,
    isActive: employee.user.isActive,
    isEsslRegistered: employee.isEsslRegistered,
  };
};

/**
 * Update an employee
 * @param {String} id - Employee ID
 * @param {Object} employeeData - Employee data to update
 * @returns {Object} Updated employee
 */
const updateEmployee = async (id, employeeData) => {
  const {
    email,
    firstName,
    lastName,
    employeeNo,
    department,
    designation,
    isActive,
    isEsslRegistered,
  } = employeeData;

  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      user: true,
    },
  });

  if (!employee) {
    throw notFound("Employee not found");
  }

  // If changing employee number, check if it's unique
  if (employeeNo && employeeNo !== employee.employeeNo) {
    const existingEmployee = await prisma.employee.findUnique({
      where: { employeeNo },
    });

    if (existingEmployee) {
      throw conflict(
        `Employee with employee number ${employeeNo} already exists`
      );
    }
  }

  // Update user and employee in transaction
  const result = await prisma.$transaction(async (prisma) => {
    // Update user information
    const user = await prisma.user.update({
      where: { id: employee.userId },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(email && { email }),
        ...(department && { department }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        role: true,
      },
    });

    // Update employee information
    const updatedEmployee = await prisma.employee.update({
      where: { id },
      data: {
        ...(employeeNo && { employeeNo }),
        ...(email && { email }),
        ...(department && { department }),
        ...(designation && { designation }),
        ...(isEsslRegistered !== undefined && { isEsslRegistered }),
      },
      include: {
        photos: true,
      },
    });

    return { employee: updatedEmployee, user };
  });

  return {
    id: result.employee.id,
    userId: result.user.id,
    employeeNo: result.employee.employeeNo,
    firstName: result.user.firstName,
    lastName: result.user.lastName,
    email: result.employee.email || result.user.email,
    department: result.employee.department || result.user.department,
    designation: result.employee.designation,
    isActive: result.user.isActive,
    isEsslRegistered: result.employee.isEsslRegistered,
    photos: result.employee.photos,
    updatedAt: result.employee.updatedAt,
  };
};

/**
 * Delete an employee
 * @param {String} id - Employee ID
 * @returns {Boolean} Success status
 */
const deleteEmployee = async (id) => {
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      photos: true,
    },
  });

  if (!employee) {
    throw notFound("Employee not found");
  }

  // Delete all photos from cloudinary
  if (employee.photos && employee.photos.length > 0) {
    for (const photo of employee.photos) {
      // Extract public_id from the URL
      const urlParts = photo.url.split("/");
      const filenameWithExt = urlParts[urlParts.length - 1];
      const filename = filenameWithExt.split(".")[0];
      const folderPath = urlParts
        .slice(urlParts.indexOf("canteen-management"))
        .join("/");
      const publicId = folderPath.substring(0, folderPath.lastIndexOf("."));

      await deleteFile(publicId);
    }
  }

  await prisma.$transaction([
    prisma.employeePhoto.deleteMany({
      where: { employeeId: id },
    }),

    prisma.employee.delete({
      where: { id },
    }),

    prisma.user.delete({
      where: { id: employee.userId },
    }),
  ]);

  return true;
};

/**
 * Delete an employee photo
 * @param {String} employeeId - Employee ID
 * @param {String} photoId - Photo ID
 * @returns {Boolean} Success status
 */
const deleteEmployeePhoto = async (employeeId, photoId) => {
  const photo = await prisma.employeePhoto.findFirst({
    where: {
      id: photoId,
      employeeId,
    },
  });

  if (!photo) {
    throw notFound(
      "Photo not found or doesn't belong to the specified employee"
    );
  }

  // Extract public_id from the URL
  const urlParts = photo.url.split("/");
  const filenameWithExt = urlParts[urlParts.length - 1];
  const filename = filenameWithExt.split(".")[0];
  const folderPath = urlParts
    .slice(urlParts.indexOf("canteen-management"))
    .join("/");
  const publicId = folderPath.substring(0, folderPath.lastIndexOf("."));

  // Delete file from Cloudinary
  await deleteFile(publicId);

  // Delete photo record from database
  await prisma.employeePhoto.delete({
    where: { id: photoId },
  });

  return true;
};

/**
 * Get employees by department
 * @param {String} department - Department name
 * @param {Number} page - Page number
 * @param {Number} limit - Items per page
 * @returns {Object} Paginated list of employees and total count
 */
const getEmployeesByDepartment = async (department, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;

  if (!department) {
    throw badRequest("Department is required");
  }

  const where = {
    OR: [
      { department: { contains: department } },
      { user: { department: { contains: department } } },
    ],
  };

  const totalCount = await prisma.employee.count({ where });

  const employees = await prisma.employee.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          department: true,
          isActive: true,
        },
      },
      photos: {
        take: 1, // Just get the first photo
      },
    },
    skip,
    take: limit,
    orderBy: { employeeNo: "asc" },
  });

  // Format employee data
  const formattedEmployees = employees.map((employee) => ({
    id: employee.id,
    userId: employee.userId,
    employeeNo: employee.employeeNo,
    firstName: employee.user.firstName,
    lastName: employee.user.lastName,
    email: employee.email || employee.user.email,
    department: employee.department || employee.user.department,
    designation: employee.designation,
    isActive: employee.user.isActive,
    photo: employee.photos.length > 0 ? employee.photos[0].url : null,
  }));

  return {
    employees: formattedEmployees,
    totalCount,
  };
};

/**
 * Reset an employee's password
 * @param {String} id - Employee ID
 * @returns {Object} Temporary password
 */
const resetEmployeePassword = async (id) => {
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      user: true,
    },
  });

  if (!employee) {
    throw notFound("Employee not found");
  }

  // Generate a temporary password
  const tempPassword = Math.random().toString(36).slice(-8); // 8 character random string
  const hashedPassword = await bcrypt.hash(tempPassword, 10);

  // Update user password
  await prisma.user.update({
    where: { id: employee.userId },
    data: {
      password: hashedPassword,
    },
  });

  return {
    employeeId: id,
    employeeNo: employee.employeeNo,
    firstName: employee.user.firstName,
    lastName: employee.user.lastName,
    tempPassword,
  };
};

/**
 * Get current user as employee
 * @param {String} userId - User ID from authentication
 * @returns {Object} Employee data
 */
const getCurrentEmployee = async (userId) => {
  const employee = await prisma.employee.findFirst({
    where: { userId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          department: true,
          isActive: true,
          role: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      photos: {
        take: 1, // Just get the first photo
      },
    },
  });

  if (!employee) {
    throw notFound("Employee profile not found for current user");
  }

  return {
    id: employee.id,
    userId: employee.userId,
    employeeNo: employee.employeeNo,
    firstName: employee.user.firstName,
    lastName: employee.user.lastName,
    email: employee.email || employee.user.email,
    department: employee.department || employee.user.department,
    designation: employee.designation,
    role: employee.user.role,
    isActive: employee.user.isActive,
    photo: employee.photos.length > 0 ? employee.photos[0].url : null,
  };
};

module.exports = {
  createEmployee,
  addEmployeePhoto,
  getAllEmployees,
  getEmployeeById,
  getEmployeeByEmployeeNo,
  updateEmployee,
  deleteEmployee,
  deleteEmployeePhoto,
  getEmployeesByDepartment,
  resetEmployeePassword,
  getCurrentEmployee,
};
