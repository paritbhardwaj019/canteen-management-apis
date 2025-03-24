const express = require("express");
const router = express.Router();
const canteenController = require("../../controllers/canteen.controller");
const { authenticate } = require("../../middlewares/auth.middleware");

router.get(
  "/entries/today",
  authenticate,
  canteenController.getAllTodaysEntries
);
router.put(
  "/entries/:id/approve",
  authenticate,
  canteenController.approveEntry
);
router.get(
  "/report",
  authenticate,
  canteenController.getCanteenReport
);

module.exports = router;
