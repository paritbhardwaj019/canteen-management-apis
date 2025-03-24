const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { getMealRequestColumns } = require("../utils/columnModles");
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
      menu: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const transformedData = data.map(request => {
    return {
      ...request,
      menuName: request.menu.name,
      menuEmpContribution: request.menu.empContribution,
      menuEmrContribution: request.menu.emrContribution,
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
  
  return {
    transformedData,
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

const getMealRequestSummary = async (filters) => {
  console.log(filters);
  const { from, to } = filters;

  const dateFilter = {};
  
  // Enhanced date filtering logic
  if (from && to) {
    // If both from and to are provided, get records between these dates
    dateFilter.date = {
      gte: new Date(new Date(from).setHours(0, 0, 0, 0)),
      lte: new Date(new Date(to).setHours(23, 59, 59, 999)),
    };
  } else if (from && !to) {
    // If only from date is provided, get records for that day only
    dateFilter.date = {
      gte: new Date(new Date(from).setHours(0, 0, 0, 0)),
      lt: new Date(new Date(from).setHours(23, 59, 59, 999)),
    };
  } else if (!from && to) {
    // If only to date is provided, get all records up to (and including) that day
    dateFilter.date = {
      lte: new Date(new Date(to).setHours(23, 59, 59, 999)),
    };
  }

  const statusCounts = await prisma.mealRequest.groupBy({
    by: ["status"],
    where: dateFilter,
    _count: {
      status: true,
    },
  });

  const mealRequests = await prisma.mealRequest.findMany({
    where: dateFilter,
    include: {
      menu: true,
    },
  });

  const mealTypeCounts = {};
  mealRequests.forEach((request) => {
    const type = request.menu.type.toLowerCase();
    mealTypeCounts[type] = (mealTypeCounts[type] || 0) + 1;
  });

  const approvedRequests = await prisma.mealRequest.findMany({
    where: {
      ...dateFilter,
    },
  });

  const totalApprovedAmount = approvedRequests.reduce(
    (sum, request) => sum + (request.totalPrice || 0),
    0
  );
  
  const totalEmployees = await prisma.employee.count({
  });


  return {
    heading: {
      totalEmployees,
      totalRequests: mealRequests.length,
      totalLunchRequests: mealTypeCounts.lunch,

      totalDinnerRequests: mealTypeCounts.dinner,
    },
    summary: {
      totalEmployees,
      totalRequests: mealRequests.length,
      totalLunchRequests: mealTypeCounts.lunch,
      totalDinnerRequests: mealTypeCounts.dinner,
      totalRequests: mealRequests.length,
      from: from || null,
      to: to || null
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
};
