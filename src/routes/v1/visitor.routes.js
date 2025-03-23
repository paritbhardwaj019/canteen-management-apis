const express = require("express");
const router = express.Router();
const visitorController = require("../../controllers/visitor.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { checkPermissions } = require("../../middlewares/rbac.middleware");
const { optionalAuth } = require("../../middlewares/auth.middleware");

router.get(
  "/status/:ticketId",
  optionalAuth,
  visitorController.getVisitorStatus
);

router.use(authenticate);

router.get("/my-requests", visitorController.getVisitorRequests);

router.get("/my-records", visitorController.getVisitorRecords);

router.get(
  "/find",
  checkPermissions(["manage_visitors"]),
  visitorController.findVisitors
);

router.post("/request/add", visitorController.registerVisitorRequest);

router.put(
  "/process/:ticketId",
  checkPermissions(["approve_visitors"]),
  visitorController.processVisitorRequest
);

router.get(
  "/requests",
  checkPermissions(["view_visitors"]),
  visitorController.getVisitorRequests
);

router.post(
  "/entry/:ticketId",
  checkPermissions(["manage_visitors"]),
  visitorController.handleVisitorEntry
);

router.get(
  "/records",
  checkPermissions(["view_reports"]),
  visitorController.getVisitorRecords
);

module.exports = router;
