import { Router } from 'express';
import passport from '../config/passport';

const router = Router();

// Redirect to Google for authentication
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

// Google callback URL
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false }),
  (req: any, res) => {
    // On successful authentication, redirect with JWT
    const token = req.user.token;
    res.redirect(`http://localhost:5173/auth/callback?token=${token}`);
  }
);

export default router;