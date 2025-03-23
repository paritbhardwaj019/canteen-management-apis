const mealRequestService = require("../services/mealRequest.service");
const asyncHandler = require("../utils/async.handler");
const { badRequest } = require("../utils/api.error");
const ApiResponse = require("../utils/api.response");

const isValidDate = (dateString) => {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(dateString) &&
    !isNaN(new Date(dateString).getTime())
  );
};

const createMealRequest = asyncHandler(async (req, res) => {
  const { menuId } = req.body;
  const userId = req.user.id;

  if (!menuId) {
    throw badRequest("Menu ID is  required");
  }


  const newRequest = await mealRequestService.createMealRequest(
    {
      menuId
    },
    userId
  );

  return ApiResponse.created(
    res,
    "Meal request created successfully",
    newRequest
  );
});

const getAllMealRequests = asyncHandler(async (req, res) => {
  const { status, userId, date, from, to } = req.query;
  const currentUserId = req.user.id;
  const permissions = req.user.permissions || [];

  const data = await mealRequestService.getAllMealRequests(
    {
      status,
      userId,
      date,
      from,
      to
    },
    currentUserId,
    permissions,
    req.user.role
  );

  return ApiResponse.ok(
    
    res,
    "Meal requests retrieved successfully",
    data
  );
});

const getMealRequestById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const permissions = req.user.permissions || [];

  const request = await mealRequestService.getMealRequestById(
    id,
    userId,
    permissions
  );

  return ApiResponse.ok(res, "Meal request retrieved successfully", request);
});

const updateMealRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { mealId, date, quantity, notes, status } = req.body;
  const userId = req.user.id;
  const permissions = req.user.permissions || [];

  if (date && !isValidDate(date)) {
    throw badRequest("Invalid date format. Use YYYY-MM-DD format");
  }

  const updatedRequest = await mealRequestService.updateMealRequest(
    id,
    {
      mealId,
      date,
      quantity,
      notes,
      status,
    },
    userId,
    permissions
  );

  return ApiResponse.ok(
    res,
    "Meal request updated successfully",
    updatedRequest
  );
});

const cancelMealRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const permissions = req.user.permissions || [];

  const cancelledRequest = await mealRequestService.cancelMealRequest(
    id,
    userId,
    permissions
  );

  return ApiResponse.ok(
    res,
    "Meal request cancelled successfully",
    cancelledRequest
  );
});

const deleteMealRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const permissions = req.user.permissions || [];

  await mealRequestService.deleteMealRequest(id, userId, permissions);

  return ApiResponse.ok(res, "Meal request deleted successfully");
});

const getMealRequestSummary = asyncHandler(async (req, res) => {
  const { from, to } = req.query;

  if ((from && !isValidDate(from)) || (to && !isValidDate(to))) {
    throw badRequest("Invalid date format. Use YYYY-MM-DD format");
  }

  const summary = await mealRequestService.getMealRequestSummary({
    from,
    to,
  });

  return ApiResponse.ok(
    res,
    "Meal request summary retrieved successfully",
    summary
  );
});

module.exports = {
  createMealRequest,
  getAllMealRequests,
  getMealRequestById,
  updateMealRequest,
  cancelMealRequest,
  deleteMealRequest,
  getMealRequestSummary,
};
