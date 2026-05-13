async function request(method, path, body) {
  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers: body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {},
    body: body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined),
  })
  const data = await res.json().catch(() => ({ success: false, message: 'invalid_json' }))
  if (!res.ok || data.success === false) {
    const err = new Error(data.message || `http_${res.status}`)
    err.status = res.status
    err.payload = data
    throw err
  }
  return data
}

export const api = {
  get:    (p)    => request('GET',    p),
  post:   (p, b) => request('POST',   p, b),
  patch:  (p, b) => request('PATCH',  p, b),
  delete: (p)    => request('DELETE', p),
}

// === Auth(内核) ===
export const apiUser = {
  me:             ()                 => api.get('/api/auth/me'),
  authStatus:     ()                 => api.get('/api/auth/status'),
  setupAuth:      (username, pwd)    => api.post('/api/auth/setup',  { username, password: pwd }),
  login:          (username, pwd)    => api.post('/api/auth/login',  { username, password: pwd }),
  logout:         ()                 => api.post('/api/auth/logout'),
  changePassword: (oldPwd, newPwd)   => api.post('/api/auth/password', { old_password: oldPwd, new_password: newPwd }),
}

// === Settings(内核) ===
export const apiSettings = {
  detail: ()      => api.get('/api/settings'),
  update: (patch) => api.patch('/api/settings', patch),
}

// === Chat / 助理(内核) ===
export const apiChat = {
  messages: ({ before, limit = 30 } = {}) => {
    const p = new URLSearchParams()
    if (before) p.set('before', String(before))
    p.set('limit', String(limit))
    return api.get(`/api/chat/messages?${p}`)
  },
  sendUrl: () => '/api/chat/send',
}

// === Search(内核) ===
export const apiSearch = {
  run: (q, limit = 30) => api.get(`/api/search?q=${encodeURIComponent(q)}&limit=${limit}`),
}

// === 想法应用 ===
export const apiMemos = {
  list:   ({ offset = 0, limit = 30 } = {}) => api.get(`/apps/memos?offset=${offset}&limit=${limit}`),
  create: ({ content })                     => api.post('/apps/memos', { content }),
  update: (id, { content })                 => api.patch(`/apps/memos/${id}`, { content }),
  remove: (id)                              => api.delete(`/apps/memos/${id}`),
}

// === 待办应用 ===
export const apiTodos = {
  list:   ()           => api.get('/apps/todos'),
  create: ({ title })  => api.post('/apps/todos', { title }),
  update: (id, patch)  => api.patch(`/apps/todos/${id}`, patch),
  remove: (id)         => api.delete(`/apps/todos/${id}`),
}

// === 笔记应用 ===
export const apiNotebook = {
  list:   (parentId = null) =>
    api.get(`/apps/notebooks${parentId ? `?parent_id=${encodeURIComponent(parentId)}` : ''}`),
  detail: (id)              => api.get(`/apps/notebooks/${id}`),
  create: ({ name, parent_id = null, icon = null }) =>
    api.post('/apps/notebooks', { name, parent_id, icon }),
  update: (id, patch) => api.patch(`/apps/notebooks/${id}`, patch),
  remove: (id)        => api.delete(`/apps/notebooks/${id}`),
}
export const apiNote = {
  detail: (id) => api.get(`/apps/notes/${id}`),
  create: ({ notebook_id, title = '', content = '' }) =>
    api.post('/apps/notes', { notebook_id, title, content }),
  update: (id, patch) => api.patch(`/apps/notes/${id}`, patch),
  remove: (id)        => api.delete(`/apps/notes/${id}`),
}

// 笔记首页(meem 用 settings KV 存 home_*),没有 items reorder
export const apiRoot = {
  detail: async () => {
    const { settings } = await apiSettings.detail()
    const notebooks = (await apiNotebook.list()).notebooks || []
    return {
      home: {
        name:  settings.home_name  || '首页',
        icon:  settings.home_icon  || null,
        cover: settings.home_cover || null,
      },
      notebooks,
      notes: [],
    }
  },
  update: async (patch) => {
    const { settings } = await apiSettings.update({
      home_name:  patch.name  ?? undefined,
      home_icon:  patch.icon  ?? undefined,
      home_cover: patch.cover ?? undefined,
    })
    return {
      home: {
        name:  settings.home_name  || '首页',
        icon:  settings.home_icon  || null,
        cover: settings.home_cover || null,
      },
    }
  },
}
export const apiItems = {
  reorder: async () => ({ success: true }),
}
