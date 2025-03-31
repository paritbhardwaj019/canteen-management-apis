const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { getDeviceLogs } = require("../services/essl.service");
const { badRequest } = require("../utils/api.error");
const { getCanteenReportColumns } = require("../utils/columnModles");

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

  if (role !== "Employee") {
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
    date: entry.logTime ? entry.logTime.toISOString().split("T")[0] : "N/A",
  };
};

/**
 * Process device logs for a specific location
 * @param {String} date - Date to fetch logs for (YYYY-MM-DD)
 * @param {String} locationType - Location type from the Locations table
 * @returns {Promise<Array>} Array of processed entries
 */
const processLocationLogs = async (date, locationType) => {
  try {
    console.log(`Fetching logs for location: ${locationType} on date: ${date}`);
    const logs = await getDeviceLogs(date, locationType);

    if (!logs || logs.length === 0) {
      console.log(`No logs found for location: ${locationType}`);
      return [];
    }

    console.log(`Found ${logs.length} logs for location: ${locationType}`);

    const processedEntries = await Promise.all(
      logs.map(async (log) => {
        const employee = await prisma.employee.findFirst({
          where: { employeeNo: log.user },
        });

        const canteeenPlant = await prisma.plant.findFirst({
          where: { location: locationType },
        });

        if (!employee) {
          console.log(`No employee found for code: ${log.user}`);
          return null;
        }

        const parsedLogTime = parseLogTime(log.logTime);
        if (!parsedLogTime) {
          console.warn(`Invalid logTime for user ${log.user}: ${log.logTime}`);
          return null;
        }

        try {
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
              location: locationType,
              ...(canteeenPlant ? { plantId: canteeenPlant.id } : {}),
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
                      plantId: true,
                    },
                  },
                },
              },
            },
          });
          console.log(`Processed entry for employee: ${employee.employeeNo}`);
          return entry;
        } catch (error) {
          console.error(
            `Error processing entry for ${employee.employeeNo}:`,
            error
          );
          return null;
        }
      })
    );

    return processedEntries.filter((entry) => entry !== null);
  } catch (error) {
    console.error(`Error processing logs for location ${locationType}:`, error);
    return [];
  }
};

/**
 * Get all canteen entries with optional filters and role-based access
 * @param {Object} loggedInUser - Current logged in user with role and other info
 * @param {Object} filters - Optional filters { date, location }
 * @returns {Promise<Object>} Object containing entries and column definitions
 */
const getAllEntries = async (loggedInUser, filters = {}) => {
  const { role, id, plantId } = loggedInUser;
  const { date, location } = filters;

  if (role === "Employee") {
    throw badRequest("You are not authorized to access this resource");
  }

  try {
    let assignedPlantLocation = null;

    if (role !== "Super Admin" && plantId) {
      const userPlant = await prisma.plant.findUnique({
        where: { id: plantId },
        select: { location: true },
      });
      assignedPlantLocation = userPlant?.location;
    } else if (role === "Plant Head") {
      const headedPlant = await prisma.plant.findUnique({
        where: { plantHeadId: id },
        select: { location: true },
      });

      console.log("headedPlant", headedPlant);
      assignedPlantLocation = headedPlant?.location;
    }

    console.log("ASSIGNED PLANT LOCATION", assignedPlantLocation);

    let entries = [];

    if (date) {
      let locationsToProcess = [];

      if (role === "Super Admin") {
        const allLocations = await prisma.locations.findMany();
        locationsToProcess = allLocations;
      } else if (role === "Plant Head" || role === "Caterer" || role === "HR") {
        locationsToProcess = [{ locationType: assignedPlantLocation }];
      } else {
        if (!assignedPlantLocation) {
          console.log(
            `User ${id} with role ${role} has no assigned plant location`
          );
          return {
            entries: [],
            columns: getCanteenEntryColumns(role),
          };
        }

        const matchingLocations = await prisma.locations.findMany({
          where: {
            locationType: { contains: assignedPlantLocation },
          },
        });

        if (matchingLocations.length === 0) {
          const fallbackLocations = await prisma.locations.findMany({
            where: {
              OR: [
                { deviceName: { contains: assignedPlantLocation } },
                {
                  locationType: {
                    contains: assignedPlantLocation.split(" ")[0],
                  },
                },
              ],
            },
          });

          locationsToProcess = fallbackLocations;
        } else {
          locationsToProcess = matchingLocations;
        }

        if (location) {
          locationsToProcess = locationsToProcess.filter((loc) =>
            loc.locationType.toLowerCase().includes(location.toLowerCase())
          );
        }
      }

      console.log(
        `Processing ${locationsToProcess.length} locations for user with role ${role}`
      );

      if (locationsToProcess.length > 0) {
        let allProcessedEntries = [];

        for (const locationData of locationsToProcess) {
          const processedEntries = await processLocationLogs(
            date,
            locationData.locationType
          );
          allProcessedEntries = [...allProcessedEntries, ...processedEntries];
        }

        entries = allProcessedEntries.filter(
          (entry) => entry.status === "PENDING"
        );
      }
    } else {
      const whereClause = { status: "PENDING" };

      if (role !== "Super Admin" && plantId) {
        whereClause.plantId = plantId;
      } else if (role === "Plant Head") {
        const headedPlant = await prisma.plant.findUnique({
          where: { plantHeadId: id },
          select: { id: true },
        });

        if (headedPlant) {
          whereClause.plantId = headedPlant.id;
        }
      }

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
                  plantId: true,
                },
              },
            },
          },
          plant: {
            select: {
              name: true,
              location: true,
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

const getCanteenReport = async (loggedInUser, filters = {}) => {
  const { fromDate, toDate } = filters;

  if (!fromDate) {
    throw badRequest("From date is required");
  }

  const dateFilter = toDate
    ? { gte: new Date(fromDate), lte: new Date(toDate) }
    : {
        gte: new Date(fromDate),
        lt: new Date(
          new Date(fromDate).setDate(new Date(fromDate).getDate() + 1)
        ),
      };

  let entries = await prisma.canteenEntry.findMany({
    where: {
      logTime: dateFilter,
    },
    include: {
      plant: {
        select: {
          name: true,
          plantCode: true,
        },
      },
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

  const meals = await prisma.menu.findMany({});

  entries = entries.map((entry) => ({
    ...entry,
    plantName: entry.plant?.name,
    plantCode: entry.plant?.plantCode,
    date: entry.logTime.toISOString().split("T")[0],
    employeeNo: entry.employee.employeeNo,
    employeeName:
      entry.employee.user.firstName + " " + entry.employee.user.lastName,
    logTime: entry.logTime.toISOString().split("T")[0],
    quantity: 1,
    employerContribution: meals[0].emrContribution,
    employeeContribution: meals[0].empContribution,
    price: meals[0].price,
    meal: meals[0].name,
    mealType: meals[0].type,
  }));

  return { entries, columns: getCanteenReportColumns() };
};

/**
 * Generate a monthly canteen usage report
 * @param {Object} loggedInUser - Current logged in user with role and other info
 * @param {Object} filters - Filters { month: Integer }
 * @returns {Promise<Object>} Report data with entries and columns
 */
const getMonthlyReport = async (loggedInUser, filters = {}) => {
  const { month = 0 } = filters;

  const monthValue = parseInt(month, 10);

  const today = new Date();
  let fromDate, toDate;

  if (monthValue === 0) {
    fromDate = new Date(today.getFullYear(), today.getMonth(), 1);
    toDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  } else if (monthValue > 0) {
    toDate = new Date(today.getFullYear(), today.getMonth(), 0);
    fromDate = new Date(today.getFullYear(), today.getMonth() - monthValue, 1);
  } else {
    throw badRequest("Month parameter must be 0 or a positive integer");
  }

  const fromDateStr = fromDate.toISOString().split("T")[0];
  const toDateStr = toDate.toISOString().split("T")[0];

  console.log(`Generating report from ${fromDateStr} to ${toDateStr}`);

  try {
    let entries = await prisma.canteenEntry.findMany({
      where: {
        logTime: {
          gte: fromDate,
          lte: toDate,
        },
      },
      include: {
        plant: {
          select: {
            name: true,
            plantCode: true,
          },
        },
        employee: {
          select: {
            employeeNo: true,
            department: true,
            designation: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                department: true,
              },
            },
          },
        },
      },
      orderBy: [{ logTime: "asc" }, { employeeId: "asc" }],
    });

    const meals = await prisma.menu.findMany({});
    const defaultMeal = meals[0];

    entries = entries.map((entry) => ({
      id: entry.id,
      plantName: entry.plant?.name || "N/A",
      plantCode: entry.plant?.plantCode || "N/A",
      date: entry.logTime.toISOString().split("T")[0],
      employeeNo: entry.employee.employeeNo,
      employeeName: `${entry.employee.user.firstName} ${entry.employee.user.lastName}`,
      department:
        entry.employee.department || entry.employee.user.department || "N/A",
      designation: entry.employee.designation || "N/A",
      logTime: entry.logTime.toISOString(),
      formattedTime: new Date(entry.logTime).toLocaleTimeString(),
      quantity: 1,
      employerContribution: defaultMeal.emrContribution,
      employeeContribution: defaultMeal.empContribution,
      price: defaultMeal.price,
      meal: defaultMeal.name,
      mealType: defaultMeal.type,
      totalAmount: defaultMeal.price,
    }));

    const summary = {
      reportPeriod: `${fromDateStr} to ${toDateStr}`,
      totalEntries: entries.length,
      totalEmployees: new Set(entries.map((e) => e.employeeNo)).size,
      totalAmount: entries.reduce((sum, entry) => sum + entry.price, 0),
      plantWiseCounts: {},
      departmentWiseCounts: {},
      dateWiseCounts: {},
    };

    entries.forEach((entry) => {
      if (!summary.plantWiseCounts[entry.plantName]) {
        summary.plantWiseCounts[entry.plantName] = {
          count: 0,
          amount: 0,
        };
      }
      summary.plantWiseCounts[entry.plantName].count += 1;
      summary.plantWiseCounts[entry.plantName].amount += entry.price;

      if (!summary.departmentWiseCounts[entry.department]) {
        summary.departmentWiseCounts[entry.department] = {
          count: 0,
          amount: 0,
        };
      }
      summary.departmentWiseCounts[entry.department].count += 1;
      summary.departmentWiseCounts[entry.department].amount += entry.price;

      if (!summary.dateWiseCounts[entry.date]) {
        summary.dateWiseCounts[entry.date] = {
          count: 0,
          amount: 0,
        };
      }
      summary.dateWiseCounts[entry.date].count += 1;
      summary.dateWiseCounts[entry.date].amount += entry.price;
    });

    return {
      reportType:
        monthValue === 0
          ? "Current Month"
          : monthValue === 1
          ? "Previous Month"
          : `Last ${monthValue} Months`,
      period: {
        fromDate: fromDateStr,
        toDate: toDateStr,
      },
      entries,
      summary,
      columns: getCanteenReportColumns(),
    };
  } catch (error) {
    console.error("Error generating monthly report:", error);
    throw badRequest(`Failed to generate monthly report: ${error.message}`);
  }
};

module.exports = {
  getAllEntries,
  approveEntry,
  getCanteenReport,
  getMonthlyReport,
};
