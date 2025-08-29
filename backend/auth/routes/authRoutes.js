// backend/routes/authRoutes.js
const express = require("express");
const router = express.Router();
const { handleSendOtp, handleVerifyOtp, handleResetPassword } = require("../controllers/authController");

// POST /auth/send-otp
router.post("/send-otp", handleSendOtp);

// POST /auth/verify-otp
router.post("/verify-otp", handleVerifyOtp);

// POST /auth/reset-password
router.post("/reset-password", handleResetPassword);

module.exports = router;
