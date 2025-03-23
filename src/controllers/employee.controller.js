const employeeService = require("../services/employee.service");
const esslService = require("../services/essl.service");
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
  } = req.body;

  if (!firstName || !lastName || !employeeNo) {
    throw badRequest("First name, last name, and employee number are required");
  }

  const photoUrl = req.file ? req.file.path : null;

  const newEmployee = await employeeService.createEmployee({
    email,
    firstName,
    lastName,
    employeeNo,
    department,
    designation,
    photoUrl,
    password,
  });

  let esslResult = null;
  //   try {
  //     esslResult = await esslService.registerEmployeeInEssl({
  //       employeeNo,
  //       firstName,
  //       lastName,
  //       department,
  //     });

  //     if (esslResult.success) {
  //       await employeeService.updateEmployee(newEmployee.id, {
  //         isEsslRegistered: true,
  //       });
  //       newEmployee.isEsslRegistered = true;
  //     }
  //   } catch (error) {
  //     console.error("ESSL registration failed:", error);
  //     // Continue without failing the API response
  //   }

  return ApiResponse.created(res, "Employee registered successfully", {
    employee: newEmployee,
    // esslRegistration: esslResult || {
    //   success: false,
    //   message: "ESSL registration failed or not attempted",
    // },
  });
});

/**
 * Upload employee photo to both our system and ESSL
 */
const uploadEmployeePhoto = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!req.file) {
    throw badRequest("No file uploaded");
  }

  const photoResult = await employeeService.addEmployeePhoto(id, req.file.path);

  const employee = await employeeService.getEmployeeById(id);

  let esslResult = null;
  //   try {
  //     esslResult = await esslService.updateEmployeePhoto(
  //       employee.employeeNo,
  //       req.file.path
  //     );
  //   } catch (error) {}

  return ApiResponse.ok(res, "Employee photo uploaded successfully", {
    photo: photoResult,
    // esslUpdate: esslResult || {
    //   success: false,
    //   message: "ESSL photo update failed or not attempted",
    // },
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
  } = req.body;

  const updatedEmployee = await employeeService.updateEmployee(id, {
    email,
    firstName,
    lastName,
    employeeNo,
    department,
    designation,
    isActive,
  });

  //   let esslResult = null;
  //   if (employeeNo) {
  //     try {
  //       esslResult = await esslService.updateEmployeeInEssl({
  //         employeeNo,
  //         firstName,
  //         lastName,
  //         department,
  //       });
  //     } catch (error) {
  //       console.error("ESSL update failed:", error);
  //       // Continue without failing the API response
  //     }
  //   }

  return ApiResponse.ok(res, "Employee updated successfully", {
    employee: updatedEmployee,
    // esslUpdate: esslResult || {
    //   success: false,
    //   message: "ESSL update not attempted",
    // },
  });
});

/**
 * Delete an employee
 */
const deleteEmployee = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const employee = await employeeService.getEmployeeById(id);

  await employeeService.deleteEmployee(id);

  //   let esslResult = null;
  //   try {
  //     esslResult = await esslService.deleteEmployeeFromEssl(employee.employeeNo);
  //   } catch (error) {
  //     console.error("ESSL deletion failed:", error);
  //     // Continue without failing the API response
  //   }

  return ApiResponse.ok(res, "Employee deleted successfully", {
    // esslDeletion: esslResult || {
    //   success: false,
    //   message: "ESSL deletion failed or not attempted",
    // },
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

// /**
//  * Import employee from ESSL
//  */
// const importEmployeeFromEssl = asyncHandler(async (req, res) => {
//   const { employeeNo } = req.body;

//   if (!employeeNo) {
//     throw badRequest("Employee number is required");
//   }

//   const esslEmployee = await esslService.getEmployeeFromEssl(employeeNo);

//   if (!esslEmployee) {
//     throw badRequest("Employee not found in ESSL system");
//   }

//   const newEmployee = await employeeService.createEmployee({
//     firstName: esslEmployee.firstName,
//     lastName: esslEmployee.lastName,
//     employeeNo: esslEmployee.employeeNo,
//     department: esslEmployee.department,
//     isEsslRegistered: true,
//     photoUrl: esslEmployee.photoUrl,
//   });

//   return ApiResponse.created(
//     res,
//     "Employee imported successfully from ESSL",
//     newEmployee
//   );
// });

module.exports = {
  registerEmployee,
  uploadEmployeePhoto,
  getAllEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
  getEmployeesByDepartment,
  //   importEmployeeFromEssl,
};
