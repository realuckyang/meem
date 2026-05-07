import { getDb } from '../db.js';

function rowToTodo(row) {
    if (!row) return null;
    return {
        id: row.id,
        title: row.title,
        done: !!row.done,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

function list() {
    const db = getDb();
    const rows = db.prepare(
        'SELECT id, title, done, created_at, updated_at FROM todos ORDER BY id DESC'
    ).all();
    return rows.map(rowToTodo);
}

function get(id) {
    const db = getDb();
    const row = db.prepare(
        'SELECT id, title, done, created_at, updated_at FROM todos WHERE id = ?'
    ).get(Number(id));
    return rowToTodo(row);
}

function create({ title }) {
    const t = String(title || '').trim();
    if (!t) throw new Error('title required');
    const db = getDb();
    const info = db.prepare('INSERT INTO todos (title) VALUES (?)').run(t);
    return get(info.lastInsertRowid);
}

function update(id, { title, done }) {
    const db = getDb();
    const existing = get(id);
    if (!existing) return null;

    const sets = [];
    const params = [];
    if (typeof title === 'string') {
        sets.push('title = ?');
        params.push(title.trim());
    }
    if (typeof done === 'boolean') {
        sets.push('done = ?');
        params.push(done ? 1 : 0);
    }
    if (!sets.length) return existing;

    sets.push("updated_at = datetime('now')");
    params.push(Number(id));
    db.prepare(`UPDATE todos SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    return get(id);
}

function remove(id) {
    const db = getDb();
    db.prepare('DELETE FROM todos WHERE id = ?').run(Number(id));
}

export { list, get, create, update, remove };
export default { list, get, create, update, remove };
