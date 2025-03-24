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

/**
 * Add a new device in locations table
 */
const addNewLocation = asyncHandler(async (req, res) => {
  const { deviceName, serialNumber, locationType } = req.body;  
  const newLocation = await esslService.addNewLocation({ deviceName, serialNumber, locationType });
  return ApiResponse.ok(res, "New location added successfully", newLocation);
});

/**
 * Get all locations
 */
const getAllLocations = asyncHandler(async (req, res) => {
  const locations = await esslService.getAllLocations();
  return ApiResponse.collection(res, "Locations retrieved successfully", locations);
});

//delete location
const deleteLocation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const deletedLocation = await esslService.deleteLocation(id);
  return ApiResponse.ok(res, "Location deleted successfully", deletedLocation);
});

//update location
const updateLocation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updatedLocation = await esslService.updateLocation(id, req.body);
  return ApiResponse.ok(res, "Location updated successfully", updatedLocation);
});

module.exports = {
  getAllDevices,
  getDeviceLogs,
  addNewLocation,
  getAllLocations,
  deleteLocation,
  updateLocation,
};
