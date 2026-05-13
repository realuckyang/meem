export const json = (res, body, status = 200, extraHeaders = {}) => {
  if (res.headersSent) return
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...extraHeaders,
  })
  res.end(JSON.stringify(body))
}

export const ok   = (res, data = {}, status = 200, extraHeaders = {}) =>
  json(res, { success: true, ...data }, status, extraHeaders)

export const fail = (res, message = 'bad_request', status = 400, extraHeaders = {}) =>
  json(res, { success: false, message }, status, extraHeaders)
