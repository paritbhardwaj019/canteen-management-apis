const mealService = require("../services/meal.service");
const asyncHandler = require("../utils/async.handler");
const { badRequest } = require("../utils/api.error");
const ApiResponse = require("../utils/api.response");

/**
 * Create a new meal
 */
const createMeal = asyncHandler(async (req, res) => {
  const { name, description, type, menuId, price } = req.body;

  // Validate required fields
  if (!name || !type || !menuId || price === undefined) {
    throw badRequest("Name, type, menuId, and price are required");
  }

  const newMeal = await mealService.createMeal({
    name,
    description,
    type,
    menuId,
    price: parseFloat(price),
  });

  return ApiResponse.created(res, "Meal created successfully", newMeal);
});

/**
 * Get all meals
 */
const getAllMeals = asyncHandler(async (req, res) => {
  const { menuId, type, isAvailable } = req.query;

  const meals = await mealService.getAllMeals({
    menuId,
    type,
    isAvailable,
  });

  return ApiResponse.collection(res, "Meals retrieved successfully", meals);
});

/**
 * Get meal by ID
 */
const getMealById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const meal = await mealService.getMealById(id);

  return ApiResponse.ok(res, "Meal retrieved successfully", meal);
});

/**
 * Update a meal
 */
const updateMeal = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, type, menuId, price, isAvailable } = req.body;

  // Validate price if provided
  if (price !== undefined) {
    const numPrice = parseFloat(price);
    if (isNaN(numPrice)) {
      throw badRequest("Price must be a valid number");
    }
  }

  const updatedMeal = await mealService.updateMeal(id, {
    name,
    description,
    type,
    menuId,
    price: price !== undefined ? parseFloat(price) : undefined,
    isAvailable,
  });

  return ApiResponse.ok(res, "Meal updated successfully", updatedMeal);
});

/**
 * Delete a meal
 */
const deleteMeal = asyncHandler(async (req, res) => {
  const { id } = req.params;

  await mealService.deleteMeal(id);

  return ApiResponse.ok(res, "Meal deleted successfully");
});


// menu creation and handling

const createMenu = asyncHandler(async (req, res) => {

  const menu = await mealService.createMenu(req.body);
  return ApiResponse.created(res, "Menu created successfully", menu);
});

const getAllMenus = asyncHandler(async (req, res) => {
  const menus = await mealService.getAllMenus(req.user.role);
  return ApiResponse.collection(res, "Menus retrieved successfully", menus);
});

const updateMenu = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const menu = await mealService.updateMenu(id, req.body);
  return ApiResponse.ok(res, "Menu updated successfully", menu);
});

const deleteMenu = asyncHandler(async (req, res) => {
  const { id } = req.params;

  await mealService.deleteMenu(id);
  return ApiResponse.ok(res, "Menu deleted successfully");
});







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
