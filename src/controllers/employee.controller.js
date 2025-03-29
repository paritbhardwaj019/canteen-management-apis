const employeeService = require("../services/employee.service");
const asyncHandler = require("../utils/async.handler");
const { badRequest } = require("../utils/api.error");
const ApiResponse = require("../utils/api.response");

/**
 * Register a new employee
 * Adds the employee to both the application database and ESSL system
 */
const registerEmployee = asyncHandler(async (req, res) => {
  const {
    email,
    firstName,
    lastName,
    employeeNo,
    department,
    designation,
    password,
    registerInEssl = true,
    esslLocation,
    esslRole,
    esslVerificationType,
  } = req.body;

  console.log("FILE", req.file);

  if (!firstName || !lastName || !employeeNo) {
    throw badRequest("First name, last name, and employee number are required");
  }

  const actualPassword = password || Math.random().toString(36).slice(-8);
  let photoUrl = null;
  let photoBase64 = null;

  if (req.file) {
    photoUrl = req.file.path;

    if (registerInEssl || true) {
      try {
        const axios = require("axios");
        const response = await axios.get(photoUrl, {
          responseType: "arraybuffer",
        });
        const buffer = Buffer.from(response.data, "binary");
        const mimeType = req.file.mimetype || "image/jpeg";
        photoBase64 = `${buffer.toString("base64")}`;
      } catch (error) {
        console.error("Error converting Cloudinary image to base64:", error);
      }
    }
  }

  const esslOptions = registerInEssl
    ? {
        location: esslLocation,
        role: esslRole,
        verificationType: esslVerificationType,
        photoBase64,
      }
    : {};
  console.log("esslOptions", esslOptions);
  console.log("photoBase64", photoBase64);

  const newEmployee = await employeeService.createEmployee(
    {
      email,
      firstName,
      lastName,
      employeeNo,
      department,
      designation,
      photoUrl,
      password: actualPassword,
    },
    registerInEssl,
    esslOptions
  );

  return ApiResponse.created(res, "Employee registered successfully", {
    employee: newEmployee,
    esslRegistration: registerInEssl
      ? {
          success: newEmployee.isEsslRegistered,
          message: newEmployee.isEsslRegistered
            ? "ESSL registration successful"
            : "ESSL registration failed",
          details: newEmployee.esslRegistrationResult,
          photoDetails: newEmployee.esslPhotoResult,
        }
      : null,
  });
  return ApiResponse.ok(res, "Employee registered successfully", {});
});

/**
 * Upload employee photo to both our system and ESSL
 */
const uploadEmployeePhoto = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { updateEsslPhoto, photoBase64 } = req.body;

  if (!req.file && !photoBase64) {
    throw badRequest("No file uploaded or no base64 photo provided");
  }

  let photoResult = null;
  if (req.file) {
    photoResult = await employeeService.addEmployeePhoto(id, req.file.path);
  }

  const employee = await employeeService.getEmployeeById(id);

  let esslResult = null;
  if (updateEsslPhoto && photoBase64) {
    try {
      esslResult = await employeeService.updateEmployeePhotoInEssl(
        id,
        photoBase64,
        "TFEE240900455"
      );
    } catch (error) {
      console.error("ESSL photo update failed:", error);
    }
  }

  return ApiResponse.ok(res, "Employee photo uploaded successfully", {
    photo: photoResult,
    esslUpdate: updateEsslPhoto
      ? esslResult || {
          success: false,
          message: "ESSL photo update failed or not attempted",
        }
      : null,
  });
});

/**
 * Get all employees with pagination and filtering
 */
const getAllEmployees = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search,
    plantId,
    department,
    includePhotos = false,
  } = req.query;

  const result = await employeeService.getAllEmployees({
    page: parseInt(page),
    limit: parseInt(limit),
    search,
    plantId,
    department,
    includePhotos: includePhotos === "true" || includePhotos === true,
    userRole: req.user.role,
  });

  return ApiResponse.paginate(res, "Employees retrieved successfully", result);
});

/**
 * Get employee by ID
 */
const getEmployeeById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const includePhotos =
    req.query.includePhotos === "true" || req.query.includePhotos === true;

  const employee = await employeeService.getEmployeeById(id, includePhotos);

  return ApiResponse.ok(res, "Employee retrieved successfully", employee);
});

/**
 * Update an employee
 */
const updateEmployee = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    email,
    firstName,
    lastName,
    employeeNo,
    department,
    designation,
    isActive,
    updateInEssl,
    esslLocation,
    esslRole,
    esslVerificationType,
    photoBase64,
  } = req.body;

  const esslOptions = updateInEssl
    ? {
        location: esslLocation,
        role: esslRole,
        verificationType: esslVerificationType,
        photoBase64,
      }
    : {};

  const updatedEmployee = await employeeService.updateEmployee(
    id,
    {
      email,
      firstName,
      lastName,
      employeeNo,
      department,
      designation,
      isActive,
    },
    updateInEssl,
    esslOptions
  );

  return ApiResponse.ok(res, "Employee updated successfully", {
    employee: updatedEmployee,
    esslUpdate: updateInEssl
      ? {
          success:
            updatedEmployee.esslUpdateResult &&
            updatedEmployee.esslUpdateResult.includes("success"),
          message:
            updatedEmployee.esslUpdateResult &&
            updatedEmployee.esslUpdateResult.includes("success")
              ? "ESSL update successful"
              : "ESSL update failed",
          details: updatedEmployee.esslUpdateResult,
          photoDetails: updatedEmployee.esslPhotoResult,
        }
      : null,
  });
});

/**
 * Register an employee in ESSL system
 */
const registerEmployeeInEssl = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { location, role, verificationType, photoBase64 } = req.body;

  const result = await employeeService.registerEmployeeInEssl(id, {
    location,
    role,
    verificationType,
    photoBase64,
  });

  return ApiResponse.ok(res, result.message, result);
});

/**
 * Update employee photo in ESSL system
 */
const updateEmployeePhotoInEssl = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { photoBase64 } = req.body;

  if (!photoBase64) {
    throw badRequest("Base64 encoded photo data is required");
  }

  const result = await employeeService.updateEmployeePhotoInEssl(
    id,
    photoBase64,
    "TFEE240900455"
  );

  return ApiResponse.ok(res, result.message, result);
});

/**
 * Delete an employee
 */
const deleteEmployee = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { deleteFromEssl = true } = req.body;

  const employee = await employeeService.getEmployeeById(id);

  const result = await employeeService.deleteEmployee(id, deleteFromEssl);

  return ApiResponse.ok(res, "Employee deleted successfully", {
    employee: {
      employeeNo: employee.employeeNo,
      name: `${employee.firstName} ${employee.lastName}`,
    },
    esslDeletion: deleteFromEssl
      ? {
          success:
            result.esslDeletionResult &&
            result.esslDeletionResult.includes("success"),
          details: result.esslDeletionResult,
        }
      : null,
  });
});

/**
 * Get employees by department
 */
const getEmployeesByDepartment = asyncHandler(async (req, res) => {
  const { department } = req.params;
  const { page = 1, limit = 10 } = req.query;

  const result = await employeeService.getEmployeesByDepartment(
    department,
    parseInt(page),
    parseInt(limit)
  );

  return ApiResponse.paginate(
    res,
    "Department employees retrieved successfully",
    result.employees,
    {
      page: parseInt(page),
      limit: parseInt(limit),
      totalItems: result.totalCount,
    }
  );
});

/**
 * Disable an employee
 */
const disableEmployee = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const employee = await employeeService.disableEmployee(id, status);

  return ApiResponse.ok(res, "Employee disabled successfully", employee);
});

module.exports = {
  registerEmployee,
  uploadEmployeePhoto,
  getAllEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
  getEmployeesByDepartment,
  registerEmployeeInEssl,
  updateEmployeePhotoInEssl,
  disableEmployee,
};
