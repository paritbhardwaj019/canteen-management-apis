const esslService = require("../services/essl.service");
const asyncHandler = require("../utils/async.handler");
const { badRequest } = require("../utils/api.error");
const ApiResponse = require("../utils/api.response");

/**
 * Get all ESSL devices
 */
const getAllDevices = asyncHandler(async (req, res) => {
  const devices = await esslService.getAllDevices();
  return ApiResponse.collection(res, "Devices retrieved successfully", devices);
});

/**
 * Get ESSL device logs for a specific date and location
 */
const getDeviceLogs = asyncHandler(async (req, res) => {
  const { date } = req.query;
  const { location = 1 } = req.query;

  if (!date) {
    throw badRequest("Date is required in YYYY-MM-DD format");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw badRequest("Invalid date format. Use YYYY-MM-DD format");
  }

  const logs = await esslService.getDeviceLogs(date, location);

  return ApiResponse.collection(
    res,
    "Device logs retrieved successfully",
    logs
  );
});

module.exports = {
  getAllDevices,
  getDeviceLogs,
};
