// services/otpService.js
const crypto = require("crypto");
const { sendEmail } = require("./emailService");

// Configurable via env
const TTL_MS = Number(process.env.OTP_TTL_MS || 5 * 60 * 1000); // 5 minutes
const OTP_LENGTH = Number(process.env.OTP_LENGTH || 6);
const ALLOWED_PURPOSES = new Set(["signup", "reset"]);

// In-memory store (use Redis for production)
const otpStore = new Map();
// Track cleanup timers to avoid leaks
const cleanupTimers = new Map();

/** Crypto-strong numeric OTP, zero-padded */
function generateOtp(length = OTP_LENGTH) {
  const max = 10 ** length;
  const n = crypto.randomInt(0, max);
  return String(n).padStart(length, "0");
}

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

function key(email, purpose) {
  return `${purpose}:${normalizeEmail(email)}`;
}

async function sendOtp(email, purpose) {
  if (!email || typeof email !== "string" || !email.includes("@")) {
    throw new Error("invalid email");
  }
  if (!ALLOWED_PURPOSES.has(purpose)) {
    throw new Error("invalid purpose");
  }

  const k = key(email, purpose);
  const otp = generateOtp();
  const expiresAt = Date.now() + TTL_MS;

  otpStore.set(k, { otp, expiresAt });

  // Auto-expire cleanup
  if (cleanupTimers.has(k)) clearTimeout(cleanupTimers.get(k));
  cleanupTimers.set(
    k,
    setTimeout(() => {
      otpStore.delete(k);
      cleanupTimers.delete(k);
    }, TTL_MS)
  );

  const subject = purpose === "signup" ? "Your signup OTP" : "Your password reset OTP";
  const text = `Your OTP is ${otp}. It expires in ${Math.round(TTL_MS / 60000)} minutes.`;

  await sendEmail(email, subject, text);

  return true;
}

function verifyOtp(email, purpose, otp) {
  if (!ALLOWED_PURPOSES.has(purpose)) return false;
  const k = key(email, purpose);
  const rec = otpStore.get(k);
  if (!rec) return false;
  if (rec.expiresAt < Date.now()) {
    otpStore.delete(k);
    if (cleanupTimers.has(k)) {
      clearTimeout(cleanupTimers.get(k));
      cleanupTimers.delete(k);
    }
    return false;
  }

  // Constant-time compare
  const a = Buffer.from(rec.otp);
  const b = Buffer.from(String(otp || ""));
  const equal = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!equal) return false;

  // Consume OTP
  otpStore.delete(k);
  if (cleanupTimers.has(k)) {
    clearTimeout(cleanupTimers.get(k));
    cleanupTimers.delete(k);
  }
  return true;
}

module.exports = { sendOtp, verifyOtp };
