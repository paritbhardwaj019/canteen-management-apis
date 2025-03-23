const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const {
  notFound,
  badRequest,
  conflict,
  forbidden,
} = require("../utils/api.error");

const createMealRequest = async (requestData, userId) => {
  const { mealId, date, quantity = 1, notes } = requestData;

  const meal = await prisma.meal.findUnique({
    where: { id: mealId },
  });

  if (!meal) {
    throw notFound("Meal not found");
  }

  if (!meal.isAvailable) {
    throw badRequest("This meal is currently unavailable");
  }

  const requestDate = new Date(date);

  const existingRequest = await prisma.mealRequest.findFirst({
    where: {
      userId: userId,
      mealId: mealId,
      date: {
        gte: new Date(requestDate.setHours(0, 0, 0, 0)),
        lt: new Date(requestDate.setHours(23, 59, 59, 999)),
      },
      status: { in: ["PENDING", "APPROVED"] },
    },
  });

  if (existingRequest) {
    throw conflict(
      "You already have a pending or approved request for this meal on this date"
    );
  }

  // Get user's role to check if auto-approval is needed
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });

  // Auto-approve for employees
  const isEmployee = user?.role?.name === "Employee";
  const initialStatus = isEmployee ? "APPROVED" : "PENDING";
  const approvalData = isEmployee
    ? {
        approvedBy: userId,
        approvedAt: new Date(),
      }
    : {};

  return await prisma.mealRequest.create({
    data: {
      userId: userId,
      mealId: mealId,
      date: new Date(date),
      quantity,
      notes,
      status: initialStatus,
      totalPrice: meal.price * quantity,
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
      meal: true,
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

  if (date) {
    const requestDate = new Date(date);
    where.date = {
      gte: new Date(requestDate.setHours(0, 0, 0, 0)),
      lt: new Date(requestDate.setHours(23, 59, 59, 999)),
    };
  } else if (from && to) {
    where.date = {
      gte: new Date(from),
      lte: new Date(to),
    };
  }

  return await prisma.mealRequest.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      meal: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
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
      meal: true,
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
      meal: true,
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
      meal: true,
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
      meal: true,
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
  const { from, to } = filters;

  const dateFilter = {};
  if (from && to) {
    dateFilter.date = {
      gte: new Date(from),
      lte: new Date(to),
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
      meal: true,
    },
  });

  const mealTypeCounts = {};
  mealRequests.forEach((request) => {
    const type = request.meal.type.toLowerCase();
    mealTypeCounts[type] = (mealTypeCounts[type] || 0) + 1;
  });

  const approvedRequests = await prisma.mealRequest.findMany({
    where: {
      ...dateFilter,
      status: { in: ["APPROVED", "COMPLETED"] },
    },
  });

  const totalApprovedAmount = approvedRequests.reduce(
    (sum, request) => sum + (request.totalPrice || 0),
    0
  );

  return {
    byStatus: statusCounts.reduce((acc, item) => {
      acc[item.status.toLowerCase()] = item._count.status;
      return acc;
    }, {}),
    byMealType: mealTypeCounts,
    totalApprovedAmount,
  };
};

module.exports = {
  createMealRequest,
  getAllMealRequests,
  getMealRequestById,
  updateMealRequest,
  cancelMealRequest,
  deleteMealRequest,
  getMealRequestSummary,
};
