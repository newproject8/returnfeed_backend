"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const passport_1 = require("passport");
const passport_google_oauth20_1 = require("passport-google-oauth20");
const jsonwebtoken_1 = require("jsonwebtoken");
const db_1 = require("../db");
// Only configure Google OAuth if credentials are provided
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport_1.default.use(new passport_google_oauth20_1.Strategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: '/api/auth/google/callback',
    }, async (accessToken, refreshToken, profile, done) => {
        const { email, name, picture } = profile._json;
        try {
            // Find user in the database
            let userResult = await db_1.default.query('SELECT * FROM users WHERE email = $1', [email]);
            if (userResult.rows.length === 0) {
                // If user does not exist, create a new one
                userResult = await db_1.default.query('INSERT INTO users (email, name, profile_picture_url, auth_provider, auth_provider_id) VALUES ($1, $2, $3, $4, $5) RETURNING *', [email, name, picture, 'google', profile.id]);
            }
            const user = userResult.rows[0];
            // Generate JWT
            const token = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_SECRET || 'default-secret', {
                expiresIn: '1h',
            });
            return done(null, user);
        }
        catch (err) {
            return done(err, false);
        }
    }));
    console.log('Google OAuth strategy configured');
}
else {
    console.log('Google OAuth credentials not found, skipping Google strategy configuration');
}
exports.default = passport_1.default;
