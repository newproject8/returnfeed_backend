"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const passport_1 = require("../config/passport");
const router = (0, express_1.Router)();
// Redirect to Google for authentication
router.get('/google', passport_1.default.authenticate('google', { scope: ['profile', 'email'], session: false }));
// Google callback URL
router.get('/google/callback', passport_1.default.authenticate('google', { session: false }), (req, res) => {
    // On successful authentication, redirect with JWT
    const token = req.user.token;
    res.redirect(`http://localhost:5173/auth/callback?token=${token}`);
});
exports.default = router;
