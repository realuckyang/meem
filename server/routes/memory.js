import express from 'express';
import {
    createMemory,
    deleteMemory,
    getMemory,
    listMemories,
    listVisibleMemories,
    updateMemory,
} from '../services/memory.js';

const router = express.Router();

router.get('/', (req, res) => {
    res.json({ items: listMemories() });
});

router.get('/visible', (req, res) => {
    res.json({ items: listVisibleMemories() });
});

router.get('/:id', (req, res) => {
    const item = getMemory(req.params.id);
    if (!item) return res.status(404).json({ error: 'not found' });
    return res.json({ item });
});

router.post('/', (req, res) => {
    const title = String(req.body?.title || '').trim();
    if (!title) return res.status(400).json({ error: 'title is required' });
    const item = createMemory({
        title,
        summary: req.body?.summary,
        content: req.body?.content,
        access: req.body?.access,
        pinned: req.body?.pinned,
    });
    res.json({ item });
});

router.put('/:id', (req, res) => {
    const existing = getMemory(req.params.id);
    if (!existing) return res.status(404).json({ error: 'not found' });
    const item = updateMemory(req.params.id, {
        title: req.body?.title,
        summary: req.body?.summary,
        content: req.body?.content,
        access: req.body?.access,
        pinned: req.body?.pinned,
    });
    res.json({ item });
});

router.delete('/:id', (req, res) => {
    deleteMemory(req.params.id);
    res.json({ ok: true });
});

export default router;
