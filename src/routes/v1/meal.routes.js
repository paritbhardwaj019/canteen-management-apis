const express = require("express");
const router = express.Router();
const mealController = require("../../controllers/meal.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { checkPermissions } = require("../../middlewares/rbac.middleware");

router.use(authenticate);

router.get("/", mealController.getAllMeals);
router.get("/:id", mealController.getMealById);

router.post("/", checkPermissions(["manage_meals"]), mealController.createMeal);
router.put(
  "/:id",
  checkPermissions(["manage_meals"]),
  mealController.updateMeal
);
router.delete(
  "/:id",
  checkPermissions(["manage_meals"]),
  mealController.deleteMeal
);



// menu creation and handling

router.get("/menu/all", mealController.getAllMenus);
router.post("/menu/add",  mealController.createMenu);
router.put("/menu/:id",  mealController.updateMenu);
router.delete("/menu/:id", mealController.deleteMenu);

module.exports = router;
