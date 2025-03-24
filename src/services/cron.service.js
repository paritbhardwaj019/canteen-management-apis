const cron = require("node-cron");
const { getDeviceLogs } = require("./essl.service");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const syncCanteenEntries = async () => {
  try {
    const today = new Date();
    const date = today.toISOString().split("T")[0];
    const location = "Chennai";

    const logs = await getDeviceLogs(date, location);

    if (!logs || logs.length === 0) {
      console.log("No device logs found for processing");
      return;
    }

    for (const log of logs) {
      const { user: employeeCode, logTime, location: logLocation } = log;

      const employee = await prisma.employee.findFirst({
        where: { employeeNo: employeeCode },
      });

      if (!employee) {
        console.log(`No employee found for employeeCode: ${employeeCode}`);
        continue;
      }

      const existingEntry = await prisma.canteenEntry.findFirst({
        where: {
          employeeId: employee.id,
          logTime: new Date(logTime),
        },
      });

      if (!existingEntry) {
        await prisma.canteenEntry.create({
          data: {
            employeeId: employee.id,
            status: "PENDING",
            logTime: new Date(logTime),
            location: logLocation?.toString() || null,
          },
        });
        console.log(`Created canteen entry for employee: ${employeeCode}`);
      }
    }
  } catch (error) {
    console.error("Error in syncCanteenEntries:", error.message);
  }
};

const setupCronJobs = () => {
  cron.schedule("*/5 * * * *", () => {
    console.log("Running canteen entry sync job...");
    syncCanteenEntries();
  });
};

module.exports = {
  setupCronJobs,
};
