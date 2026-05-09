import { Router } from 'express';
import home from '../services/home.js';

const router = Router();

function handleErr(res, err) {
    const status = err?.httpStatus || 500;
    res.status(status).json({ error: err?.message || String(err) });
}

router.get('/', (_req, res) => {
    try {
        res.json(home.getHome());
    } catch (err) { handleErr(res, err); }
});

router.put('/', (req, res) => {
    try {
        res.json(home.updateHome(req.body || {}));
    } catch (err) { handleErr(res, err); }
});

export default router;
