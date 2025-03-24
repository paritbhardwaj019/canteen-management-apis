const visitorService = require("../services/visitor.service");
const asyncHandler = require("../utils/async.handler");
const { badRequest } = require("../utils/api.error");
const ApiResponse = require("../utils/api.response");
const { v4: uuidv4 } = require("uuid");

/**
 * Register a new visitor request
 */
const registerVisitorRequest = asyncHandler(async (req, res) => {
  const { purpose, company, contact, visitDate, email, firstName, lastName } =
    req.body;
  console.log(req.user);
  const actualVisitorId = "vis-" + uuidv4().slice(0, 12);
  console.log(actualVisitorId);
  // if ((!actualVisitorId || !purpose) && req.user.role !== "Visitor") {
  //   throw badRequest("Visitor ID and purpose are required");
  // } else if (!purpose && req.user.role === "Visitor") {
  //   throw badRequest("Purpose is required");
  // }

  const result = await visitorService.registerVisitorRequest(
    {
      visitorId: actualVisitorId,
      purpose,
      company,
      contact,
      hostId: req.user.id,
      visitDate,
      email,
      firstName,
      lastName,
    },
    req.user.id,
    req.files
  );

  return ApiResponse.created(
    res,
    "Visitor request registered successfully",
    result
  );
});

/**
 * Process visitor request (approve/reject)
 */
const processVisitorRequest = asyncHandler(async (req, res) => {
  const { ticketId } = req.params;
  const { status, remarks } = req.body;

  if (!ticketId || !status) {
    throw badRequest("Ticket ID and status are required");
  }

  const result = await visitorService.processVisitorRequest(
    ticketId,
    status,
    remarks,
    req.user.id
  );

  return ApiResponse.ok(
    res,
    `Visitor request ${status.toLowerCase()} successfully`,
    result
  );
});

/**
 * Get visitor status by ticket ID
 */
const getVisitorStatus = asyncHandler(async (req, res) => {
  const { ticketId } = req.params;

  if (!ticketId) {
    throw badRequest("Ticket ID is required");
  }

  const result = await visitorService.getVisitorStatus(ticketId);

  return ApiResponse.ok(res, "Visitor status retrieved successfully", result);
});

/**
 * Get list of visitor requests with optional filtering
 */
const getVisitorRequests = asyncHandler(async (req, res) => {
  const { status, startDate, endDate, hostId, search } = req.query;

  const filters = {
    status,
    startDate,
    endDate,
    hostId,
    search,
  };

  // If logged in user is a visitor, only show their requests
  if (req.user.role === "Visitor") {
    filters.visitorId = req.user.id;
  }

  const results = await visitorService.listVisitorRequests(filters);

  return ApiResponse.collection(
    res,
    "Visitor requests retrieved successfully",
    results
  );
});

/**
 * Handle visitor entry/exit
 */
const handleVisitorEntry = asyncHandler(async (req, res) => {
  const { ticketId } = req.params;

  if (!ticketId) {
    throw badRequest("Ticket ID is required");
  }

  const isSuperAdmin = req.user.role === "Super Admin";

  const result = await visitorService.handleVisitorEntry(
    ticketId,
    req.user.id,
    isSuperAdmin
  );

  return ApiResponse.ok(
    res,
    `Visitor ${result.action.toLowerCase()} recorded successfully`,
    result
  );
});

/**
 * Get visitor entry records
 */
const getVisitorRecords = asyncHandler(async (req, res) => {
  const { startDate, endDate, hostId } = req.query;

  if (!startDate || !endDate) {
    throw badRequest("Start date and end date are required");
  }

  const visitorId = req.user.role === "Visitor" ? req.user.id : null;

  const results = await visitorService.getVisitorRecords(
    startDate,
    endDate,
    hostId,
    visitorId
  );

  return ApiResponse.ok(res, "Visitor records retrieved successfully", results);
});

/**
 * Find visitors by search term
 */
const findVisitors = asyncHandler(async (req, res) => {
  const { search } = req.query;

  const results = await visitorService.findVisitors(search);

  return ApiResponse.collection(res, "Visitors found", results);
});

module.exports = {
  registerVisitorRequest,
  processVisitorRequest,
  getVisitorStatus,
  getVisitorRequests,
  handleVisitorEntry,
  getVisitorRecords,
  findVisitors,
};
