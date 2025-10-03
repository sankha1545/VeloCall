import { db, auth as firebaseAuth } from '../firebaseAdmin';
import { sendEmail } from '../utils/email';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { generateOtp } from '../utils/crypto';

const OTP_EXP_MIN = Number(process.env.OTP_EXPIRATION_MIN || 10);
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

/**
 * Generate OTP, store in Firestore, and send via email
 */
export async function createAndSendOtp(email: string, purpose = 'signup') {
  const otp = generateOtp(); // 6-digit string
  const hash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + OTP_EXP_MIN * 60000);

  await db.collection('otps').add({ email, hash, purpose, expiresAt });

  const subject = purpose === 'signup' ? 'Your signup OTP' : 'Reset password OTP';
  const text = `Your OTP is ${otp}. It expires in ${OTP_EXP_MIN} minutes.`;

  try {
    await sendEmail(email, subject, text);
    console.log(`[authService] OTP sent to ${email} for ${purpose}`);
  } catch (err: any) {
    console.error(`[authService] Failed to send OTP to ${email}:`, err.message || err);
    throw new Error('Failed to send OTP email');
  }
}

/**
 * Verify OTP for a given email and purpose
 */
export async function verifyOtp(email: string, otp: string, purpose = 'signup') {
  const q = await db.collection('otps')
    .where('email', '==', email)
    .where('purpose', '==', purpose)
    .orderBy('expiresAt', 'desc')
    .limit(1)
    .get();

  if (q.empty) throw new Error('OTP not found');
  const doc = q.docs[0];
  const data: any = doc.data();

  if (!data.expiresAt || data.expiresAt.toDate() < new Date()) {
    await doc.ref.delete();
    throw new Error('OTP expired');
  }

  const match = await bcrypt.compare(otp, data.hash);
  if (!match) throw new Error('Invalid OTP');

  await doc.ref.delete();

  if (purpose === 'signup') {
    const usersRef = db.collection('users');
    const existing = await usersRef.where('email', '==', email).limit(1).get();
    if (existing.empty) {
      await usersRef.add({ email, isVerified: true, provider: 'local', createdAt: new Date() });
    } else {
      const udoc = existing.docs[0];
      await udoc.ref.update({ isVerified: true });
    }
  }

  return true;
}

/**
 * Set or update password for a user
 */
export async function setPassword(email: string, password: string) {
  const usersRef = db.collection('users');
  const q = await usersRef.where('email', '==', email).limit(1).get();
  const hash = await bcrypt.hash(password, 10);

  if (q.empty) {
    await usersRef.add({ email, passwordHash: hash, isVerified: true, provider: 'local', createdAt: new Date() });
  } else {
    const doc = q.docs[0];
    await doc.ref.update({ passwordHash: hash });
  }
}

/**
 * Login user with email/password and return JWT
 */
export async function login(email: string, password: string) {
  const usersRef = db.collection('users');
  const q = await usersRef.where('email', '==', email).limit(1).get();
  if (q.empty) throw new Error('User not found');

  const data: any = q.docs[0].data();
  if (!data.passwordHash) throw new Error('No password set');

  const ok = await bcrypt.compare(password, data.passwordHash);
  if (!ok) throw new Error('Invalid credentials');

  const token = jwt.sign({ email, provider: 'local' }, JWT_SECRET, { expiresIn: '7d' });
  return token;
}

/**
 * Google login via Firebase ID token
 */
export async function googleLogin(idToken: string) {
  const decoded = await firebaseAuth.verifyIdToken(idToken);
  const email = decoded.email;
  if (!email) throw new Error('No email in token');

  const usersRef = db.collection('users');
  const q = await usersRef.where('email', '==', email).limit(1).get();

  if (q.empty) {
    await usersRef.add({
      email,
      isVerified: true,
      provider: 'google',
      googleId: decoded.uid,
      createdAt: new Date()
    });
  } else {
    const doc = q.docs[0];
    await doc.ref.update({
      isVerified: true,
      provider: 'google',
      googleId: decoded.uid
    });
  }

  const token = jwt.sign({ email, provider: 'google' }, JWT_SECRET, { expiresIn: '7d' });
  return token;
}

/**
 * Reset password (wrapper for setPassword)
 */
export async function resetPassword(email: string, password: string) {
  return setPassword(email, password);
}
