const plantService = require("../services/plant.service");
const asyncHandler = require("../utils/async.handler");
const { badRequest, notFound } = require("../utils/api.error");
const ApiResponse = require("../utils/api.response");

/**
 * Create a new plant
 */
const createPlant = asyncHandler(async (req, res) => {
  const { name, plantCode, location, serialNumber, deviceName } = req.body;

  // Validate required fields
  if (!name || !plantCode) {
    throw badRequest("Name and plant code are required");
  }

  const plant = await plantService.createPlant(
    {
      name,
      plantCode,
      location,
      serialNumber,
      deviceName,
    },
    req.user
  );

  return ApiResponse.created(res, "Plant created successfully", plant);
});

/**
 * Get all plants with optional filters
 */
const getAllPlants = asyncHandler(async (req, res) => {
  const { name, plantCode, page, limit, sortBy, sortOrder } = req.query;

  const filter = {};
  if (name) filter.name = name;
  if (plantCode) filter.plantCode = plantCode;

  const options = {
    page: page ? parseInt(page, 10) : 1,
    limit: limit ? parseInt(limit, 10) : 10,
    sortBy,
    sortOrder,
  };

  const result = await plantService.getAllPlants(filter, options, req.user);

  return ApiResponse.ok(res, "Plants retrieved successfully", result);
});

/**
 * Get plant by ID
 */
const getPlantById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const plant = await plantService.getPlantById(id);

  return ApiResponse.ok(res, "Plant retrieved successfully", plant);
});

/**
 * Update a plant
 */
const updatePlant = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    name,
    plantCode,
    location,
    serialNumber,
    deviceName,
    removePlantHead,
  } = req.body;

  const updatedPlant = await plantService.updatePlant(
    id,
    {
      name,
      plantCode,
      location,
      serialNumber,
      deviceName,
      removePlantHead,
    },
    req.user
  );

  return ApiResponse.ok(res, "Plant updated successfully", updatedPlant);
});

/**
 * Delete a plant
 */
const deletePlant = asyncHandler(async (req, res) => {
  const { id } = req.params;

  await plantService.deletePlant(id);

  return ApiResponse.ok(res, "Plant deleted successfully");
});

/**
 * Add a user to a plant with option to make them plant head
 */
const addUserToPlant = asyncHandler(async (req, res) => {
  const {
    firstName,
    lastName,
    email,
    password,
    department,
    role,
    isPlantHead = false,
    plantId,
  } = req.body;

  // Required fields
  if (!firstName || !lastName || !email || !password || !role) {
    throw badRequest(
      "First name, last name, email, password, and role are required"
    );
  }

  // If the current user is a Plant Head, use their plant by default
  let targetPlantId = plantId;

  if (!targetPlantId && req.user.role === "Plant Head" && req.user.plantId) {
    targetPlantId = req.user.plantId;
  } else if (!targetPlantId && isPlantHead) {
    throw badRequest("Plant ID is required when assigning a plant head");
  }

  // Create or get user, then add to plant
  const result = await plantService.addUserToPlant(
    {
      firstName,
      lastName,
      email,
      password,
      department,
      role,
      plantId: targetPlantId,
      isPlantHead,
    },
    req.user
  );

  return ApiResponse.created(res, "User added to plant successfully", result);
});

/**
 * Remove a user from a plant
 */
const removeUserFromPlant = asyncHandler(async (req, res) => {
  const { userId, plantId } = req.body;

  if (!userId) {
    throw badRequest("User ID is required");
  }

  // If the current user is a Plant Head, use their plant by default
  let targetPlantId = plantId;

  if (!targetPlantId && req.user.role === "Plant Head" && req.user.plantId) {
    targetPlantId = req.user.plantId;
  } else if (!targetPlantId) {
    throw badRequest("Plant ID is required");
  }

  const result = await plantService.removeUserFromPlant(
    targetPlantId,
    userId,
    req.user
  );

  return ApiResponse.ok(res, "User removed from plant successfully", result);
});

/**
 * Get users who can be added to a plant
 */
const getAvailableUsers = asyncHandler(async (req, res) => {
  const { plantId } = req.params;

  if (!plantId) {
    throw badRequest("Plant ID is required");
  }

  const users = await plantService.getAvailableUsers(plantId);

  return ApiResponse.ok(res, "Available users retrieved successfully", users);
});

/**
 * Get all users assigned to a plant
 */
const getPlantUsers = asyncHandler(async (req, res) => {
  const { plantId } = req.params;

  // If user is a Plant Head, use their plant by default
  let targetPlantId = plantId;

  if (!targetPlantId && req.user.role === "Plant Head" && req.user.plantId) {
    targetPlantId = req.user.plantId;
  } else if (!targetPlantId) {
    throw badRequest("Plant ID is required");
  }

  const result = await plantService.getPlantUsers(targetPlantId);

  return ApiResponse.ok(res, "Plant users retrieved successfully", result);
});

module.exports = {
  createPlant,
  getAllPlants,
  getPlantById,
  updatePlant,
  deletePlant,
  addUserToPlant,
  removeUserFromPlant,
  getAvailableUsers,
  getPlantUsers,
};
