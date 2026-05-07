import { Router } from 'express';
import todos from '../services/todos.js';

const router = Router();

router.get('/', (req, res) => {
    res.json(todos.list());
});

router.post('/', (req, res) => {
    try {
        const todo = todos.create({ title: req.body?.title });
        res.json(todo);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.get('/:id', (req, res) => {
    const todo = todos.get(req.params.id);
    if (!todo) return res.status(404).json({ error: 'not found' });
    res.json(todo);
});

router.patch('/:id', (req, res) => {
    const updated = todos.update(req.params.id, req.body || {});
    if (!updated) return res.status(404).json({ error: 'not found' });
    res.json(updated);
});

router.delete('/:id', (req, res) => {
    todos.remove(req.params.id);
    res.json({ ok: true });
});

export default router;
