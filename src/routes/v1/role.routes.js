const express = require("express");
const router = express.Router();
const roleController = require("../../controllers/role.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { checkPermissions } = require("../../middlewares/rbac.middleware");

router.use(authenticate);

router.post("/", checkPermissions(["manage_roles"]), roleController.createRole);
router.get("/", checkPermissions(["manage_roles"]), roleController.getAllRoles);
router.get(
  "/:id",
  checkPermissions(["manage_roles"]),
  roleController.getRoleById
);
router.put(
  "/:id",
  checkPermissions(["manage_roles"]),
  roleController.updateRole
);
router.delete(
  "/:id",
  checkPermissions(["manage_roles"]),
  roleController.deleteRole
);

router.post(
  "/permissions",
  checkPermissions(["manage_roles"]),
  roleController.createPermission
);
router.get(
  "/permissions",
  checkPermissions(["manage_roles"]),
  roleController.getAllPermissions
);

module.exports = router;
