// backend/controllers/healthController.js
const otpStore = require("../otpStore");
const { info } = require("../utils/logger");

async function health(req, res) {
  // simple health check
  res.json({ ok: true });
}

module.exports = { health };
