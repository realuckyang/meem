const MAX_BODY = 2 * 1024 * 1024 // 2MB

export const readBody = (req) => new Promise((resolve, reject) => {
  const chunks = []
  let size = 0
  req.on('data', (c) => {
    size += c.length
    if (size > MAX_BODY) {
      req.destroy()
      reject(new Error('body_too_large'))
      return
    }
    chunks.push(c)
  })
  req.on('end', () => {
    const raw = Buffer.concat(chunks).toString('utf8')
    if (!raw) return resolve({})
    try { resolve(JSON.parse(raw)) }
    catch { resolve({}) }
  })
  req.on('error', reject)
})

export const parseCookies = (req) => {
  const out = {}
  const raw = req.headers.cookie || ''
  for (const part of raw.split(';')) {
    const i = part.indexOf('=')
    if (i <= 0) continue
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}
