// test-email.js
import nodemailer from "nodemailer";

// Replace these with your SMTP config
const transporter = nodemailer.createTransport({
  host: "127.0.0.1",
  port: 25,
  secure: false, // true for 465, false for other ports
  auth: {
    user: "otp@VeloCall.com",
    pass: "Akash@1234das",
  },
  tls: {
    rejectUnauthorized: false, // allow self-signed certs
  },
});

async function sendTestEmail() {
  try {
    const info = await transporter.sendMail({
      from: '"Test OTP" <otp@VeloCall.com>',
      to: "sankhasubhradas1@gmail.com", // replace with your email
      subject: "Test Email from hMailServer",
      text: "Hello! This is a test email to check SMTP settings.",
      html: "<b>Hello!</b> This is a test email to check SMTP settings.",
    });
    console.log("Email sent successfully:", info.messageId);
  } catch (err) {
    console.error("Error sending email:", err);
  }
}

sendTestEmail();
