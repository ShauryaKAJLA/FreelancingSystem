// Consistent JSON envelope: { success, message, data }
const ok = (res, data, message = 'OK', status = 200) => res.status(status).json({ success: true, message, data })
const created = (res, data, message = 'Created') => ok(res, data, message, 201)
// Plain-array body; when the array came from an opt-in paged query (withPageInfo) the totals travel in X-* headers
// (exposed via CORS in app.js). Without page/limit this is identical to ok().
const okPaged = (res, rows, message) => {
  const info = rows?.pageInfo
  if (info) res.set({ 'X-Total-Count': String(info.total), 'X-Page': String(info.page), 'X-Limit': String(info.limit), 'X-Total-Pages': String(info.totalPages) })
  return ok(res, rows, message)
}
module.exports = { ok, created, okPaged }
