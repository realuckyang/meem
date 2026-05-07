import { Router } from 'express';
import docs from '../services/docs.js';

const router = Router();

function handleErr(res, err) {
    const status = err?.httpStatus || 500;
    res.status(status).json({ error: err?.message || String(err) });
}

// 列文件夹内容(folders + docs) + 当前文件夹信息
router.get('/list', (req, res) => {
    try {
        res.json(docs.listFolder(req.query.folderId ?? null));
    } catch (err) { handleErr(res, err); }
});

// 面包屑
router.get('/breadcrumb', (req, res) => {
    try {
        res.json(docs.breadcrumb(req.query.folderId ?? null));
    } catch (err) { handleErr(res, err); }
});

// 文件夹 CRUD
router.post('/folders', (req, res) => {
    try {
        res.json(docs.createFolder(req.body || {}));
    } catch (err) { handleErr(res, err); }
});

router.patch('/folders/:id', (req, res) => {
    try {
        res.json(docs.updateFolder(req.params.id, req.body || {}));
    } catch (err) { handleErr(res, err); }
});

router.delete('/folders/:id', (req, res) => {
    try {
        docs.removeFolder(req.params.id);
        res.json({ ok: true });
    } catch (err) { handleErr(res, err); }
});

// 文档 CRUD
router.get('/:id', (req, res) => {
    const d = docs.getDoc(req.params.id);
    if (!d) return res.status(404).json({ error: 'not found' });
    res.json(d);
});

router.post('/', (req, res) => {
    try {
        res.json(docs.createDoc(req.body || {}));
    } catch (err) { handleErr(res, err); }
});

router.patch('/:id', (req, res) => {
    try {
        res.json(docs.updateDoc(req.params.id, req.body || {}));
    } catch (err) { handleErr(res, err); }
});

router.delete('/:id', (req, res) => {
    try {
        docs.removeDoc(req.params.id);
        res.json({ ok: true });
    } catch (err) { handleErr(res, err); }
});

export default router;
