const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { notFound, conflict } = require("../utils/api.error");

/**
 * Create a new meal
 * @param {Object} mealData - Meal data
 * @returns {Object} Newly created meal
 */
const createMeal = async (mealData) => {
  const { type, menuId, price } = mealData;

  const menu = await prisma.menu.findUnique({
    where: { id: menuId },
  });

  if (!menu) {
    throw notFound("Menu not found");
  }

  return await prisma.meal.create({
    data: {
      name : "meal",
      description : "meal",
      type,
      menuId,
      price,
    },
    include: {
      menu: true,
    },
  });
};

/**
 * Get all meals
 * @param {Object} filters - Optional filters
 * @returns {Array} List of meals
 */
const getAllMeals = async (filters = {}) => {
  const { menuId, type, isAvailable } = filters;

  const where = {};

  if (menuId) {
    where.menuId = menuId;
  }

  if (type) {
    where.type = type;
  }

  if (isAvailable !== undefined) {
    where.isAvailable = isAvailable === "true" || isAvailable === true;
  }

  return await prisma.meal.findMany({
    where,
    include: {
      menu: true,
    },
    orderBy: {
      name: "asc",
    },
  });
};

/**
 * Get meal by ID
 * @param {String} id - Meal ID
 * @returns {Object} Meal data
 */
const getMealById = async (id) => {
  const meal = await prisma.meal.findUnique({
    where: { id },
    include: {
      menu: true,
    },
  });

  if (!meal) {
    throw notFound("Meal not found");
  }

  return meal;
};

/**
 * Update a meal
 * @param {String} id - Meal ID
 * @param {Object} mealData - Meal data to update
 * @returns {Object} Updated meal
 */
const updateMeal = async (id, mealData) => {
  const { name, description, type, menuId, price, isAvailable } = mealData;

  const existingMeal = await prisma.meal.findUnique({
    where: { id },
  });

  if (!existingMeal) {
    throw notFound("Meal not found");
  }

  if (menuId) {
    const menu = await prisma.menu.findUnique({
      where: { id: menuId },
    });

    if (!menu) {
      throw notFound("Menu not found");
    }
  }

  return await prisma.meal.update({
    where: { id },
    data: {
      name,
      description,
      type,
      menuId,
      price,
      isAvailable,
    },
    include: {
      menu: true,
    },
  });
};

/**
 * Delete a meal
 * @param {String} id - Meal ID
 * @returns {Object} Deleted meal
 */
const deleteMeal = async (id) => {
  const existingMeal = await prisma.meal.findUnique({
    where: { id },
    include: {
      mealRequests: true,
    },
  });

  if (!existingMeal) {
    throw notFound("Meal not found");
  }

  const activeRequests = existingMeal.mealRequests.filter(
    (request) => request.status === "PENDING"
  );

  if (activeRequests.length > 0) {
    throw conflict("Cannot delete meal with pending requests");
  }

  return await prisma.meal.delete({
    where: { id },
  });
};


// menu creation and handling

const createMenu = async (menuData) => {
  const { type, price, empContribution } = menuData;

  let emrContribution = parseInt(price) - parseInt(empContribution);

  return await prisma.menu.create({
    data: {
      type,
      price,
      empContribution,
      emrContribution,
    },
  });
};

const getAllMenus = async () => {
  return await prisma.menu.findMany();
};
const updateMenu = async (id, menuData) => {
  const { type, price, empContribution } = menuData;

  const existingMenu = await prisma.menu.findUnique({
    where: { id },
  });

  if (!existingMenu) {
    throw notFound("Menu not found");
  }

  // Initialize with existing values
  let newPrice = existingMenu.price;
  let newEmpContribution = existingMenu.empContribution;
  let newEmrContribution = existingMenu.emrContribution;

  // Case 1: User updates price and empContribution
  if (price !== undefined && empContribution !== undefined) {
    newPrice = parseInt(price);
    newEmpContribution = parseInt(empContribution);
    newEmrContribution = newPrice - newEmpContribution;
  } 
  // Case 2: User updates only price - this is not allowed
  else if (price !== undefined && empContribution === undefined) {
    throw badRequest("Employee contribution (empContribution) must be provided when updating price");
  }
  // Case 3: User updates only empContribution
  else if (empContribution !== undefined) {
    newEmpContribution = parseInt(empContribution);
    newEmrContribution = newPrice - newEmpContribution;
  }

  return await prisma.menu.update({
    where: { id },
    data: {
      type,
      price: newPrice,
      empContribution: newEmpContribution,
      emrContribution: newEmrContribution,
    },
  });
};

const deleteMenu = async (id) => {  
  return await prisma.menu.delete({
    where: { id },
  });
};

module.exports = {
  createMeal,
  getAllMeals,
  getMealById,
  updateMeal,
  deleteMeal,
  createMenu,
  getAllMenus,
  updateMenu,
  deleteMenu,
};
