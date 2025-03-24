const express = require("express");
const router = express.Router();
const plantController = require("../../controllers/plant.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const {
  checkPermissions,
  checkRole,
} = require("../../middlewares/rbac.middleware");

router.use(authenticate);

router.post("/", checkRole(["Super Admin"]), plantController.createPlant);

router.get(
  "/",
  checkPermissions(["view_plants"]),
  plantController.getAllPlants
);

router.get(
  "/:id",
  checkPermissions(["view_plants"]),
  plantController.getPlantById
);

router.put("/:id", checkRole(["Super Admin"]), plantController.updatePlant);

router.delete("/:id", checkRole(["Super Admin"]), plantController.deletePlant);

router.post(
  "/users",
  checkPermissions(["manage_plant_users"]),
  plantController.addUserToPlant
);

router.post(
  "/users/remove",
  checkPermissions(["manage_plant_users"]),
  plantController.removeUserFromPlant
);

router.get(
  "/:plantId/users",
  checkPermissions(["view_plants"]),
  plantController.getPlantUsers
);

router.get(
  "/:plantId/available-users",
  checkPermissions(["manage_plant_users"]),
  plantController.getAvailableUsers
);

module.exports = router;
