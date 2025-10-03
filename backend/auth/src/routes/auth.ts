import { Router } from 'express';
import * as authController from '../controllers/authController';

const router = Router();

// Signup & OTP
router.post('/send-otp', authController.sendOtp); // signup OTP
router.post('/verify-otp', authController.verifyOtp);
router.post('/set-password', authController.setPassword);

// Login
router.post('/login', authController.login);
router.post('/google', authController.googleLogin);

// Password reset
router.post('/forgot-password', async (req, res) => {
  // reuse sendOtp but with purpose='reset'
  req.body.purpose = 'reset';
  return authController.sendOtp(req, res);
});
router.post('/reset-password', authController.resetPassword);

export default router;
