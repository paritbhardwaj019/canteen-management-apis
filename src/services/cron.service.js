const cron = require("node-cron");
const { getDeviceLogs } = require("./essl.service");
const { PrismaClient } = require("@prisma/client");
const { parseLogTime } = require("./canteen.service");
const prisma = new PrismaClient();

/**
 * Fetch device logs for all locations and create canteen entries
 */
const syncCanteenEntries = async () => {
  try {
    const today = new Date();
    const date = today.toISOString().split("T")[0];

    const locations = await prisma.locations.findMany();

    if (!locations || locations.length === 0) {
      console.log("No locations found in the database");
      return;
    }

    console.log(`Found ${locations.length} locations for processing`);

    for (const locationData of locations) {
      const { locationType } = locationData;

      console.log(`Processing location: ${locationType}`);

      const logs = await getDeviceLogs(date, locationType);

      if (!logs || logs.length === 0) {
        console.log(`No device logs found for location: ${locationType}`);
        continue;
      }

      console.log(`Found ${logs.length} logs for location: ${locationType}`);

      for (const log of logs) {
        const { user: employeeCode, logTime, location: logLocation } = log;

        const employee = await prisma.employee.findFirst({
          where: { employeeNo: employeeCode },
        });

        if (!employee) {
          console.log(
            `No employee found for employeeCode: ${employeeCode} at location: ${locationType}`
          );
          continue;
        }

        const existingEntry = await prisma.canteenEntry.findFirst({
          where: {
            employeeId: employee.id,
            logTime: new Date(parseLogTime(logTime)),
          },
        });

        if (!existingEntry) {
          await prisma.canteenEntry.create({
            data: {
              employeeId: employee.id,
              status: "PENDING",
              logTime: new Date(parseLogTime(logTime)),
              location: logLocation?.toString() || locationType,
              plantId: employee.user?.plantId,
            },
          });
          console.log(
            `Created canteen entry for employee: ${employeeCode} at location: ${locationType}`
          );
        } else {
          console.log(
            `Entry already exists for employee: ${employeeCode} at time: ${logTime}`
          );
        }
      }
    }

    console.log("Canteen entries sync completed successfully");
  } catch (error) {
    console.error("Error in syncCanteenEntries:", error);
  }
};

/**
 * Set up scheduled tasks
 */
const setupCronJobs = () => {
  cron.schedule("* * * * * *", () => {
    console.log("Running canteen entry sync job...");
    syncCanteenEntries();
  });
};

module.exports = {
  setupCronJobs,
  syncCanteenEntries,
};
