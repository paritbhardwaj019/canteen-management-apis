const express = require("express");
const router = express.Router();
const employeeController = require("../../controllers/employee.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const {
  checkPermissions,
  checkRole,
} = require("../../middlewares/rbac.middleware");
const {
  uploadEmployeePhoto,
  handleMulterError,
  uploadExcelFile,
} = require("../../middlewares/upload.middleware");

router.use(authenticate);

router.get(
  "/replace-spaces-in-emails",
  checkRole(["Super Admin"]),
  employeeController.replaceSpacesInEmails
);

router.post(
  "/bulk-upload",
  checkRole(["Super Admin", "Plant Head", "HR"]),
  uploadExcelFile,
  handleMulterError,
  employeeController.bulkUploadEmployees
);

router.get(
  "/",
  checkRole(["Super Admin", "Plant Head", "HR"]),
  employeeController.getAllEmployees
);

router.get(
  "/department/:department",
  checkRole(["Super Admin", "Plant Head", "HR"]),
  employeeController.getEmployeesByDepartment
);

router.get(
  "/:id",
  checkRole(["Super Admin", "Plant Head", "HR", "Employee"]),
  employeeController.getEmployeeById
);

router.post(
  "/register",
  checkRole(["Super Admin", "Plant Head", "HR"]),
  uploadEmployeePhoto,
  handleMulterError,
  employeeController.registerEmployee
);

router.put(
  "/:id",
  authenticate,
  uploadEmployeePhoto,
  handleMulterError,
  employeeController.updateEmployee
);

router.delete(
  "/:id",
  checkRole(["Super Admin"]),
  employeeController.deleteEmployee
);

router.post(
  "/:id/photo",
  checkRole(["Super Admin", "Plant Head", "HR"]),
  uploadEmployeePhoto,
  handleMulterError,
  employeeController.uploadEmployeePhoto
);

router.put(
  "/disable/:id",
  checkRole(["Super Admin", "Plant Head", "HR"]),
  employeeController.disableEmployee
);

module.exports = router;
