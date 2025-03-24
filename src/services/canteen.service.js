const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { getDeviceLogs } = require("../services/essl.service");
const { badRequest } = require("../utils/api.error");

/**
 * Parse logTime string into a valid Date object
 * @param {string} logTime - Time string from ESSL (e.g., '2025-03-2311:34:52')
 * @returns {Date|null} - Valid Date object or null if invalid
 */
const parseLogTime = (logTime) => {
  if (typeof logTime !== "string") return null;

  const cleanedTime = logTime.replace(
    /(\d{4}-\d{2}-\d{2})(\d{2}:\d{2}:\d{2})/,
    "$1 $2"
  );

  const date = new Date(cleanedTime);
  return isNaN(date.getTime()) ? null : date;
};

/**
 * Generate table columns based on user role
 * @param {string} role - User role
 * @returns {Array} Array of column definitions
 */
const getCanteenEntryColumns = (role) => {
  const baseColumns = [
    { field: "photoUrl", headerName: "Photo", width: 100, renderCell: true },
    { field: "employeeNo", headerName: "Employee No", width: 150 },
    { field: "employeeName", headerName: "Employee Name", width: 180 },
    { field: "email", headerName: "Email", width: 220 },
    { field: "logTime", headerName: "Entry Time", width: 180 },
    { field: "location", headerName: "Location", width: 150 },
    { field: "status", headerName: "Status", width: 120 },
  ];

  if (role !== "EMPLOYEE") {
    baseColumns.push({
      field: "actions",
      headerName: "Actions",
      width: 150,
    });
  }

  return baseColumns;
};

/**
 * Format entry data to include employee info at the same level
 * @param {Object} entry - Canteen entry with nested employee data
 * @returns {Object} Flattened entry data
 */
const formatEntryData = (entry) => {
  const { employee, ...entryData } = entry;

  console.log("EMPLOYEE PHOTOS", employee?.photos);

  const photoUrl =
    employee?.photos && employee.photos.length > 0
      ? employee.photos[0].url
      : null;

  return {
    ...entryData,
    employeeNo: employee?.employeeNo || "N/A",
    employeeName: employee?.user
      ? `${employee.user.firstName} ${employee.user.lastName}`
      : "N/A",
    email: employee?.user?.email || "N/A",
    photoUrl: photoUrl,
    logTime: entry.logTime ? new Date(entry.logTime).toLocaleString() : "N/A",
    employee,
  };
};

/**
 * Get all canteen entries with optional filters
 * @param {Object} loggedInUser - Current logged in user
 * @param {Object} filters - Optional filters { date, location }
 * @returns {Promise<Object>} Object containing entries and column definitions
 */
const getAllEntries = async (loggedInUser, filters = {}) => {
  const { role, plantId } = loggedInUser;
  const { date, location } = filters;

  if (role === "EMPLOYEE") {
    throw badRequest("You are not authorized to access this resource");
  }

  try {
    let entries = [];

    if (date && location) {
      const logs = await getDeviceLogs(date, location);

      if (!logs || logs.length === 0) {
        return {
          entries: [],
          columns: getCanteenEntryColumns(role),
        };
      }

      const processedEntries = await Promise.all(
        logs.map(async (log) => {
          const employee = await prisma.employee.findFirst({
            where: { employeeNo: log.user },
          });

          if (!employee) return null;

          const parsedLogTime = parseLogTime(log.logTime);
          if (!parsedLogTime) {
            console.warn(
              `Invalid logTime for user ${log.user}: ${log.logTime}`
            );
            return null;
          }

          const entry = await prisma.canteenEntry.upsert({
            where: {
              employeeId_logTime: {
                employeeId: employee.id,
                logTime: parsedLogTime,
              },
            },
            update: {},
            create: {
              employeeId: employee.id,
              status: "PENDING",
              logTime: parsedLogTime,
              location:
                log.location?.toString() === "NaN"
                  ? null
                  : log.location?.toString(),
            },
            include: {
              employee: {
                select: {
                  employeeNo: true,
                  photos: true,
                  user: {
                    select: {
                      firstName: true,
                      lastName: true,
                      email: true,
                    },
                  },
                },
              },
            },
          });
          return entry;
        })
      );

      entries = processedEntries.filter((entry) => entry !== null);
    } else {
      const whereClause = plantId ? { employee: { plantId } } : {};

      entries = await prisma.canteenEntry.findMany({
        where: whereClause,
        include: {
          employee: {
            select: {
              employeeNo: true,
              photos: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: { logTime: "desc" },
      });
    }

    // Format the entries to include employee data at the same level
    const formattedEntries = entries.map(formatEntryData);

    return {
      entries: formattedEntries,
      columns: getCanteenEntryColumns(role),
    };
  } catch (error) {
    console.error("Error fetching canteen entries:", error);
    throw badRequest(`Failed to fetch entries: ${error.message}`);
  }
};

/**
 * Approve a canteen entry
 * @param {String} id - Canteen entry ID
 * @param {String} status - New status
 * @returns {Promise<Object>} Updated entry
 */
const approveEntry = async (id, status) => {
  try {
    const entry = await prisma.canteenEntry.update({
      where: { id },
      data: {
        status,
        approveTime: status === "APPROVED" ? new Date() : null,
      },
      include: {
        employee: {
          select: {
            employeeNo: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return formatEntryData(entry);
  } catch (error) {
    console.error("Error approving entry:", error);
    throw badRequest(`Failed to approve entry: ${error.message}`);
  }
};

module.exports = {
  getAllEntries,
  approveEntry,
};
