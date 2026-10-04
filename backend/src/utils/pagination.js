// ?page=1&limit=20 (limit capped at 100). Returns Mongo-ready skip/limit.
const parsePagination = (query = {}, { defaultLimit = 20, maxLimit = 100 } = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1)
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit))
  return { page, limit, skip: (page - 1) * limit }
}
const pageMeta = ({ page, limit }, total) => ({ page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) })

// Opt-in pagination for admin lists: no page/limit in the query => null (legacy behaviour: array capped elsewhere).
const optPagination = (query = {}) =>
  query.page === undefined && query.limit === undefined ? null : parsePagination(query, { defaultLimit: 20, maxLimit: 100 })

// Attaches paging info to a result array as a NON-enumerable property so JSON bodies stay plain arrays
// (the frontend tables keep working); controllers surface it as X-* headers.
const withPageInfo = (rows, pg, total) => {
  if (pg) Object.defineProperty(rows, 'pageInfo', { value: pageMeta(pg, total), enumerable: false })
  return rows
}

// Opt-in paged find: no page/limit => `cap` rows (cap 0 = no .limit() call at all, the old unbounded query), no count; with page/limit => skip+limit and one countDocuments.
// Returns { rows, pg, total } (feed rows to withPageInfo(mapped, pg, total) after mapping).
async function findPaged(Model, filter, sort, query, cap) {
  const pg = optPagination(query)
  const q = Model.find(filter).sort(sort)
  const rows = await (pg ? q.skip(pg.skip).limit(pg.limit) : cap ? q.limit(cap) : q)
  const total = pg ? await Model.countDocuments(filter) : null
  return { rows, pg, total }
}

module.exports = { parsePagination, pageMeta, optPagination, withPageInfo, findPaged }
