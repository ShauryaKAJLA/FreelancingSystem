import { requestPaged, cleanParams } from './http'

// Shared by every paged list query: `{ page, limit, ...filters }` in, `{ rows, meta: { page, limit, total, totalPages } }` out.
// Filters are sent as query params and the server pages (X-* headers -> meta).
// livePaged('/admin/users')(args) or livePaged((a) => `/clients/${a.userId}/payments`)(args); `userId` is never sent as a query param.
export const livePaged = (urlOrFn) => ({ userId, ...args } = {}) =>
  requestPaged(typeof urlOrFn === 'function' ? urlOrFn({ userId, ...args }) : urlOrFn, { params: cleanParams(args) })
