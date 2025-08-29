// backend/config/index.js
require("dotenv").config();
const parseList = (v) => (v ? v.split(",").map((s) => s.trim()) : []);

module.exports = {
  port: Number(process.env.PORT || 3000),
  allowedOrigins: parseList(process.env.ALLOWED_ORIGINS || "*"),
  smtp: {
    host: process.env.SMTP_HOST || "127.0.0.1",
    port: Number(process.env.SMTP_PORT || 25),
    secure: (process.env.SMTP_SECURE || "false") === "true",
    user: process.env.SMTP_USER || null,
    pass: process.env.SMTP_PASS || null,
    from: process.env.SMTP_FROM || '"No Reply" <no-reply@example.com>',
    rejectUnauthorized: (process.env.SMTP_REJECT_UNAUTHORIZED || "false") === "true",
  },
  redisUrl: process.env.REDIS_URL || "",
  otp: {
    ttlSeconds: Number(process.env.OTP_TTL_SECONDS || 600),
    length: Number(process.env.OTP_LENGTH || 6),
    maxPerHour: Number(process.env.MAX_OTPS_PER_HOUR || 5),
  },
  firebaseServiceAccount: process.env.FIREBASE_SERVICE_ACCOUNT || "",
};
