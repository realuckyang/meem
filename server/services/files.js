import os from 'os';
import path from 'path';
import { promises as fsp, createReadStream } from 'fs';
import { guessMime } from '../core/mime.js';

const MAX_PREVIEW_BYTES = 20 * 1024 * 1024;

function home() {
    return { path: os.homedir(), sep: path.sep, platform: os.platform() };
}

async function list(p, showHidden) {
    const abs = p || os.homedir();
    const entries = await fsp.readdir(abs, { withFileTypes: true });
    const items = await Promise.all(entries
        .filter((e) => showHidden || !e.name.startsWith('.'))
        .map(async (e) => {
            const full = path.join(abs, e.name);
            try {
                const st = await fsp.stat(full);
                return {
                    name: e.name,
                    type: st.isDirectory() ? 'dir' : (e.isSymbolicLink() ? 'link' : 'file'),
                    size: st.size,
                    mtime: st.mtimeMs,
                };
            } catch {
                return { name: e.name, type: 'unknown', size: 0, mtime: 0 };
            }
        }));
    items.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        return a.name.localeCompare(b.name);
    });
    return { path: abs, entries: items };
}

async function stat(p) {
    const st = await fsp.stat(p);
    return {
        path: p,
        type: st.isDirectory() ? 'dir' : 'file',
        size: st.size,
        mtime: st.mtimeMs,
    };
}

async function readMeta(p, maxSize) {
    const limit = Math.min(maxSize || MAX_PREVIEW_BYTES, MAX_PREVIEW_BYTES);
    const st = await fsp.stat(p);
    if (st.isDirectory()) throw Object.assign(new Error('是目录，不能读取'), { httpStatus: 400 });
    if (st.size > limit) throw Object.assign(new Error(`文件过大 (${st.size} 字节 / 上限 ${limit})`), { httpStatus: 413 });
    return {
        name: path.basename(p),
        size: st.size,
        mime: guessMime(path.basename(p)),
    };
}

function readStream(p) {
    return createReadStream(p);
}

async function del(p, recursive) {
    const st = await fsp.stat(p);
    if (st.isDirectory()) {
        if (!recursive) throw new Error('是目录，需 recursive=true');
        await fsp.rm(p, { recursive: true, force: true });
    } else {
        await fsp.unlink(p);
    }
}

async function mkdir(p) {
    await fsp.mkdir(p, { recursive: true });
    return { path: p };
}

async function rename(from, to) {
    await fsp.rename(from, to);
    return { from, to };
}

async function saveUpload(destPath, srcBuffer, overwrite) {
    if (!overwrite) {
        let exists = false;
        try {
            await fsp.access(destPath);
            exists = true;
        } catch (e) {
            if (e.code !== 'ENOENT') throw e;
        }
        if (exists) {
            throw Object.assign(new Error('文件已存在，传 overwrite=true 覆盖'), { httpStatus: 409 });
        }
    }
    await fsp.mkdir(path.dirname(destPath), { recursive: true });
    await fsp.writeFile(destPath, srcBuffer);
    return { path: destPath, received: srcBuffer.length };
}

export { home, list, stat, readMeta, readStream, del, mkdir, rename, saveUpload };
export default { home, list, stat, readMeta, readStream, del, mkdir, rename, saveUpload };
