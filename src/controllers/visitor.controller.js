const visitorService = require("../services/visitor.service");
const asyncHandler = require("../utils/async.handler");
const { badRequest, notFound } = require("../utils/api.error");
const ApiResponse = require("../utils/api.response");
const { v4: uuidv4 } = require("uuid");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

/**
 * Register a new visitor request
 */
const registerVisitorRequest = asyncHandler(async (req, res) => {
  // Debug request information
  console.log('=== Visitor Registration Debug ===');
  console.log('Request Files:', req.files);
  console.log('Single File:', req.file);
  console.log('Request Body:', req.body);
  
  const { purpose, company, contact, visitDate, email, firstName, lastName, visitorCount, plantId } = req.body;
  
  let photoBase64 = null;
  
  // Debug photo processing
  if (req.file) {
    // console.log('Photo detected:');
    // console.log('- Filename:', req.file.originalname);
    // console.log('- Mimetype:', req.file.mimetype);
    // console.log('- Size:', req.file.size, 'bytes');
    
    try {
      const buffer = req.file.buffer;
      const mimeType = req.file.mimetype || 'image/jpeg';
      photoBase64 = `data:${mimeType};base64,${buffer.toString('base64')}`;
      
      // Debug base64 conversion
      // console.log('Base64 conversion successful');
      // console.log('Base64 string length:', photoBase64.length);
      // console.log('First 100 chars of base64:', photoBase64.substring(0, 100));
    } catch (error) {
      // console.error('Error converting photo to base64:', error);
    }
  } else {
    // console.log('No photo file detected in request');
  }

  const actualVisitorId = "vis-" + uuidv4().slice(0, 12);
  // console.log('Generated Visitor ID:', actualVisitorId);


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
      plantId: plantId || null,
      visitorCount: visitorCount || 1,
      photo: photoBase64 || null
    },
    req.user.id
  );

  // // Debug final result
  // console.log('Registration result:', {
  //   ticketId: result.ticketId,
  //   photoSaved: !!result.visitor.photo
  // });

  if (result.visitor && result.visitor.photo) {
    result.visitor.photoUrl = `/api/visitors/${result.ticketId}/photo`;
    result.visitor.photoPreview = result.visitor.photo.substring(0, 100) + '...';
    delete result.visitor.photo;
  }

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

/**
 * Get visitor photo
 */
const getVisitorPhoto = asyncHandler(async (req, res) => {
  const { ticketId } = req.params;
  
  const visitor = await prisma.visitorRequest.findUnique({
    where: { ticketId },
    select: { photo: true }
  });

  if (!visitor || !visitor.photo) {
    throw notFound('Photo not found');
  }

  // The photo is stored as base64 with data URI format
  // Extract the mime type and actual base64 data
  const [header, base64Data] = visitor.photo.split(',');
  const contentType = header.split(':')[1].split(';')[0];

  const imageBuffer = Buffer.from(base64Data, 'base64');
  
  res.setHeader('Content-Type', contentType);
  res.send(imageBuffer);
});

module.exports = {
  registerVisitorRequest,
  processVisitorRequest,
  getVisitorStatus,
  getVisitorRequests,
  handleVisitorEntry,
  getVisitorRecords,
  findVisitors,
  getVisitorPhoto,
};
