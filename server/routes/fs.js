import { Router } from 'express';
import multer from 'multer';
import files from '../services/files.js';

const router = Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
});

function handleErr(res, err) {
    const status = err?.httpStatus || (err?.code === 'ENOENT' ? 404 : 500);
    res.status(status).json({ error: err?.message || String(err) });
}

router.get('/home', (req, res) => {
    try {
        res.json(files.home());
    } catch (err) { handleErr(res, err); }
});

router.get('/list', async (req, res) => {
    try {
        const data = await files.list(req.query.path || '', req.query.showHidden === '1' || req.query.showHidden === 'true');
        res.json(data);
    } catch (err) { handleErr(res, err); }
});

router.get('/stat', async (req, res) => {
    try {
        const data = await files.stat(req.query.path);
        res.json(data);
    } catch (err) { handleErr(res, err); }
});

router.get('/read', async (req, res) => {
    try {
        const p = String(req.query.path || '');
        const maxSize = req.query.maxSize ? Number(req.query.maxSize) : 0;
        const meta = await files.readMeta(p, maxSize);
        res.setHeader('Content-Type', meta.mime);
        res.setHeader('Content-Length', meta.size);
        res.setHeader('X-File-Name', encodeURIComponent(meta.name));
        res.setHeader('X-File-Size', meta.size);
        res.setHeader('X-File-Mime', meta.mime);
        files.readStream(p).pipe(res);
    } catch (err) { handleErr(res, err); }
});

router.delete('/', async (req, res) => {
    try {
        await files.del(String(req.query.path || ''), req.query.recursive === '1' || req.query.recursive === 'true');
        res.json({ ok: true });
    } catch (err) { handleErr(res, err); }
});

router.post('/mkdir', async (req, res) => {
    try {
        const data = await files.mkdir(String(req.body?.path || ''));
        res.json(data);
    } catch (err) { handleErr(res, err); }
});

router.post('/rename', async (req, res) => {
    try {
        const data = await files.rename(String(req.body?.from || ''), String(req.body?.to || ''));
        res.json(data);
    } catch (err) { handleErr(res, err); }
});

router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const dest = String(req.body?.path || '');
        const overwrite = req.body?.overwrite === '1' || req.body?.overwrite === 'true';
        if (!dest) return res.status(400).json({ error: 'path required' });
        if (!req.file) return res.status(400).json({ error: 'file required' });
        const data = await files.saveUpload(dest, req.file.buffer, overwrite);
        res.json(data);
    } catch (err) { handleErr(res, err); }
});

export default router;
