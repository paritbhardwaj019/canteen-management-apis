const express = require("express");
const router = express.Router();
const mealRequestController = require("../../controllers/mealRequest.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { checkPermissions } = require("../../middlewares/rbac.middleware");

router.use(authenticate);

router.post("/", mealRequestController.createMealRequest);
router.get("/", mealRequestController.getAllMealRequests);
router.get(
  "/summary",
  checkPermissions(["view_reports"]),
  mealRequestController.getMealRequestSummary
);
router.get("/dashboard", mealRequestController.getDashboardData); 
router.get("/:id", mealRequestController.getMealRequestById);
router.put("/:id", mealRequestController.updateMealRequest);
router.patch("/:id/cancel", mealRequestController.cancelMealRequest);
router.delete(
  "/:id",
  checkPermissions(["manage_requests"]),
  mealRequestController.deleteMealRequest
);

module.exports = router;
