// backend/mailer.js
const nodemailer = require("nodemailer");
const config = require("./config");
const { info } = require("./utils/logger");

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.secure,
  auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  tls: { rejectUnauthorized: config.smtp.rejectUnauthorized === true },
});

async function sendMail({ to, subject, text, html }) {
  const msg = {
    from: config.smtp.from,
    to,
    subject,
    text,
    html,
  };
  const infoResult = await transporter.sendMail(msg);
  info("Email sent:", infoResult.messageId || infoResult.response);
  return infoResult;
}

module.exports = { sendMail };
