const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { getMealRequestColumns, getDashboardColumns } = require("../utils/columnModles");
const { convertToIST, convertToLocal, getISTDayBoundaries } = require("../utils/dateUtils");
const { getAllEntries } = require("./canteen.service");
const {
  notFound,
  badRequest,
  conflict,
  forbidden,
} = require("../utils/api.error");


const createMealRequest = async (requestData, userId) => {
  const { 
    menuId, 
    date, 
    quantity = 1, 
    notes,
    employeeName,
    employeeCode , 
    plantId
  } = requestData;
  console.log("plant id is", plantId);
  
  // Validate menu
  const menu = await prisma.menu.findUnique({
    where: { id: menuId },
  });

  if (!menu) {
    throw notFound("Menu not found");
  }

  // Get user's information
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });

  if (!user) {
    throw notFound("User not found");
  }

  // Determine if the user is an employee
  const isEmployee = user?.role?.name === "Employee";
  
  // Use today's date if no date is provided
  const requestDate = date ? new Date(date) : new Date();
  
  // Check for existing request
  if(isEmployee){
  const existingRequest = await prisma.mealRequest.findFirst({
    where: {
      userId: userId,
      menuId: menuId,
      date: {
        gte: new Date(new Date(requestDate).setHours(0, 0, 0, 0)),
        lt: new Date(new Date(requestDate).setHours(23, 59, 59, 999)),
      },
      status: "APPROVED",
    },
  });

  if (existingRequest) {
    throw conflict(
      "Your request is already submitted"
    );
  }

}
  // Auto-approve for employees
  const initialStatus = isEmployee ? "APPROVED" : "APPROVED";
  const approvalData = isEmployee
    ? {
        approvedBy: userId,
        approvedAt: new Date(),
      }
    : {};

  // Determine employee details
  // If user is an employee, use their own details
  // If not, use provided details or fallback to the user's details
  const actualEmployeeName = isEmployee 
    ? `${user.firstName} ${user.lastName}`.trim()
    : employeeName || `${user.firstName} ${user.lastName}`.trim();
    
  const actualEmployeeCode = isEmployee 
    ? userId 
    : employeeCode || userId;

    console.log(actualEmployeeName, actualEmployeeCode);
  return await prisma.mealRequest.create({
    data: {
      userId: userId,
      menuId: menuId,
      date: requestDate,
      quantity,
      plantId: plantId,
      notes,
      status: initialStatus,
      totalPrice: menu.price * quantity,
      ...approvalData,
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      menu: true,
    },
  });
};

const getAllMealRequests = async (filters, userId, permissions, userRole) => {
  const { status, userId: filterUserId, date, from, to } = filters;
  console.log(filters);
  const where = {};

  const isSuperAdminOrApprover =
    userRole === "Super Admin" || userRole === "Approver";

  const canViewAllRequests = permissions.includes("view_all_requests");

  if (!isSuperAdminOrApprover && !canViewAllRequests) {
    where.userId = userId;
  } else if (filterUserId) {
    where.userId = filterUserId;
  }

  if (status) {
    where.status = status;
  }

  // Date filtering logic
  if (date) {
    // If specific date is provided, get records for that day only
    const requestDate = new Date(date);
    where.date = {
      gte: new Date(new Date(requestDate).setHours(0, 0, 0, 0)),
      lt: new Date(new Date(requestDate).setHours(23, 59, 59, 999)),
    };
  } else if (from && to) {
    // If both from and to are provided, get records between these dates
    where.date = {
      gte: new Date(new Date(from).setHours(0, 0, 0, 0)),
      lte: new Date(new Date(to).setHours(23, 59, 59, 999)),
    };
  } else if (from && !to) {
    // If only from date is provided, get records for that day only
    where.date = {
      gte: new Date(new Date(from).setHours(0, 0, 0, 0)),
      lt: new Date(new Date(from).setHours(23, 59, 59, 999)),
    };
  } else if (!from && to) {
    // If only to date is provided, get all records up to (and including) that day
    where.date = {
      lte: new Date(new Date(to).setHours(23, 59, 59, 999)),
    };
  }

  const data = await prisma.mealRequest.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      plant: true,
      menu: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const transformedData = data.map(request => {
    return {
      ...request,
      date: convertToIST(request.date),
      createdAt: convertToIST(request.createdAt),
      menuName: request.menu.name,
      empContribution: request.menu.empContribution,
      emrContribution: request.menu.emrContribution,
      plantName: request.plant.name,
      plantCode: request.plant.plantCode,
      menuPrice: request.menu.price,
      menuType: request.menu.type,
      name: request.user.firstName + " " + request.user.lastName,
    };
  });

  let summary = data.reduce((acc, request) => {
    acc[request.status] = (acc[request.status] || 0) + 1;
    return acc;
  }, {});
  
  summary.total = data.length;
  summary.from = from;
  summary.to = to;
  
  console.log(summary);
  console.log(transformedData);
  return {
    data: transformedData,
    summary,
    columns: getMealRequestColumns(userRole),
  };
};

const getMealRequestById = async (id, userId, permissions) => {
  const mealRequest = await prisma.mealRequest.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      menu: true,
    },
  });

  if (!mealRequest) {
    throw notFound("Meal request not found");
  }

  const canViewAllRequests = permissions.includes("view_all_requests");

  if (!canViewAllRequests && mealRequest.userId !== userId) {
    throw forbidden("You don't have permission to view this request");
  }

  return mealRequest;
};

const updateMealRequest = async (id, requestData, userId, permissions) => {
  const { mealId, date, quantity, notes, status } = requestData;

  const existingRequest = await prisma.mealRequest.findUnique({
    where: { id },
    include: {
      menu: true,
    },
  });

  if (!existingRequest) {
    throw notFound("Meal request not found");
  }

  const canManageAllRequests = permissions.includes("manage_requests");
  const isOwnRequest = existingRequest.userId === userId;

  if (!canManageAllRequests && !isOwnRequest) {
    throw forbidden("You don't have permission to update this request");
  }

  if (!canManageAllRequests && existingRequest.status !== "PENDING") {
    throw forbidden("You can only update pending requests");
  }

  if (!canManageAllRequests && status) {
    throw forbidden("You don't have permission to change the status");
  }

  const updateData = {};

  if (mealId) {
    const meal = await prisma.meal.findUnique({
      where: { id: mealId },
    });

    if (!meal) {
      throw notFound("Meal not found");
    }

    if (!meal.isAvailable) {
      throw badRequest("This meal is currently unavailable");
    }

    updateData.mealId = mealId;
    updateData.totalPrice = quantity
      ? meal.price * quantity
      : meal.price * existingRequest.quantity;
  }

  if (date) {
    updateData.date = new Date(date);
  }

  if (quantity) {
    updateData.quantity = quantity;
    if (!updateData.totalPrice) {
      updateData.totalPrice = existingRequest.meal.price * quantity;
    }
  }

  if (notes !== undefined) {
    updateData.notes = notes;
  }

  if (status && canManageAllRequests) {
    updateData.status = status;

    if (status === "APPROVED") {
      updateData.approvedBy = userId;
      updateData.approvedAt = new Date();
    } else if (status === "REJECTED") {
      updateData.rejectedBy = userId;
      updateData.rejectedAt = new Date();
    } else if (status === "CANCELLED") {
      updateData.cancelledAt = new Date();
    } else if (status === "COMPLETED") {
      updateData.completedAt = new Date();
    }
  }

  return await prisma.mealRequest.update({
    where: { id },
    data: updateData,
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      menu: true,
    },
  });
};

const cancelMealRequest = async (id, userId, permissions) => {
  const mealRequest = await prisma.mealRequest.findUnique({
    where: { id },
  });

  if (!mealRequest) {
    throw notFound("Meal request not found");
  }

  const canManageAllRequests = permissions.includes("manage_requests");
  const isOwnRequest = mealRequest.userId === userId;

  if (!canManageAllRequests && !isOwnRequest) {
    throw forbidden("You don't have permission to cancel this request");
  }

  if (mealRequest.status !== "PENDING" && mealRequest.status !== "APPROVED") {
    throw badRequest(
      `Cannot cancel a request with status: ${mealRequest.status}`
    );
  }

  return await prisma.mealRequest.update({
    where: { id },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      menu: true,
    },
  });
};

const deleteMealRequest = async (id, userId, permissions) => {
  const mealRequest = await prisma.mealRequest.findUnique({
    where: { id },
  });

  if (!mealRequest) {
    throw notFound("Meal request not found");
  }

  if (!permissions.includes("manage_requests")) {
    throw forbidden("You don't have permission to delete requests");
  }

  await prisma.mealRequest.delete({
    where: { id },
  });

  return true;
};

const getMealRequestSummary = async (filters, user) => {
  let { from, to } = filters;

  const fromDate = from ? new Date(from) : new Date();
  const toDate = to ? new Date(to) : new Date();

  const { start: startOfDay } = getISTDayBoundaries(fromDate);
  const { end: endOfDay } = getISTDayBoundaries(toDate);

  const whereClause = {
    date: {
      gte: startOfDay,
      lte: endOfDay
    }
  };

  // Add plantId filter if provided
  if (filters.plantId) {
    whereClause.plantId = filters.plantId;
  }

  const statusCounts = await prisma.mealRequest.groupBy({
    by: ["status"],
    where: whereClause,
    _count: {
      status: true,
    },
  });

  const mealRequests = await prisma.mealRequest.findMany({
    where: whereClause,
    include: {
      menu: true,
      plant: true,
    },
  });

  const mealTypeCounts = {};
  mealRequests.forEach((request) => {
    const type = request.menu.type.toLowerCase();
    mealTypeCounts[type] = (mealTypeCounts[type] || 0) + 1;
  });

  const approvedRequests = await prisma.mealRequest.findMany({
    where: {
      ...whereClause,
    },
  });

  const totalApprovedAmount = approvedRequests.reduce(
    (sum, request) => sum + (request.totalPrice || 0),
    0
  );
  
  const totalEmployees = await prisma.employee.count({
  });

  const totalVisitors = await prisma.visitorRequest.count({
  
  });

  const today = convertToIST(new Date()).split("T")[0];
  const mealEntrys = await prisma.canteenEntry.count({
  });
  const tabledata =  await getAllMealRequests(
    {
      status: 'APPROVED',
      userId: user.id,
      date: today,
      from: today,
      to: today
    },
    user.id,
    user.permissions,
    user.role
  );
  // console.log(tabledata);
  return {
    data: tabledata.data,
    columns: getMealRequestColumns('Employee'),
    heading: {
      totalEmployees,
      totalRequests: mealRequests.length,
      totalVisitors,
      totalMeals: mealEntrys
    },
    summary: {
      totalEmployees,
      totalRequests: mealRequests.length,
      totalVisitors,
      totalMeals: mealEntrys,
      from: from || null,
      to: to || null
    },
    byStatus: statusCounts.reduce((acc, item) => {
      acc[item.status.toLowerCase()] = item._count.status;
      return acc;
    }, {}),
  };
};

const getDashboardData = async (filters, user) => {
  let { from, to } = filters;
  let plantId = user.plantId || null;

  // Convert dates and get IST boundaries
  const fromDate = from ? new Date(from) : new Date();
  const toDate = to ? new Date(to) : new Date();

  const { start: startOfDay } = getISTDayBoundaries(fromDate);
  const { end: endOfDay } = getISTDayBoundaries(toDate);

  // Display IST dates for debugging
  console.log('IST dates:', convertToLocal(fromDate), convertToLocal(toDate));
  console.log('UTC query dates:', startOfDay.toISOString(), endOfDay.toISOString());

  // Build where clause with IST boundaries
  const whereClause = {
    date: {
      gte: startOfDay,
      lte: endOfDay
    }
  };

  // Add plantId filter if provided
  if (plantId) {
    whereClause.plantId = plantId;
  }

  // Fetch meal requests with necessary relations
  const mealRequests = await prisma.mealRequest.findMany({
    where: whereClause,
    include: {
      menu: true,
      plant: true,
    },
  });

  // Get counts for each plant separately
  const getPlantSpecificCounts = async () => {
    // Get unique plant IDs from the meal requests
    const plantIds = [...new Set(
      mealRequests
        .filter(req => req.plantId !== null)
        .map(req => req.plantId)
    )];
    
    const plantCountsMap = {};
    
    // For each plant, get specific counts
    for (const plantId of plantIds) {
      const visitorCount = await prisma.visitorRequest.count({
        where: {
          plantId,
          visitDate: {
            gte: startOfDay,
            lte: endOfDay
          }
        }
      });
      
      const mealRequestCount = await prisma.mealRequest.count({
        where: {
          plantId,
          date: {
            gte: startOfDay,
            lte: endOfDay
          }
        }
      });
      
      const canteenEntryCount = await prisma.canteenEntry.count({
        where: {
          plantId,
          logTime: {
            gte: startOfDay,
            lte: endOfDay
          }
        }
      });
      
      plantCountsMap[plantId] = {
        visitorCount,
        mealRequestCount,
        canteenEntryCount
      };
    }
    
    return plantCountsMap;
  };

  // Get the plant-specific counts
  const plantCountsMap = await getPlantSpecificCounts();

  // First, group meal requests by plant
  const plantGroups = mealRequests.reduce((acc, request) => {
    const plantId = request.plantId;
    const plantCode = request.plant?.plantCode;
    
    if (!plantId || !plantCode) return acc;
    
    if (!acc[plantCode]) {
      acc[plantCode] = {
        requests: [],
        plantId,
        plantName: request.plant.name,
        plantCode
      };
    }
    
    acc[plantCode].requests.push(request);
    return acc;
  }, {});

  // Now summarize each plant group
  const plantSummaries = Object.values(plantGroups).map(group => {
    const { plantId, plantName, plantCode, requests } = group;
    
    // Example menu details from the first request (assuming same menu per plant)
    const sampleRequest = requests[0];
    
    // Get plant-specific counts
    const counts = plantCountsMap[plantId] || {
      visitorCount: 0,
      mealRequestCount: 0,
      canteenEntryCount: 0
    };
    
    // Calculate aggregates
    let totalQuantity = 0;
    let totalPrice = 0;
    let totalEmpContribution = 0;
    let totalEmrContribution = 0;
    
    requests.forEach(request => {
      totalQuantity += request.quantity;
      totalPrice += request.totalPrice || 0;
      
      const empContPerMeal = request.menu.empContribution || 0;
      const emrContPerMeal = request.menu.emrContribution || 0;
      
      totalEmpContribution += (empContPerMeal * request.quantity);
      totalEmrContribution += (emrContPerMeal * request.quantity);
    });
    
    return {
      plantId,
      plantName,
      plantCode,
      menuName: sampleRequest.menu.name,
      menuPrice: sampleRequest.menu.price,
      quantity: totalQuantity,
      empContribution: totalEmpContribution,
      emrContribution: totalEmrContribution,
      totalPrice,
      visitorCount: counts.visitorCount,
      mealRequestCount: counts.mealRequestCount,
      canteenEntryCount: counts.canteenEntryCount
    };
  });

  // Get global totals
  const totalEmployees = await prisma.employee.count();
  const totalVisitors = await prisma.visitorRequest.count({
    where: {
      visitDate: {
        gte: startOfDay,
        lte: endOfDay
      }
    }
  });
  const totalMealRequests = mealRequests.length;
  const totalCanteenEntries = await prisma.canteenEntry.count({
    where: {
      logTime: {
        gte: startOfDay,
        lte: endOfDay
      }
    }
  });

  // Status counts
  const statusCounts = await prisma.mealRequest.groupBy({
    by: ["status"],
    where: whereClause,
    _count: {
      status: true,
    },
  });

  // Use IST formatted dates for display in response
  const istFrom = convertToLocal(fromDate);
  const istTo = convertToLocal(toDate);

  return {
    data: plantSummaries,
    columns: getDashboardColumns(),
    heading: {
      totalEmployees,
      totalRequests: totalMealRequests,
      totalVisitors,
      totalMeals: totalCanteenEntries
    },
    summary: {
      totalEmployees,
      totalRequests: totalMealRequests,
      totalVisitors,
      totalMeals: totalCanteenEntries,
      from: istFrom || null,
      to: istTo || null
    },
    byStatus: statusCounts.reduce((acc, item) => {
      acc[item.status.toLowerCase()] = item._count.status;
      return acc;
    }, {}),
  };
};

// 
module.exports = {
  createMealRequest,
  getAllMealRequests,
  getMealRequestById,
  updateMealRequest,
  cancelMealRequest,
  deleteMealRequest,
  getMealRequestSummary,
  getDashboardData,
};
