// backend/index.js
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const path = require("path");

const config = require("./config");
const { info, error } = require("./utils/logger");
const otpStore = require("./otpStore");

const authRoutes = require("./routes/authRoutes");
const { health } = require("./controllers/healthController");

const app = express();

app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORS
const allowed = config.allowedOrigins && config.allowedOrigins.length ? config.allowedOrigins : ["*"];
app.use(cors({ origin: allowed, credentials: true }));

// init otp store (redis or memory)
otpStore.init(config.redisUrl).catch((err) => {
  error("Failed to init otp store:", err);
});

// mount routes
app.use("/auth", authRoutes);
app.get("/health", health);

app.use((err, req, res, next) => {
  error("Unhandled error:", err);
  res.status(500).json({ ok: false, message: "internal error" });
});

const port = config.port || 3000;
app.listen(port, () => {
  info(`OTP backend listening on http://0.0.0.0:${port}`);
});
