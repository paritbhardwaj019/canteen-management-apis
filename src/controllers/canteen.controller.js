const canteenService = require("../services/canteen.service");
const asyncHandler = require("../utils/async.handler");
const { badRequest } = require("../utils/api.error");
const ApiResponse = require("../utils/api.response");

const getAllTodaysEntries = asyncHandler(async (req, res) => {
  const entries = await canteenService.getAllEntries(req.user);
  return ApiResponse.ok(res,'Entries retrieved successfully', entries);
});


const approveEntry = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const request = await canteenService.approveEntry(id, status);
  return ApiResponse.success(res,'Entry approved successfully', request);
});





module.exports = {
  getAllTodaysEntries,
  approveEntry,
};
