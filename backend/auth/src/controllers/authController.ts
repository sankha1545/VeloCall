import { Request, Response } from 'express';
import * as svc from '../services/authService';

export const sendOtp = async (req: Request, res: Response) => {
  const { email, purpose } = req.body; // purpose: 'signup' | 'reset'
  if (!email) return res.status(400).json({ ok: false, error: 'Email is required' });

  try {
    await svc.createAndSendOtp(email as string, (purpose as string) || 'signup');
    return res.json({ ok: true });
  } catch (e: any) {
    console.error('[authController] sendOtp error:', e.message);
    return res.status(400).json({ ok: false, error: e.message });
  }
};

export const verifyOtp = async (req: Request, res: Response) => {
  const { email, otp, purpose } = req.body;
  if (!email || !otp) return res.status(400).json({ ok: false, error: 'Email and OTP are required' });

  try {
    const ok = await svc.verifyOtp(email as string, otp as string, (purpose as string) || 'signup');
    return res.json({ ok });
  } catch (e: any) {
    console.error('[authController] verifyOtp error:', e.message);
    return res.status(400).json({ ok: false, error: e.message });
  }
};

export const setPassword = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ ok: false, error: 'Email and password are required' });

  try {
    await svc.setPassword(email as string, password as string);
    return res.json({ ok: true });
  } catch (e: any) {
    console.error('[authController] setPassword error:', e.message);
    return res.status(400).json({ ok: false, error: e.message });
  }
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ ok: false, error: 'Email and password are required' });

  try {
    const token = await svc.login(email as string, password as string);
    return res.json({ ok: true, token });
  } catch (e: any) {
    console.error('[authController] login error:', e.message);
    return res.status(401).json({ ok: false, error: e.message });
  }
};

export const googleLogin = async (req: Request, res: Response) => {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ ok: false, error: 'idToken is required' });

  try {
    const token = await svc.googleLogin(idToken as string);
    return res.json({ ok: true, token });
  } catch (e: any) {
    console.error('[authController] googleLogin error:', e.message);
    return res.status(401).json({ ok: false, error: e.message });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ ok: false, error: 'Email and password are required' });

  try {
    await svc.resetPassword(email as string, password as string);
    return res.json({ ok: true });
  } catch (e: any) {
    console.error('[authController] resetPassword error:', e.message);
    return res.status(400).json({ ok: false, error: e.message });
  }
};
