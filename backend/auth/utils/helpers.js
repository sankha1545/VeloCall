// backend/utils/helpers.js
function normalizeEmail(email) {
  if (!email || typeof email !== "string") return email;
  return email.trim().toLowerCase();
}

module.exports = { normalizeEmail };
