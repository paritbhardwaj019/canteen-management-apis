const express = require("express");
const router = express.Router();
const visitorAuthController = require("../../controllers/visitorAuth.controller");

/**
 * @route POST /api/visitor-auth/signup
 * @desc Register a new visitor
 * @access Public
 */
router.post("/signup", visitorAuthController.visitorSignup);

/**
 * @route POST /api/visitor-auth/login
 * @desc Login a visitor
 * @access Public
 */
router.post("/login", visitorAuthController.visitorLogin);

module.exports = router;
