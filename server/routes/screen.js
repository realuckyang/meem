import { Router } from 'express';
import screen from '../services/screen.js';

const router = Router();

router.get('/snapshot', async (req, res) => {
    try {
        const png = await screen.capturePng();
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Length', png.length);
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Captured-At', String(Date.now()));
        res.send(png);
    } catch (err) {
        res.status(500).json({ error: err?.message || String(err) });
    }
});

export default router;
