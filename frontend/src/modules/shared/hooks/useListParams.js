import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// Filter + page state for the admin lists. `filters` is what the controls show (updates immediately);
// `params` is what is sent to the API: `search` is debounced, every filter change resets to page 1.
//   resetFilters() restores the initial filters ("Clear all") and returns to page 1.
//   const { filters, params, setFilter, setPage, resetFilters } = useListParams({ status: '', search: '' })
//   const { data } = useGetUsersQuery(params)   // data = { rows, meta }
export function useListParams(initial = {}, limit = 10, debounceMs = 300) {
  const [filters, setFilters] = useState(initial)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState(initial.search ?? '')
  const hasSearch = 'search' in filters
  const initialRef = useRef(initial)

  useEffect(() => {
    const id = setTimeout(() => setSearch(filters.search ?? ''), debounceMs)
    return () => clearTimeout(id)
  }, [filters.search, debounceMs])

  const setFilter = useCallback((key, value) => {
    setFilters((f) => ({ ...f, [key]: value }))
    setPage(1)
  }, [])

  const resetFilters = useCallback(() => {
    setFilters(initialRef.current)
    setSearch(initialRef.current.search ?? '')
    setPage(1)
  }, [])

  const params = useMemo(
    () => ({ ...filters, ...(hasSearch ? { search: search.trim() } : {}), page, limit }),
    [filters, hasSearch, search, page, limit]
  )
  return { filters, params, page, setPage, setFilter, resetFilters }
}
