// backend/middleware/validateRequest.js
// simple request-body validator helper factory
module.exports = function requiredFields(fields = []) {
  return (req, res, next) => {
    const missing = [];
    fields.forEach((f) => {
      if (!req.body || typeof req.body[f] === "undefined" || req.body[f] === null || req.body[f] === "") missing.push(f);
    });
    if (missing.length) return res.status(400).json({ ok: false, message: `Missing fields: ${missing.join(", ")}` });
    next();
  };
};
