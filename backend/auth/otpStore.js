// backend/otpStore.js
const { createClient } = require("redis");
const { info, warn } = require("./utils/logger");

let redisClient = null;

function makeOtpKey(email, purpose) {
  return `otp:${purpose}:${email.toLowerCase()}`;
}
function makeRateKey(email) {
  return `rate:${email.toLowerCase()}`;
}

module.exports = {
  init: async (redisUrl) => {
    if (redisUrl) {
      try {
        const client = createClient({ url: redisUrl });
        client.on("error", (err) => warn("Redis error", err));
        await client.connect();
        redisClient = client;
        info("OTP store: using Redis");
      } catch (err) {
        warn("Could not connect to Redis, falling back to in-memory store:", err.message || err);
        redisClient = null;
      }
    } else {
      info("OTP store: using in-memory store (dev only)");
    }

    // init in-memory if needed
    if (!global.__OTP_MEM_STORE) global.__OTP_MEM_STORE = new Map();
    if (!global.__OTP_RATE_STORE) global.__OTP_RATE_STORE = new Map();
  },

  setOtp: async (email, purpose, otp, ttlSeconds) => {
    const key = makeOtpKey(email, purpose);
    if (redisClient) {
      await redisClient.set(key, otp, { EX: ttlSeconds });
    } else {
      global.__OTP_MEM_STORE.set(key, { otp, exp: Date.now() + ttlSeconds * 1000 });
    }
  },

  getOtp: async (email, purpose) => {
    const key = makeOtpKey(email, purpose);
    if (redisClient) {
      return await redisClient.get(key);
    } else {
      const entry = global.__OTP_MEM_STORE.get(key);
      if (!entry) return null;
      if (Date.now() > entry.exp) {
        global.__OTP_MEM_STORE.delete(key);
        return null;
      }
      return entry.otp;
    }
  },

  deleteOtp: async (email, purpose) => {
    const key = makeOtpKey(email, purpose);
    if (redisClient) {
      await redisClient.del(key);
    } else {
      global.__OTP_MEM_STORE.delete(key);
    }
  },

  incrRateAndCount: async (email, windowSeconds = 3600) => {
    const key = makeRateKey(email);
    const now = Math.floor(Date.now() / 1000);
    if (redisClient) {
      // sorted set for sliding window
      await redisClient.zAdd(key, [{ score: now, value: String(now) }]);
      await redisClient.zRemRangeByScore(key, 0, now - windowSeconds);
      const count = await redisClient.zCard(key);
      await redisClient.expire(key, windowSeconds + 60);
      return Number(count);
    } else {
      const arr = global.__OTP_RATE_STORE.get(key) || [];
      const filtered = arr.filter((ts) => ts >= now - windowSeconds);
      filtered.push(now);
      global.__OTP_RATE_STORE.set(key, filtered);
      return filtered.length;
    }
  },

  close: async () => {
    if (redisClient) {
      try {
        await redisClient.quit();
      } catch (e) {
        warn("Error closing redis:", e);
      }
    }
  },
};
