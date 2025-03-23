const express = require("express");
const router = express.Router();
const permissionController = require("../../controllers/permission.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { checkPermissions } = require("../../middlewares/rbac.middleware");

router.use(authenticate);
router.use(checkPermissions(["manage_roles"]));

router.post("/", permissionController.createPermission);
router.get("/", permissionController.getAllPermissions);
router.get("/:id", permissionController.getPermissionById);
router.put("/:id", permissionController.updatePermission);
router.delete("/:id", permissionController.deletePermission);

router.post(
  "/roles/:roleId/assign",
  permissionController.assignPermissionsToRole
);
router.post(
  "/roles/:roleId/remove",
  permissionController.removePermissionsFromRole
);

module.exports = router;
