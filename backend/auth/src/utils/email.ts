import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 25),
  secure: process.env.SMTP_SECURE === 'true' || Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  tls: {
    rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED === 'true'
  }
});

transporter.verify()
  .then(() => console.log('[email] transporter verified OK'))
  .catch(err => console.error('[email] transporter verify FAILED', err));

export async function sendEmail(to: string, subject: string, text: string) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  try {
    const info = await transporter.sendMail({ from, to, subject, text });
    console.log('[email] sendMail info', info);
    return info;
  } catch (err: any) {
    console.error('[email] sendMail error', err && (err.stack || err));
    throw err;
  }
}
