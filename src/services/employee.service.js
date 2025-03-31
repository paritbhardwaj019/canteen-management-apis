const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const bcrypt = require("bcrypt");
const {
  notFound,
  conflict,
  badRequest,
  serverError,
} = require("../utils/api.error");
const { deleteFile } = require("../middlewares/upload.middleware");
const esslService = require("./essl.service");
const config = require("../config/config");

/**
 * Get employee columns for data table
 * @param {String} userRole - User role for conditional columns
 * @returns {Array} Array of column definitions
 */
const getEmployeeColumns = (userRole) => {
  const baseColumns = [
    { field: "employeeNo", headerName: "Employee No.", width: 150 },
    { field: "name", headerName: "Name", width: 180 },
    { field: "email", headerName: "Email", width: 200 },
    { field: "department", headerName: "Department", width: 150 },
    { field: "designation", headerName: "Designation", width: 150 },
    { field: "status", headerName: "Status", width: 100 },
    { field: "createdAt", headerName: "Created At", width: 180 },
  ];

  if (
    userRole === "Super Admin" ||
    userRole === "Manager" ||
    userRole === "HR"
  ) {
    baseColumns.push({
      field: "edit",
      headerName: "Edit",
      width: 80,
      renderCell: true,
    });
    baseColumns.push({
      field: "delete",
      headerName: "Delete",
      width: 80,
      renderCell: true,
    });
  }

  return baseColumns;
};

/**
 * Create a new employee
 * @param {Object} employeeData - Employee data
 * @param {Boolean} registerInEssl - Whether to register employee in ESSL system
 * @param {Object} esslOptions - ESSL registration options
 * @param {String} esslOptions.location - Employee location in ESSL
 * @param {String} esslOptions.role - Employee role in ESSL
 * @param {String} esslOptions.verificationType - Verification type in ESSL
 * @param {String} esslOptions.photoBase64 - Base64 encoded photo for ESSL
 * @returns {Object} Newly created employee
 */

const createEmployee = async (
  employeeData,
  registerInEssl = true,
  esslOptions = {}
) => {
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

  const {
    location = config.essl.deviceLocation,
    role = "Normal User",
    verificationType = "Finger or Face or Card or Password",
    photoBase64,
  } = esslOptions;

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
        code: employeeNo,
      },
    });

    const employee = await prisma.employee.create({
      data: {
        userId: user.id,
        employeeNo,
        email,
        department,
        designation,
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
      },
    });

    let photos = [];
    if (photoUrl) {
      const photo = await prisma.employeePhoto.create({
        data: {
          url: photoUrl,
          employeeId: employee.id,
        },
      });
      photos.push(photo);
    }

    return { employee, user, photos };
  });

  let esslRegistrationResult = null;
  let esslPhotoResult = null;

  if (registerInEssl || true) {
    try {
      esslRegistrationResult = await esslService.updateEmployee({
        employeeCode: result.employee.employeeNo,
        employeeName: `${result.user.firstName} ${result.user.lastName}`,
        employeeLocation: location,
        employeeRole: role,
        employeeVerificationType: verificationType,
      });

      let registrationSuccess =
        esslRegistrationResult && esslRegistrationResult.includes("success");

      if (registrationSuccess && photoBase64) {
        try {
          esslPhotoResult = await esslService.updateEmployeePhoto({
            employeeCode: result.employee.employeeNo,
            employeePhoto: photoBase64,
          });

          await new Promise((resolve) => setTimeout(resolve, 1000));

          console.log(
            "Calling updateEmployeeFaceInDevice after 1-second delay"
          );
          const faceResult = await esslService.updateEmployeeFaceInDevice({
            employeeCode: employeeNo,
            deviceSerialNumber: config.essl.deviceSerialNumber,
          });
          console.log("Face enrollment completed with result:", faceResult);

          await new Promise((resolve) => setTimeout(resolve, 1000));

          console.log("Calling resetOpstamp after 1-second delay");

          const resetResult = await esslService.resetOpstamp(
            config.essl.deviceSerialNumber
          );
          console.log("OpStamp reset completed with result:", resetResult);
        } catch (photoError) {
          console.error(
            "Failed to upload employee photo to ESSL system:",
            photoError
          );
        }
      }

      if (registrationSuccess) {
        await prisma.employee.update({
          where: { id: result.employee.id },
          data: { isEsslRegistered: true },
        });
        result.employee.isEsslRegistered = true;
      }
    } catch (error) {
      console.error("Failed to register employee in ESSL system:", error);
    }
  }

  const photoUrlValue =
    result.photos && result.photos.length > 0 ? result.photos[0].url : null;

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
    isEsslRegistered: result.employee.isEsslRegistered || false,
    photos: result.photos || [],
    photoUrl: photoUrlValue,
    createdAt: result.employee.createdAt,
    esslRegistrationResult: esslRegistrationResult,
    esslPhotoResult: esslPhotoResult,
  };
};

/**
 * Get all employees with pagination and filtering
 * @param {Object} options - Filter and pagination options
 * @returns {Object} Paginated list of employees and total count
 */
const getAllEmployees = async (options) => {
  const {
    page = 1,
    limit = 1000,
    search,
    department,
    includePhotos = false,
    userRole = "Employee",
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

  const totalCount = await prisma.employee.count({ where });
  where.user = { isActive: true };

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
      ...(includePhotos || { photos: true }),
    },
    skip,
    take: 1000,
    orderBy: { employeeNo: "asc" },
  });

  const columns = getEmployeeColumns(userRole);

  const formattedEmployees = employees.map((employee) => {
    const photoUrl =
      employee.photos && employee.photos.length > 0
        ? employee.photos[0].url
        : null;

    return {
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
      photoUrl: photoUrl,
      ...(includePhotos && { photos: employee.photos }),
      createdAt: employee.createdAt.toISOString(),
    };
  });

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
      photos: true, // Always include photos to get photoUrl
    },
  });

  if (!employee) {
    throw notFound("Employee not found");
  }

  // Get the first photo URL if available
  const photoUrl =
    employee.photos && employee.photos.length > 0
      ? employee.photos[0].url
      : null;

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
    photoUrl: photoUrl,
    photos: includePhotos ? employee.photos : undefined,
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
      photos: true, // Include photos to get photoUrl
    },
  });

  if (!employee) {
    return null;
  }

  // Get the first photo URL if available
  const photoUrl =
    employee.photos && employee.photos.length > 0
      ? employee.photos[0].url
      : null;

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
    photoUrl: photoUrl,
  };
};

/**
 * Update an employee
 * @param {String} id - Employee ID
 * @param {Object} employeeData - Employee data to update
 * @param {Boolean} updateInEssl - Whether to update employee in ESSL system
 * @param {Object} esslOptions - ESSL update options
 * @param {String} esslOptions.location - Employee location in ESSL
 * @param {String} esslOptions.role - Employee role in ESSL
 * @param {String} esslOptions.verificationType - Verification type in ESSL
 * @param {String} esslOptions.photoBase64 - Base64 encoded photo for ESSL
 * @returns {Object} Updated employee
 */
const updateEmployee = async (
  id,
  employeeData,
  updateInEssl = false,
  esslOptions = {}
) => {
  const {
    email,
    firstName,
    lastName,
    employeeNo,
    department,
    designation,
    isActive,
    isEsslRegistered,
    photoUrl,
  } = employeeData;

  const {
    location = config.essl.deviceLocation,
    role = "Normal User",
    verificationType = "Finger or Face or Card or Password",
    photoBase64,
  } = esslOptions;

  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      user: true,
      photos: true,
    },
  });

  if (!employee) {
    throw notFound("Employee not found");
  }

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

  const result = await prisma.$transaction(async (prisma) => {
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

    let photos = updatedEmployee.photos || [];
    if (photoUrl) {
      const photo = await prisma.employeePhoto.create({
        data: {
          url: photoUrl,
          employeeId: updatedEmployee.id,
        },
      });
      photos = [photo, ...photos];
    }

    return { employee: updatedEmployee, user, photos };
  });

  let esslUpdateResult = null;
  let esslPhotoResult = null;
  let esslFaceEnrollmentResult = null;
  let esslResetOpstampResult = null;

  if (updateInEssl) {
    try {
      const updatedEmployeeNo = employeeNo || employee.employeeNo;
      const updatedFirstName = firstName || result.user.firstName;
      const updatedLastName = lastName || result.user.lastName;

      esslUpdateResult = await esslService.updateEmployee({
        employeeCode: updatedEmployeeNo,
        employeeName: `${updatedFirstName} ${updatedLastName}`,
        employeeLocation: location,
        employeeRole: role,
        employeeVerificationType: verificationType,
      });

      let updateSuccess =
        esslUpdateResult && esslUpdateResult.includes("success");

      if (updateSuccess && photoBase64) {
        try {
          esslPhotoResult = await esslService.updateEmployeePhoto({
            employeeCode: updatedEmployeeNo,
            employeePhoto: photoBase64,
          });

          if (esslPhotoResult && esslPhotoResult.includes("success")) {
            await new Promise((resolve) => setTimeout(resolve, 1000));

            console.log(
              "Calling updateEmployeeFaceInDevice after 1-second delay"
            );
            esslFaceEnrollmentResult =
              await esslService.updateEmployeeFaceInDevice({
                employeeCode: updatedEmployeeNo,
                deviceSerialNumber: config.essl.deviceSerialNumber,
              });
            console.log(
              "Face enrollment completed with result:",
              esslFaceEnrollmentResult
            );

            await new Promise((resolve) => setTimeout(resolve, 1000));

            console.log("Calling resetOpstamp after 1-second delay");
            esslResetOpstampResult = await esslService.resetOpstamp(
              config.essl.deviceSerialNumber
            );
            console.log(
              "OpStamp reset completed with result:",
              esslResetOpstampResult
            );
          }
        } catch (photoError) {
          console.error(
            "Failed to update employee photo in ESSL system:",
            photoError
          );
        }
      }

      if (updateSuccess) {
        await prisma.employee.update({
          where: { id: result.employee.id },
          data: { isEsslRegistered: true },
        });
        result.employee.isEsslRegistered = true;
      }
    } catch (error) {
      console.error("Failed to update employee in ESSL system:", error);
    }
  }

  const resultPhotoUrl =
    result.photos && result.photos.length > 0 ? result.photos[0].url : null;

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
    photos: result.photos,
    photoUrl: resultPhotoUrl,
    updatedAt: result.employee.updatedAt,
    esslUpdateResult: esslUpdateResult,
    esslPhotoResult: esslPhotoResult,
    esslFaceEnrollmentResult: esslFaceEnrollmentResult,
    esslResetOpstampResult: esslResetOpstampResult,
  };
};

/**
 * Register an employee in the ESSL system
 * @param {String} id - Employee ID
 * @param {Object} esslOptions - ESSL registration options
 * @param {String} esslOptions.location - Employee location in ESSL
 * @param {String} esslOptions.role - Employee role in ESSL
 * @param {String} esslOptions.verificationType - Verification type in ESSL
 * @param {String} esslOptions.photoBase64 - Base64 encoded photo for ESSL
 * @returns {Object} Registration result
 */
const registerEmployeeInEssl = async (id, esslOptions = {}) => {
  const {
    location = config.essl.deviceLocation,
    role = "Employee",
    verificationType = "Finger or Face or Card or Password",
    photoBase64,
  } = esslOptions;

  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      photos: true, // Include photos to get photoUrl
    },
  });

  if (!employee) {
    throw notFound("Employee not found");
  }

  // Get the first photo URL if available
  const photoUrl =
    employee.photos && employee.photos.length > 0
      ? employee.photos[0].url
      : null;

  // Don't proceed if already registered
  if (employee.isEsslRegistered) {
    return {
      id: employee.id,
      employeeNo: employee.employeeNo,
      isEsslRegistered: true,
      photoUrl: photoUrl,
      message: "Employee is already registered in ESSL system",
    };
  }

  try {
    // First register the employee details
    const result = await esslService.updateEmployee({
      employeeCode: employee.employeeNo,
      employeeName: `${employee.user.firstName} ${employee.user.lastName}`,
      employeeLocation: location,
      employeeRole: role,
      employeeVerificationType: verificationType,
    });

    let registrationSuccess = result && result.includes("success");
    let photoResult = null;

    // If registration was successful and photo was provided, upload the photo too
    if (registrationSuccess && photoBase64) {
      try {
        photoResult = await esslService.updateEmployeePhoto({
          employeeCode: employee.employeeNo,
          employeePhoto: photoBase64,
        });

        // Log but don't fail if photo upload fails
        if (!photoResult || !photoResult.includes("success")) {
          console.warn(
            `ESSL photo upload succeeded but returned unexpected result: ${photoResult}`
          );
        }
      } catch (photoError) {
        console.error(
          "Failed to upload employee photo to ESSL system:",
          photoError
        );
        // Continue even if photo upload fails
      }
    }

    // If registration was successful, update the employee's ESSL registration status
    if (registrationSuccess) {
      await prisma.employee.update({
        where: { id: employee.id },
        data: { isEsslRegistered: true },
      });

      return {
        id: employee.id,
        employeeNo: employee.employeeNo,
        isEsslRegistered: true,
        photoUrl: photoUrl,
        message: "Employee successfully registered in ESSL system",
        result: result,
        photoResult: photoResult,
      };
    } else {
      return {
        id: employee.id,
        employeeNo: employee.employeeNo,
        isEsslRegistered: false,
        photoUrl: photoUrl,
        message: "Failed to register employee in ESSL system",
        result: result,
      };
    }
  } catch (error) {
    console.error("Error registering employee in ESSL system:", error);
    throw serverError(
      `Failed to register employee in ESSL system: ${error.message}`
    );
  }
};

/**
 * Update employee photo in ESSL system
 * @param {String} id - Employee ID
 * @param {String} photoBase64 - Base64 encoded photo data
 * @returns {Object} Result of the operation
 */
const updateEmployeePhotoInEssl = async (
  id,
  photoBase64,
  deviceSerialNumber
) => {
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      photos: true, // Include photos to get photoUrl
    },
  });

  if (!employee) {
    throw notFound("Employee not found");
  }

  // Get the first photo URL if available
  const photoUrl =
    employee.photos && employee.photos.length > 0
      ? employee.photos[0].url
      : null;

  if (!employee.isEsslRegistered) {
    throw badRequest(
      "Employee is not registered in ESSL system yet. Please register the employee first."
    );
  }

  if (!photoBase64) {
    throw badRequest("Base64 encoded photo data is required");
  }

  try {
    const result = await esslService.updateEmployeePhoto({
      employeeCode: employee.employeeNo,
      employeePhoto: photoBase64,
      deviceSerialNumber: "TFEE240900455",
    });

    return {
      id: employee.id,
      employeeNo: employee.employeeNo,
      photoUrl: photoUrl,
      message:
        result && result.includes("success")
          ? "Employee photo successfully updated in ESSL system"
          : "Failed to update employee photo in ESSL system",
      success: result && result.includes("success"),
      result: result,
    };
  } catch (error) {
    console.error("Error updating employee photo in ESSL system:", error);
    throw serverError(
      `Failed to update employee photo in ESSL system: ${error.message}`
    );
  }
};

/**
 * Delete an employee
 * @param {String} id - Employee ID
 * @param {Boolean} deleteFromEssl - Whether to delete employee from ESSL system
 * @returns {Object} Result with success status and ESSL deletion result
 */
const deleteEmployee = async (id, deleteFromEssl = true) => {
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      photos: true,
    },
  });

  if (!employee) {
    throw notFound("Employee not found");
  }

  if (employee.photos && employee.photos.length > 0) {
    for (const photo of employee.photos) {
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

  let esslDeletionResult = null;
  if (deleteFromEssl && employee.isEsslRegistered) {
    try {
      esslDeletionResult = await esslService.deleteEmployee(
        employee.employeeNo
      );
      console.log("ESSL deletion result:", esslDeletionResult);
    } catch (error) {
      console.error("Error deleting employee from ESSL system:", error);
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

  return {
    success: true,
    esslDeletionResult: esslDeletionResult,
  };
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

  const urlParts = photo.url.split("/");
  const filenameWithExt = urlParts[urlParts.length - 1];
  const filename = filenameWithExt.split(".")[0];
  const folderPath = urlParts
    .slice(urlParts.indexOf("canteen-management"))
    .join("/");
  const publicId = folderPath.substring(0, folderPath.lastIndexOf("."));

  await deleteFile(publicId);

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
const getEmployeesByDepartment = async (department, page = 1, limit = 100) => {
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
    photoUrl: employee.photos.length > 0 ? employee.photos[0].url : null,
  }));

  // Get columns for the table
  const columns = [
    { field: "photoUrl", headerName: "Photo", width: 100, renderCell: true },
    { field: "employeeNo", headerName: "Employee No.", width: 150 },
    { field: "firstName", headerName: "First Name", width: 150 },
    { field: "lastName", headerName: "Last Name", width: 150 },
    { field: "email", headerName: "Email", width: 220 },
    { field: "department", headerName: "Department", width: 180 },
    { field: "designation", headerName: "Designation", width: 180 },
  ];

  return {
    employees: formattedEmployees,
    totalCount,
    columns,
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
      photos: true, // Include photos to get photoUrl
    },
  });

  if (!employee) {
    throw notFound("Employee not found");
  }

  const photoUrl =
    employee.photos && employee.photos.length > 0
      ? employee.photos[0].url
      : null;

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
    photoUrl: photoUrl,
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

  // Get the first photo URL if available
  const photoUrl =
    employee.photos && employee.photos.length > 0
      ? employee.photos[0].url
      : null;

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
    photoUrl: photoUrl,
  };
};

/**
 * Disable an employee
 * @param {String} id - Employee ID
 */
const disableEmployee = async (id, status) => {
  console.log(status, id);

  try {
    const existingEmployee = await prisma.employee.findUnique({
      where: { id },
    });
    if (!existingEmployee) {
      throw notFound("Employee not found");
    }
    const employee = await prisma.user.update({
      where: { id: existingEmployee.userId },
      data: { isActive: status === "true" ? true : false },
    });
    return employee;
  } catch (error) {
    console.error("Error disabling employee:", error);
    throw serverError("Failed to disable employee");
  }
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
 * Bulk create employees from Excel file data
 * @param {Array} employeesData - Array of employee data from Excel
 * @param {Boolean} registerInEssl - Whether to register employees in ESSL system
 * @param {Object} esslOptions - ESSL registration options
 * @returns {Object} Results of bulk creation
 */
const bulkCreateEmployees = async (
  employeesData,
  registerInEssl = true,
  esslOptions = {}
) => {
  const results = {
    total: employeesData.length,
    successful: 0,
    failed: 0,
    employees: [],
    errors: [],
  };

  const {
    location = config.essl.deviceLocation,
    role = "Normal User",
    verificationType = "Finger or Face or Card or Password",
  } = esslOptions;

  for (const empData of employeesData) {
    try {
      let firstName = empData.firstName;
      let lastName = empData.lastName;

      if ((!firstName || !lastName) && empData.name) {
        const nameParts = empData.name.split(".");

        if (nameParts.length >= 2) {
          firstName = nameParts[0];
          lastName = nameParts.slice(1).join(".");
        } else {
          const spaceNameParts = empData.name.split(" ");
          if (spaceNameParts.length >= 2) {
            firstName = spaceNameParts[0];
            lastName = spaceNameParts.slice(1).join(" ");
          } else {
            firstName = empData.name;
            lastName = "-";
          }
        }
      }

      const employeeNo = empData.employeeNo ? String(empData.employeeNo) : null;

      if (!firstName || !lastName || !employeeNo) {
        results.failed++;
        results.errors.push({
          employeeNo: employeeNo || "Unknown",
          name: empData.name || "",
          error: "Missing required fields (firstName, lastName, or employeeNo)",
          data: JSON.stringify(empData),
        });
        continue;
      }

      const existingEmployee = await prisma.employee.findUnique({
        where: { employeeNo },
      });

      if (existingEmployee) {
        results.failed++;
        results.errors.push({
          employeeNo,
          error: `Employee with employee number ${employeeNo} already exists`,
        });
        continue;
      }

      const password = empData.password || "password123";

      const email = empData.email ? String(empData.email) : null;
      const department = empData.department ? String(empData.department) : null;
      const designation = empData.designation
        ? String(empData.designation)
        : null;

      const newEmployee = await createEmployee(
        {
          email,
          firstName,
          lastName,
          employeeNo,
          department,
          designation,
          password,
        },
        registerInEssl,
        {
          location: location,
          role: role,
          verificationType: verificationType,
        }
      );

      results.successful++;
      results.employees.push({
        id: newEmployee.id,
        employeeNo: newEmployee.employeeNo,
        name: `${newEmployee.firstName} ${newEmployee.lastName}`,
        isEsslRegistered: newEmployee.isEsslRegistered,
        esslRegistrationResult: newEmployee.esslRegistrationResult,
      });
    } catch (error) {
      console.error(`Error creating employee ${empData.employeeNo}:`, error);
      results.failed++;
      results.errors.push({
        employeeNo: empData.employeeNo ? String(empData.employeeNo) : "Unknown",
        error: error.message,
      });
    }
  }

  // if (registerInEssl && results.successful > 0) {
  //   try {
  //     const resetResult = await esslService.resetOpstamp(
  //       config.essl.deviceSerialNumber
  //     );
  //     console.log("OpStamp reset completed with result:", resetResult);
  //     results.esslResetResult = resetResult;
  //   } catch (error) {
  //     console.error("Failed to reset OpStamp after bulk upload:", error);
  //     results.esslResetError = error.message;
  //   }
  // }

  return results;
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
  registerEmployeeInEssl,
  disableEmployee,
  updateEmployeePhotoInEssl,
  bulkCreateEmployees,
};
