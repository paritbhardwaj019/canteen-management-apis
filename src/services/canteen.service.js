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
 * Get all canteen entries with optional filters
 * @param {Object} loggedInUser - Current logged in user
 * @param {Object} filters - Optional filters { date, location }
 * @returns {Promise<Array>} List of canteen entries
 */
const getAllEntries = async (loggedInUser, filters = {}) => {
  const { role, plantId } = loggedInUser;
  const { date, location } = filters;

  if (role === "EMPLOYEE") {
    throw badRequest("You are not authorized to access this resource");
  }

  try {
    if (date && location) {
      const logs = await getDeviceLogs(date, location);

      if (!logs || logs.length === 0) {
        return [];
      }

      const entries = await Promise.all(
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
                // Use the exact name of the @@unique constraint
                employeeId: employee.id,
                logTime: parsedLogTime,
              },
            },
            update: {}, // No updates needed since we're just ensuring the entry exists
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

      return entries.filter((entry) => entry !== null);
    }

    const whereClause = plantId ? { employee: { plantId } } : {};

    const entries = await prisma.canteenEntry.findMany({
      where: whereClause,
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
      orderBy: { logTime: "desc" },
    });

    return entries;
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
              },
            },
          },
        },
      },
    });
    return entry;
  } catch (error) {
    console.error("Error approving entry:", error);
    throw badRequest(`Failed to approve entry: ${error.message}`);
  }
};

module.exports = {
  getAllEntries,
  approveEntry,
};
