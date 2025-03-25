const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { v4: uuidv4 } = require("uuid");
const {
  ApiError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
} = require("../utils/api.error");
const QRCode = require("qrcode");
const config = require("../config/config");

/**
 * Generate unique ticket ID
 * @returns {string} Unique ticket ID
 */
const generateTicketId = () => {
  return `VIS-${uuidv4().slice(0, 8).toUpperCase()}`;
};

/**
 * Generate QR Code URL
 * @param {string} ticketId
 * @returns {Promise<string>} QR Code data URL
 */
const generateQRCode = async (ticketId) => {
  try {
    return await QRCode.toDataURL(
      `${config.frontendUrl}/visitor/status/${ticketId}`
    );
  } catch (error) {
    throw new ApiError(500, "Error generating QR code");
  }
};

/**
 * Register a new visitor request
 * @param {Object} visitorData - Visitor request data
 * @param {String} userId - User ID of the person registering the visitor request
 * @returns {Object} Visitor request details with ticket ID and QR code
 */

const registerVisitorRequest = async (visitorData, userId, files) => {
  const ticketId = generateTicketId();
  const visitDate = visitorData.visitDate
    ? new Date(visitorData.visitDate)
    : new Date();

  const visitorRequest = await prisma.visitorRequest.create({
    data: {
      userId: visitorData.hostId,
      hostId: visitorData.hostId,
      purpose: visitorData.purpose,
      company: visitorData.company,
      contactNumber: visitorData.contact,
      visitDate,
      ticketId,
      status: "PENDING",
      createdById: visitorData.hostId,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      },
      host: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          department: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  const qrCodeUrl = await generateQRCode(ticketId);

  return {
    ticketId: visitorRequest.ticketId,
    qrCodeUrl,
    status: visitorRequest.status,
    visitor: {
      id: visitorRequest.userId,
      name: `${visitorRequest.user.firstName} ${visitorRequest.user.lastName}`.trim(),
      email: visitorRequest.user.email,
      contact: visitorRequest.contactNumber,
      company: visitorRequest.company,
      purpose: visitorRequest.purpose,
      visitDate: visitorRequest.visitDate,
      host: `${visitorRequest.host.firstName} ${visitorRequest.host.lastName}`.trim(),
      department: visitorRequest.host.department,
    },
  };
};

/**
 * Process (Approve or Reject) a visitor request
 * @param {string} ticketId - Ticket ID of the visitor request
 * @param {string} status - New status (APPROVED or REJECTED)
 * @param {string} remarks - Optional remarks
 * @param {string} userId - User ID of the approver
 * @returns {Object} Updated visitor details
 */
const processVisitorRequest = async (ticketId, status, remarks, userId) => {
  if (!["APPROVED", "REJECTED"].includes(status)) {
    throw badRequest("Invalid status");
  }

  const visitorRequest = await prisma.visitorRequest.findUnique({
    where: { ticketId },
    include: {
      user: true,
    },
  });

  if (!visitorRequest) {
    throw notFound("Visitor request not found");
  }

  const updatedRequest = await prisma.visitorRequest.update({
    where: { ticketId },
    data: {
      status,
      remarks,
      approvedById: userId,
      approvedAt: new Date(),
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      host: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          department: true,
        },
      },
      approvedBy: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  return {
    ticketId: updatedRequest.ticketId,
    status: updatedRequest.status,
    remarks: updatedRequest.remarks,
    visitor: {
      id: updatedRequest.userId,
      name: `${updatedRequest.user.firstName} ${updatedRequest.user.lastName}`.trim(),
      email: updatedRequest.user.email,
      contact: updatedRequest.contactNumber,
      purpose: updatedRequest.purpose,
      visitDate: updatedRequest.visitDate,
      host: `${updatedRequest.host.firstName} ${updatedRequest.host.lastName}`.trim(),
      department: updatedRequest.host.department,
      approvedBy: updatedRequest.approvedBy
        ? `${updatedRequest.approvedBy.firstName} ${updatedRequest.approvedBy.lastName}`.trim()
        : null,
      approvedAt: updatedRequest.approvedAt,
    },
  };
};

/**
 * Get visitor status by ticket ID
 * @param {string} ticketId - Ticket ID of the visitor
 * @returns {Object} Visitor status details
 */
const getVisitorStatus = async (ticketId) => {
  const visitorRequest = await prisma.visitorRequest.findUnique({
    where: { ticketId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      host: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          department: true,
        },
      },
      approvedBy: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      entries: {
        orderBy: {
          entryTime: "desc",
        },
      },
    },
  });

  if (!visitorRequest) {
    throw notFound("Visitor not found");
  }

  // Get the latest entry/exit record
  const latestEntry = visitorRequest.entries[0];

  return {
    ticketId: visitorRequest.ticketId,
    status: visitorRequest.status,
    remarks: visitorRequest.remarks,
    visitor: {
      id: visitorRequest.userId,
      name: `${visitorRequest.user.firstName} ${visitorRequest.user.lastName}`.trim(),
      email: visitorRequest.user.email,
      contact: visitorRequest.contactNumber,
      company: visitorRequest.company,
      purpose: visitorRequest.purpose,
      visitDate: visitorRequest.visitDate,
      host: `${visitorRequest.host.firstName} ${visitorRequest.host.lastName}`.trim(),
      department: visitorRequest.host.department,
      approvedBy: visitorRequest.approvedBy
        ? `${visitorRequest.approvedBy.firstName} ${visitorRequest.approvedBy.lastName}`.trim()
        : null,
      approvedAt: visitorRequest.approvedAt,
    },
    entry: latestEntry
      ? {
          entryTime: latestEntry.entryTime,
          exitTime: latestEntry.exitTime,
          isActive: latestEntry.entryTime && !latestEntry.exitTime,
        }
      : null,
  };
};

/**
 * List visitor requests with optional filtering
 * @param {Object} filters - Filter options
 * @returns {Array} List of visitor requests
 */
const listVisitorRequests = async (filters = {}) => {
  const { status, startDate, endDate, hostId, search, visitorId } = filters;

  const whereClause = {};

  if (status) {
    whereClause.status = status;
  }

  if (startDate && endDate) {
    whereClause.visitDate = {
      gte: new Date(startDate),
      lte: new Date(endDate),
    };
  }

  if (hostId) {
    whereClause.hostId = hostId;
  }

  if (visitorId) {
    whereClause.userId = visitorId;
  }

  if (search) {
    whereClause.OR = [
      {
        user: {
          OR: [
            { firstName: { contains: search } },
            { lastName: { contains: search } },
            { email: { contains: search } },
          ],
        },
      },
      { contactNumber: { contains: search } },
      { company: { contains: search } },
      { ticketId: { contains: search } },
    ];
  }

  const visitorRequests = await prisma.visitorRequest.findMany({
    where: whereClause,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      host: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          department: true,
        },
      },
      approvedBy: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      entries: {
        orderBy: {
          entryTime: "desc",
        },
        take: 1,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return {
    count: visitorRequests.length,
    items: visitorRequests.map((request) => ({
      id: request.id,
      ticketId: request.ticketId,
      status: request.status,
      visitorName: `${request.user.firstName} ${request.user.lastName}`.trim(),
      visitorEmail: request.user.email,
      contact: request.contactNumber,
      company: request.company,
      purpose: request.purpose,
      visitDate: request.visitDate,
      host: `${request.host.firstName} ${request.host.lastName}`.trim(),
      department: request.host.department,
      approvedBy: request.approvedBy
        ? `${request.approvedBy.firstName} ${request.approvedBy.lastName}`.trim()
        : null,
      approvedAt: request.approvedAt,
      hasEntryToday: request.entries.length > 0,
      currentlyInside:
        request.entries.length > 0 &&
        request.entries[0].entryTime &&
        !request.entries[0].exitTime,
      createdAt: request.createdAt,
    })),
  };
};

/**
 * Handle visitor entry or exit
 * @param {string} ticketId - Ticket ID of the visitor
 * @param {string} userId - User ID of the person handling the entry
 * @param {boolean} isSuperAdmin - Whether the user is a super admin
 * @returns {Object} Entry details
 */
const handleVisitorEntry = async (ticketId, userId, isSuperAdmin = false) => {
  const visitorRequest = await prisma.visitorRequest.findUnique({
    where: { ticketId },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      entries: {
        where: {
          entryDate: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lte: new Date(new Date().setHours(23, 59, 59, 999)),
          },
        },
        orderBy: {
          entryTime: "desc",
        },
      },
    },
  });

  if (!visitorRequest) {
    throw notFound("Visitor not found");
  }

  if (!isSuperAdmin) {
    if (visitorRequest.status !== "APPROVED") {
      throw forbidden("Only approved visitors can enter/exit the premises");
    }

    const today = new Date();
    const visitDate = new Date(visitorRequest.visitDate);

    if (
      visitDate.getDate() !== today.getDate() ||
      visitDate.getMonth() !== today.getMonth() ||
      visitDate.getFullYear() !== today.getFullYear()
    ) {
      throw forbidden("Entry/exit is only allowed on the scheduled visit date");
    }
  }

  const latestEntry = visitorRequest.entries[0];

  let shouldCreateNewEntry = false;
  let isExit = false;

  if (!latestEntry) {
    shouldCreateNewEntry = true;
  } else if (latestEntry.entryTime && latestEntry.exitTime) {
    shouldCreateNewEntry = true;
  } else if (latestEntry.entryTime && !latestEntry.exitTime) {
    isExit = true;
  }

  let updatedEntry;

  if (shouldCreateNewEntry) {
    updatedEntry = await prisma.visitorEntry.create({
      data: {
        visitorRequestId: visitorRequest.id,
        entryDate: new Date(),
        entryTime: new Date(),
      },
    });

    isExit = false;
  } else {
    updatedEntry = await prisma.visitorEntry.update({
      where: { id: latestEntry.id },
      data: { exitTime: new Date() },
    });
  }

  const allTodayEntries = await prisma.visitorEntry.findMany({
    where: {
      visitorRequestId: visitorRequest.id,
      entryDate: {
        gte: new Date(new Date().setHours(0, 0, 0, 0)),
        lte: new Date(new Date().setHours(23, 59, 59, 999)),
      },
    },
    orderBy: {
      entryTime: "desc",
    },
  });

  return {
    action: isExit ? "EXIT" : "ENTRY",
    time: isExit ? updatedEntry.exitTime : updatedEntry.entryTime,
    visitor:
      `${visitorRequest.user.firstName} ${visitorRequest.user.lastName}`.trim(),
    ticketId: visitorRequest.ticketId,
    entryNumber: allTodayEntries.length,
    todayEntries: allTodayEntries.map((entry) => ({
      entryTime: entry.entryTime,
      exitTime: entry.exitTime,
      isComplete: Boolean(entry.entryTime && entry.exitTime),
    })),
  };
};

/**
 * Get visitor entry records with optional filtering
 * @param {string} startDate - Start date for filtering
 * @param {string} endDate - End date for filtering
 * @param {string} hostId - Host ID for filtering
 * @param {string} visitorId - Visitor ID for filtering (for visitor users)
 * @returns {Object} Visitor entry records with headers
 */
const getVisitorRecords = async (startDate, endDate, hostId, visitorId) => {
  const where = {
    entryDate: {
      gte: new Date(startDate),
      lte: new Date(endDate),
    },
  };

  if (hostId) {
    where.visitorRequest = {
      hostId,
    };
  }

  // If visitorId is provided (for visitor users), only show their records
  if (visitorId) {
    where.visitorRequest = {
      ...where.visitorRequest,
      userId: visitorId,
    };
  }

  const records = await prisma.visitorEntry.findMany({
    where,
    include: {
      visitorRequest: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          host: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              department: true,
            },
          },
        },
      },
    },
    orderBy: { entryDate: "desc" },
  });

  const headers = [
    { id: "ticketId", label: "Ticket ID" },
    { id: "visitorName", label: "Visitor Name" },
    { id: "contact", label: "Contact" },
    { id: "company", label: "Company" },
    { id: "purpose", label: "Purpose" },
    { id: "host", label: "Host" },
    { id: "department", label: "Department" },
    { id: "entryTime", label: "Entry Time" },
    { id: "exitTime", label: "Exit Time" },
    { id: "duration", label: "Duration" },
  ];

  const transformedData = records.map((record) => {
    const duration =
      record.exitTime && record.entryTime
        ? Math.round((record.exitTime - record.entryTime) / (1000 * 60))
        : null;

    return {
      id: record.id,
      ticketId: record.visitorRequest.ticketId,
      visitorName:
        `${record.visitorRequest.user.firstName} ${record.visitorRequest.user.lastName}`.trim(),
      contact: record.visitorRequest.contactNumber,
      company: record.visitorRequest.company,
      purpose: record.visitorRequest.purpose,
      host: `${record.visitorRequest.host.firstName} ${record.visitorRequest.host.lastName}`.trim(),
      department: record.visitorRequest.host.department,
      entryTime: record.entryTime,
      exitTime: record.exitTime,
      duration: duration ? `${duration} min` : "Ongoing",
      entryDate: record.entryDate,
    };
  });

  return {
    headers,
    data: transformedData,
  };
};
/**
 * Find visitors by search term
 * @param {string} searchTerm - Search term for finding visitors
 * @returns {Object} List of matching visitors and column definitions
 */
const findVisitors = async (searchTerm) => {
  if (!searchTerm || searchTerm.length < 2) {
    return { count: 0, items: [], columns: getVisitorColumns() };
  }

  const visitors = await prisma.user.findMany({
    where: {
      role: {
        name: "Visitor",
      },
      OR: [
        { firstName: { contains: searchTerm } },
        { lastName: { contains: searchTerm } },
        { email: { contains: searchTerm } },
      ],
    },
    include: {
      visitorProfile: {
        include: {
          photos: {
            take: 1,
          },
        },
      },
    },
    take: 10,
  });

  const formattedVisitors = visitors.map((visitor) => {
    const photoUrl =
      visitor.visitorProfile?.photos?.length > 0
        ? visitor.visitorProfile.photos[0].url
        : null;

    return {
      id: visitor.id,
      name: `${visitor.firstName} ${visitor.lastName}`.trim(),
      email: visitor.email,
      contact: visitor.visitorProfile?.contactNumber,
      company: visitor.visitorProfile?.company,
      photoUrl: photoUrl,
      createdAt: visitor.createdAt?.toISOString(),
      status: visitor.isActive ? "Active" : "Inactive",
    };
  });

  return {
    count: visitors.length,
    items: formattedVisitors,
    columns: getVisitorColumns(),
  };
};

/**
 * Get column definitions for visitor data table
 * @param {String} userRole - User role to determine column visibility
 * @returns {Array} Array of column definitions
 */
const getVisitorColumns = (userRole = null) => {
  const baseColumns = [
    { field: "photoUrl", headerName: "Photo", width: 100, renderCell: true },
    { field: "name", headerName: "Name", width: 150 },
    { field: "email", headerName: "Email", width: 200 },
    { field: "contact", headerName: "Contact", width: 150 },
    { field: "company", headerName: "Company", width: 150 },
    { field: "status", headerName: "Status", width: 100 },
    { field: "createdAt", headerName: "Created At", width: 150 },
  ];

  if (userRole === "Super Admin" || userRole === "HR") {
    baseColumns.push({
      field: "actions",
      headerName: "Actions",
      width: 150,
      renderCell: true,
    });
  }

  return baseColumns;
};

module.exports = {
  registerVisitorRequest,
  processVisitorRequest,
  getVisitorStatus,
  listVisitorRequests,
  handleVisitorEntry,
  getVisitorRecords,
  findVisitors,
};
