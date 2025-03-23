const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { notFound, conflict } = require("../utils/api.error");

/**
 * Create a new meal
 * @param {Object} mealData - Meal data
 * @returns {Object} Newly created meal
 */
const createMeal = async (mealData) => {
  const { name, description, type, menuId, price } = mealData;

  const menu = await prisma.menu.findUnique({
    where: { id: menuId },
  });

  if (!menu) {
    throw notFound("Menu not found");
  }

  return await prisma.meal.create({
    data: {
      name,
      description,
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

module.exports = {
  createMeal,
  getAllMeals,
  getMealById,
  updateMeal,
  deleteMeal,
};
