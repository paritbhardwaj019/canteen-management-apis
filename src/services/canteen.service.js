const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { getDeviceLogs } = require("../services/essl.service");

/**
 * Get all entries from the essl
 * @param {Object} filters - Optional filters
 * @returns {Array} List of meals
 */
const getAllEntries = async (loggedInUser) => {
  const { role, plantId } = loggedInUser;

  if (role === "EMPLOYEE") {
    throw badRequest("You are not authorized to access this resource");
  }

  const today = new Date();
  const date = today.toISOString().split("T")[0];
  const entries = await getDeviceLogs(date, plantId || 1);
  const employees = await prisma.user.findMany({
    where: {
      role: {
        name: "EMPLOYEE",
      },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      roleId: true,
      role: {
        select: {
          name: true,
        },
      },
    },
  });
  console.log("employees", employees);
  console.log("entries", entries);
  return entries;
};

const approveEntry = async (id, status) => {
  const entry = await prisma.canteenEntry.update({
    where: { id },
    data: { status },
  });
  return entry;
};

module.exports = {
  getAllEntries,
  approveEntry,
};
