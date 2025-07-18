import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import crypto from 'crypto';
import pool from '../db';

const router = Router();

router.get('/config', authenticateToken, async (req, res): Promise<void> => {
    try {
        if (!req.user) {
            res.status(403).send('User not authenticated');
            return;
        }
        const { id: userId, username } = req.user;

        const streamKey = crypto.randomBytes(16).toString('hex');

        await pool.query('UPDATE users SET stream_key = $1 WHERE id = $2', [streamKey, userId]);

        const srtUrl = `srt://localhost:8890?streamid=publish/${username}/${streamKey}`;
        const monitoringUrl = `http://localhost:5173/play/${username}`;

        res.json({ srtUrl, monitoringUrl });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
});

export default router;