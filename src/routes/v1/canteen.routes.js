const express = require("express");
const router = express.Router();
const canteenController = require("../../controllers/canteen.controller");
const { authenticate } = require("../../middlewares/auth.middleware");

router.use(authenticate);

router.get(
  "/entries",
  // checkPermissions(["manage_devices"]),
  canteenController.getAllTodaysEntries
);

router.post(
  "/approveEntry",
  // checkPermissions(["manage_devices", "view_logs"]),
  canteenController.approveEntry
);

module.exports = router;
