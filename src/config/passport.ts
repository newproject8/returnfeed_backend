import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import jwt from 'jsonwebtoken';
import pool from '../db';

// Only configure Google OAuth if credentials are provided
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: '/api/auth/google/callback',
      },
      async (accessToken, refreshToken, profile, done) => {
        const { email, name, picture } = profile._json;
        
        try {
          // Find user in the database
          let userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

          if (userResult.rows.length === 0) {
            // If user does not exist, create a new one
            userResult = await pool.query(
              'INSERT INTO users (email, name, profile_picture_url, auth_provider, auth_provider_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
              [email, name, picture, 'google', profile.id]
            );
          }
          
          const user = userResult.rows[0];
          
          // Generate JWT
          const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'default-secret', {
            expiresIn: '1h',
          });

          return done(null, user);
        } catch (err) {
          return done(err, false);
        }
      }
    )
  );
  console.log('Google OAuth strategy configured');
} else {
  console.log('Google OAuth credentials not found, skipping Google strategy configuration');
}

export default passport;