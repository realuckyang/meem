import { getDb } from '../db.js';

const ACCESS = new Set(['none', 'summary', 'full']);

function normalizeAccess(value) {
    const access = String(value || 'none').trim();
    return ACCESS.has(access) ? access : 'none';
}

function rowToMemory(row) {
    if (!row) return null;
    return {
        id: row.id,
        title: row.title || '',
        summary: row.summary || '',
        content: row.content || '',
        access: normalizeAccess(row.access),
        pinned: Boolean(row.pinned),
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

function listMemories() {
    const db = getDb();
    return db.prepare(`
        SELECT id, title, summary, content, access, pinned, created_at, updated_at
        FROM memories
        ORDER BY datetime(updated_at) DESC, id DESC
    `).all().map(rowToMemory);
}

function getMemory(id) {
    const db = getDb();
    const row = db.prepare(`
        SELECT id, title, summary, content, access, pinned, created_at, updated_at
        FROM memories
        WHERE id = ?
    `).get(Number(id) || 0);
    return rowToMemory(row);
}

function createMemory({ title, summary = '', content = '', access = 'none', pinned = false }) {
    const db = getDb();
    const result = db.prepare(`
        INSERT INTO memories (title, summary, content, access, pinned)
        VALUES (?, ?, ?, ?, ?)
    `).run(
        String(title || '').trim(),
        String(summary || '').trim(),
        String(content || '').trim(),
        normalizeAccess(access),
        pinned ? 1 : 0
    );
    return getMemory(result.lastInsertRowid);
}

function updateMemory(id, patch = {}) {
    const fields = [];
    const values = [];

    if (patch.title !== undefined) {
        fields.push('title = ?');
        values.push(String(patch.title || '').trim());
    }
    if (patch.summary !== undefined) {
        fields.push('summary = ?');
        values.push(String(patch.summary || '').trim());
    }
    if (patch.content !== undefined) {
        fields.push('content = ?');
        values.push(String(patch.content || '').trim());
    }
    if (patch.access !== undefined) {
        fields.push('access = ?');
        values.push(normalizeAccess(patch.access));
    }
    if (patch.pinned !== undefined) {
        fields.push('pinned = ?');
        values.push(patch.pinned ? 1 : 0);
    }

    if (!fields.length) return getMemory(id);

    fields.push("updated_at = datetime('now')");
    values.push(Number(id) || 0);

    const db = getDb();
    db.prepare(`UPDATE memories SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return getMemory(id);
}

function deleteMemory(id) {
    const db = getDb();
    db.prepare('DELETE FROM memories WHERE id = ?').run(Number(id) || 0);
    return { success: true };
}

function listVisibleMemories() {
    const db = getDb();
    return db.prepare(`
        SELECT id, title, summary, content, access, pinned, created_at, updated_at
        FROM memories
        WHERE access IN ('summary', 'full')
        ORDER BY datetime(updated_at) DESC, id DESC
    `).all().map(rowToMemory);
}

export {
    createMemory,
    deleteMemory,
    getMemory,
    listMemories,
    listVisibleMemories,
    normalizeAccess,
    updateMemory,
};
