import { useEffect } from 'react'
import Button from './Button'

// Footer for paged tables. `meta` = { page, limit, total, totalPages } as returned by the admin list queries.
// Renders nothing when everything fits on one page.
export default function Pagination({ meta, onPageChange, isFetching = false }) {
  // After a delete/withdraw (or a filter change elsewhere) the current page can end up past the last one: step back to it.
  const overshoot = meta && !isFetching && meta.page > meta.totalPages
  useEffect(() => {
    if (overshoot) onPageChange(meta.totalPages)
  }, [overshoot, meta?.totalPages, onPageChange]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!meta || meta.total === 0 || meta.totalPages <= 1) return null
  const from = (meta.page - 1) * meta.limit + 1
  const to = Math.min(meta.page * meta.limit, meta.total)
  return (
    <div className="mt-3 flex items-center justify-between gap-3 text-sm text-slate-600" aria-live="polite">
      <span>
        Showing {from}–{to} of {meta.total}
        {isFetching && <span className="ml-2 text-xs text-slate-400">Updating…</span>}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="secondary" disabled={meta.page <= 1 || isFetching} onClick={() => onPageChange(meta.page - 1)}>Previous</Button>
        <span className="text-xs text-slate-500">Page {meta.page} of {meta.totalPages}</span>
        <Button variant="secondary" disabled={meta.page >= meta.totalPages || isFetching} onClick={() => onPageChange(meta.page + 1)}>Next</Button>
      </div>
    </div>
  )
}
