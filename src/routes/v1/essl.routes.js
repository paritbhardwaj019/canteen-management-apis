const express = require("express");
const router = express.Router();
const esslController = require("../../controllers/essl.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { checkPermissions } = require("../../middlewares/rbac.middleware");

router.use(authenticate);

router.get(
  "/devices",
  // checkPermissions(["manage_devices"]),
  esslController.getAllDevices
);

router.get(
  "/logs",
  // checkPermissions(["manage_devices", "view_logs"]),
  esslController.getDeviceLogs
);

module.exports = router;
