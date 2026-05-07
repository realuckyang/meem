// HTTP 版本的文件客户端，替代原 WS 版本。
// API 形态与原版保持兼容：fsHome / fsList / fsStat / fsDelete / fsMkdir / fsRename / fsRead / fsUpload。

async function asJson(res) {
    if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
            const data = await res.json();
            if (data?.error) msg = data.error;
        } catch {}
        throw new Error(msg);
    }
    return res.json();
}

function qs(params) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null || v === '') continue;
        p.set(k, typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
    }
    const s = p.toString();
    return s ? `?${s}` : '';
}

async function fsHome() {
    return asJson(await fetch('/api/fs/home'));
}

async function fsList(path, showHidden = false) {
    return asJson(await fetch(`/api/fs/list${qs({ path, showHidden })}`));
}

async function fsStat(path) {
    return asJson(await fetch(`/api/fs/stat${qs({ path })}`));
}

async function fsDelete(path, recursive = false) {
    return asJson(await fetch(`/api/fs${qs({ path, recursive })}`, { method: 'DELETE' }));
}

async function fsMkdir(path) {
    const res = await fetch('/api/fs/mkdir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
    });
    return asJson(res);
}

async function fsRename(from, to) {
    const res = await fetch('/api/fs/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to }),
    });
    return asJson(res);
}

async function fsRead(path) {
    const res = await fetch(`/api/fs/read${qs({ path })}`);
    if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
            const data = await res.json();
            if (data?.error) msg = data.error;
        } catch {}
        throw new Error(msg);
    }
    const mime = res.headers.get('X-File-Mime') || res.headers.get('Content-Type') || 'application/octet-stream';
    const sizeHeader = res.headers.get('X-File-Size') || res.headers.get('Content-Length') || 0;
    const nameHeader = res.headers.get('X-File-Name');
    const meta = {
        name: nameHeader ? decodeURIComponent(nameHeader) : '',
        size: Number(sizeHeader) || 0,
        mime,
    };
    const blob = await res.blob();
    return { meta, blob };
}

async function fsUpload(path, file, onProgress, overwrite = true) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/fs/upload', true);
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) onProgress?.(e.loaded, e.total);
        };
        xhr.onload = () => {
            try {
                const data = JSON.parse(xhr.responseText || '{}');
                if (xhr.status >= 200 && xhr.status < 300) resolve(data);
                else reject(new Error(data?.error || `HTTP ${xhr.status}`));
            } catch (err) {
                reject(err);
            }
        };
        xhr.onerror = () => reject(new Error('网络错误'));
        const fd = new FormData();
        fd.append('path', path);
        fd.append('overwrite', overwrite ? '1' : '0');
        fd.append('file', file, file.name || 'upload');
        xhr.send(fd);
    });
}

export function useFsClient() {
    return {
        fsHome,
        fsList,
        fsStat,
        fsDelete,
        fsMkdir,
        fsRename,
        fsRead,
        fsUpload,
    };
}
