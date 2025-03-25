const express = require("express");
const router = express.Router();
const visitorAuthController = require("../../controllers/visitorAuth.controller");
const {
  uploadVisitorPhoto,
  handleMulterError,
} = require("../../middlewares/upload.middleware");

/**
 * @route POST /api/visitor-auth/signup
 * @desc Register a new visitor with optional photo upload
 * @access Public
 */
router.post(
  "/signup",
  uploadVisitorPhoto,
  handleMulterError,
  visitorAuthController.visitorSignup
);

/**
 * @route POST /api/visitor-auth/login
 * @desc Login a visitor
 * @access Public
 */
router.post("/login", visitorAuthController.visitorLogin);

module.exports = router;
