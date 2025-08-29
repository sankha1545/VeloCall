// services/mailService.js
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "127.0.0.1",
  port: Number(process.env.SMTP_PORT || 25),
  secure: process.env.SMTP_SECURE === "true", // true for 465, false otherwise
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined,
  tls: {
    // for self-signed/dev SMTP like some hMailServer setups
    rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED === "true",
  },
});

async function sendEmail(to, subject, text, html) {
  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || "No Reply <no-reply@example.com>",
    to,
    subject,
    text,
    html,
  });
  return info;
}

module.exports = { sendEmail };
