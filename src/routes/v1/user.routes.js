const express = require("express");
const router = express.Router();
const userController = require("../../controllers/user.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { checkPermissions } = require("../../middlewares/rbac.middleware");

router.use(authenticate);

router.get("/", checkPermissions(["manage_users"]), userController.getAllUsers);
router.get(
  "/:id",
  checkPermissions(["manage_users"]),
  userController.getUserById
);
router.post("/", checkPermissions(["manage_users"]), userController.createUser);
router.put(
  "/:id",
  checkPermissions(["manage_users"]),
  userController.updateUser
);
router.delete(
  "/:id",
  checkPermissions(["manage_users"]),
  userController.deleteUser
);
router.post(
  "/:id/reset-password",
  checkPermissions(["manage_users"]),
  userController.resetUserPassword
);

router.post("/change-password", userController.changeOwnPassword);

module.exports = router;
