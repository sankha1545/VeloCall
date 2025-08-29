// backend/controllers/authController.js
const { sendOtp, verifyOtp } = require("../services/otpService");
const { updateUserPasswordByEmail } = require("../services/firebaseService");
const { normalizeEmail } = require("../utils/helpers");
const config = require("../config");

async function handleSendOtp(req, res) {
  try {
    const { email, purpose } = req.body || {};
    if (!email || !purpose) return res.status(400).json({ ok: false, message: "email and purpose required" });

    await sendOtp(email, purpose);
    return res.json({ ok: true });
  } catch (err) {
    if (err.code === "RATE_LIMIT") return res.status(429).json({ ok: false, message: err.message });
    console.error("sendOtp error:", err);
    return res.status(500).json({ ok: false, message: err.message || "internal error" });
  }
}

async function handleVerifyOtp(req, res) {
  try {
    const { email, otp, purpose } = req.body || {};
    if (!email || !otp || !purpose) return res.status(400).json({ ok: false, message: "email, otp, purpose required" });

    const ok = await verifyOtp(email, purpose, otp);
    return res.json({ ok });
  } catch (err) {
    console.error("verifyOtp error:", err);
    return res.status(500).json({ ok: false, message: "internal error" });
  }
}

async function handleResetPassword(req, res) {
  try {
    const { email, otp, newPassword } = req.body || {};
    if (!email || !otp || !newPassword) return res.status(400).json({ ok: false, message: "email, otp, newPassword required" });

    const verified = await verifyOtp(email, "reset", otp);
    if (!verified) return res.status(400).json({ ok: false, message: "invalid_or_expired_otp" });

    // update password in Firebase Admin if configured
    try {
      await updateUserPasswordByEmail(normalizeEmail(email), newPassword);
      return res.json({ ok: true });
    } catch (err) {
      console.error("firebase update error:", err);
      // If admin not configured, still return ok but warn (up to your policy)
      return res.status(500).json({ ok: false, message: "Failed to update password server-side. Configure Firebase Admin." });
    }
  } catch (err) {
    console.error("resetPassword error:", err);
    return res.status(500).json({ ok: false, message: "internal error" });
  }
}

module.exports = { handleSendOtp, handleVerifyOtp, handleResetPassword };
