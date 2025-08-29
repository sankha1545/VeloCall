// backend/utils/logger.js
const info = (...args) => console.log(new Date().toISOString(), "[INFO]", ...args);
const warn = (...args) => console.warn(new Date().toISOString(), "[WARN]", ...args);
const error = (...args) => console.error(new Date().toISOString(), "[ERROR]", ...args);

module.exports = { info, warn, error };
