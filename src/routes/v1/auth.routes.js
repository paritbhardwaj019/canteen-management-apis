const express = require("express");
const router = express.Router();
const authController = require("../../controllers/auth.controller");
const { authenticate } = require("../../middlewares/auth.middleware");

router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/refresh-token", authController.refreshAccessToken);
router.post("/logout", authController.logout);
router.post("/register-employee", authController.registerEmployee);
router.get("/profile", authenticate, authController.getProfile);
router.post("/logout-all", authenticate, authController.logoutAll);

module.exports = router;
