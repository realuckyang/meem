import { getDb } from '../db.js';

function parseId(id) {
    if (id === null || id === undefined || id === '' || id === 'null' || id === 'root') return null;
    const n = Number(id);
    return Number.isFinite(n) && n > 0 ? n : null;
}

function rowToFolder(r) {
    if (!r) return null;
    return {
        id: r.id,
        parent_id: r.parent_id,
        name: r.name,
        created_at: r.created_at,
        updated_at: r.updated_at,
    };
}

function rowToDoc(r, withContent = true) {
    if (!r) return null;
    const out = {
        id: r.id,
        folder_id: r.folder_id,
        title: r.title,
        created_at: r.created_at,
        updated_at: r.updated_at,
    };
    if (withContent) out.content = r.content;
    return out;
}

function getFolder(id) {
    const fid = parseId(id);
    if (fid === null) return null;
    const db = getDb();
    return rowToFolder(db.prepare('SELECT * FROM doc_folders WHERE id = ?').get(fid));
}

function listFolder(id) {
    const fid = parseId(id);
    const db = getDb();
    const folders = db.prepare(
        `SELECT * FROM doc_folders WHERE parent_id ${fid === null ? 'IS NULL' : '= ?'} ORDER BY name ASC`
    ).all(...(fid === null ? [] : [fid])).map(rowToFolder);
    const docs = db.prepare(
        `SELECT id, folder_id, title, created_at, updated_at FROM docs WHERE folder_id ${fid === null ? 'IS NULL' : '= ?'} ORDER BY updated_at DESC`
    ).all(...(fid === null ? [] : [fid])).map((r) => rowToDoc(r, false));
    return { folder: fid === null ? null : getFolder(fid), folders, docs };
}

function breadcrumb(id) {
    const fid = parseId(id);
    if (fid === null) return [];
    const db = getDb();
    const trail = [];
    const seen = new Set();
    let cur = fid;
    while (cur != null && !seen.has(cur)) {
        seen.add(cur);
        const row = db.prepare('SELECT id, parent_id, name FROM doc_folders WHERE id = ?').get(cur);
        if (!row) break;
        trail.unshift({ id: row.id, name: row.name });
        cur = row.parent_id;
    }
    return trail;
}

function createFolder({ parent_id, name }) {
    const pid = parseId(parent_id);
    const n = String(name || '').trim();
    if (!n) throw Object.assign(new Error('name required'), { httpStatus: 400 });
    if (pid !== null) {
        const parent = getFolder(pid);
        if (!parent) throw Object.assign(new Error('parent not found'), { httpStatus: 404 });
    }
    const db = getDb();
    const info = db.prepare('INSERT INTO doc_folders (parent_id, name) VALUES (?, ?)').run(pid, n);
    return rowToFolder(db.prepare('SELECT * FROM doc_folders WHERE id = ?').get(info.lastInsertRowid));
}

function isDescendant(rootId, candidateId) {
    if (candidateId === null) return false;
    if (rootId === candidateId) return true;
    const db = getDb();
    const seen = new Set();
    let cur = candidateId;
    while (cur != null && !seen.has(cur)) {
        seen.add(cur);
        if (cur === rootId) return true;
        const row = db.prepare('SELECT parent_id FROM doc_folders WHERE id = ?').get(cur);
        cur = row?.parent_id ?? null;
    }
    return false;
}

function updateFolder(id, { name, parent_id }) {
    const fid = parseId(id);
    if (fid === null) throw Object.assign(new Error('not found'), { httpStatus: 404 });
    const folder = getFolder(fid);
    if (!folder) throw Object.assign(new Error('not found'), { httpStatus: 404 });

    const sets = [];
    const params = [];

    if (typeof name === 'string') {
        const n = name.trim();
        if (!n) throw Object.assign(new Error('name required'), { httpStatus: 400 });
        sets.push('name = ?');
        params.push(n);
    }

    if (parent_id !== undefined) {
        const newParent = parseId(parent_id);
        if (newParent !== null && isDescendant(fid, newParent)) {
            throw Object.assign(new Error('不能把目录移到自己的子目录中'), { httpStatus: 400 });
        }
        if (newParent !== null && !getFolder(newParent)) {
            throw Object.assign(new Error('parent not found'), { httpStatus: 404 });
        }
        sets.push('parent_id = ?');
        params.push(newParent);
    }

    if (!sets.length) return folder;

    sets.push("updated_at = datetime('now')");
    params.push(fid);
    const db = getDb();
    db.prepare(`UPDATE doc_folders SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    return getFolder(fid);
}

function removeFolder(id) {
    const fid = parseId(id);
    if (fid === null) return;
    const db = getDb();
    db.prepare('DELETE FROM doc_folders WHERE id = ?').run(fid);
}

function getDoc(id) {
    const did = parseId(id);
    if (did === null) return null;
    const db = getDb();
    return rowToDoc(db.prepare('SELECT * FROM docs WHERE id = ?').get(did));
}

function createDoc({ folder_id, title, content }) {
    const fid = parseId(folder_id);
    if (fid !== null && !getFolder(fid)) {
        throw Object.assign(new Error('folder not found'), { httpStatus: 404 });
    }
    const t = String(title || '未命名').trim() || '未命名';
    const c = typeof content === 'string' ? content : '';
    const db = getDb();
    const info = db.prepare(
        'INSERT INTO docs (folder_id, title, content) VALUES (?, ?, ?)'
    ).run(fid, t, c);
    return getDoc(info.lastInsertRowid);
}

function updateDoc(id, { title, content, folder_id }) {
    const did = parseId(id);
    if (did === null) throw Object.assign(new Error('not found'), { httpStatus: 404 });
    if (!getDoc(did)) throw Object.assign(new Error('not found'), { httpStatus: 404 });

    const sets = [];
    const params = [];

    if (typeof title === 'string') {
        sets.push('title = ?');
        params.push(title.trim() || '未命名');
    }
    if (typeof content === 'string') {
        sets.push('content = ?');
        params.push(content);
    }
    if (folder_id !== undefined) {
        const fid = parseId(folder_id);
        if (fid !== null && !getFolder(fid)) {
            throw Object.assign(new Error('folder not found'), { httpStatus: 404 });
        }
        sets.push('folder_id = ?');
        params.push(fid);
    }

    if (!sets.length) return getDoc(did);

    sets.push("updated_at = datetime('now')");
    params.push(did);
    const db = getDb();
    db.prepare(`UPDATE docs SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    return getDoc(did);
}

function removeDoc(id) {
    const did = parseId(id);
    if (did === null) return;
    const db = getDb();
    db.prepare('DELETE FROM docs WHERE id = ?').run(did);
}

export {
    listFolder,
    breadcrumb,
    createFolder,
    updateFolder,
    removeFolder,
    getDoc,
    createDoc,
    updateDoc,
    removeDoc,
};
export default {
    listFolder,
    breadcrumb,
    createFolder,
    updateFolder,
    removeFolder,
    getDoc,
    createDoc,
    updateDoc,
    removeDoc,
};
