"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const crypto_1 = require("crypto");
const db_1 = require("../db");
const router = (0, express_1.Router)();
router.get('/config', auth_1.authenticateToken, async (req, res) => {
    try {
        if (!req.user) {
            res.status(403).send('User not authenticated');
            return;
        }
        const { id: userId, username } = req.user;
        const streamKey = crypto_1.default.randomBytes(16).toString('hex');
        await db_1.default.query('UPDATE users SET stream_key = $1 WHERE id = $2', [streamKey, userId]);
        const srtUrl = `srt://localhost:8890?streamid=publish/${username}/${streamKey}`;
        const monitoringUrl = `http://localhost:5173/play/${username}`;
        res.json({ srtUrl, monitoringUrl });
    }
    catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
});
exports.default = router;
