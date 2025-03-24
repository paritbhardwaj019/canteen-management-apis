const canteenService = require("../services/canteen.service");
const asyncHandler = require("../utils/async.handler");
const { badRequest } = require("../utils/api.error");
const ApiResponse = require("../utils/api.response");

const getAllTodaysEntries = asyncHandler(async (req, res) => {
  const today = new Date().toISOString().split("T")[0];
  const { date, location } = req.query;

  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw badRequest("Invalid date format. Use YYYY-MM-DD (e.g., 2025-03-24)");
  }

  const result = await canteenService.getAllEntries(req.user, {
    date: date || today,
    location: location || "Chennai",
  });

  return ApiResponse.ok(
    res,
    `${date ? "Entries" : "Today's entries"} retrieved successfully`,
    result
  );
});

const approveEntry = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !["PENDING", "APPROVED"].includes(status.toUpperCase())) {
    throw badRequest("Invalid status. Must be 'PENDING' or 'APPROVED'");
  }

  const entry = await canteenService.approveEntry(id, status.toUpperCase());
  return ApiResponse.ok(res, "Entry status updated successfully", entry);
});

const getCanteenReport = asyncHandler(async (req, res) => {
  const report = await canteenService.getCanteenReport(req.user, req.query);
  return ApiResponse.ok(res, "Canteen report retrieved successfully", report);
});

module.exports = {
  getAllTodaysEntries,
  approveEntry,
  getCanteenReport,
};
