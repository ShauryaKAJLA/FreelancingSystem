import { useMemo } from 'react'
import { Link } from 'react-router'
import { useGetFreelancersQuery } from '../clientApi'
import PageHeader from '../../shared/components/layout/PageHeader'
import Input from '../../shared/components/ui/Input'
import Select from '../../shared/components/ui/Select'
import Card from '../../shared/components/ui/Card'
import Button from '../../shared/components/ui/Button'
import Pagination from '../../shared/components/ui/Pagination'
import Spinner from '../../shared/components/ui/Spinner'
import ErrorState from '../../shared/components/ui/ErrorState'
import EmptyState from '../../shared/components/ui/EmptyState'
import { useListParams } from '../../shared/hooks/useListParams'
import { useSkills } from '../../shared/api/skillsApi'
import { formatCurrency } from '../../shared/utils/format'

const SORT_OPTIONS = [
  { value: 'ratingHigh', label: 'Rating: high to low' },
  { value: 'rateLow', label: 'Rate: low to high' },
  { value: 'rateHigh', label: 'Rate: high to low' },
]

const DEFAULT_FILTERS = { search: '', skillId: '', minRating: '', minRate: '', maxRate: '', sortBy: 'ratingHigh' }

export default function FreelancersListPage() {
  const SKILLS = useSkills()
  // `filters` drives the controls; `params` (debounced search + page + limit) is what the server receives. Any filter change returns to page 1.
  const { filters, params, setFilter: setField, setPage, resetFilters: clearAll } = useListParams(DEFAULT_FILTERS)
  const { data, isLoading, isFetching, isError } = useGetFreelancersQuery(params)
  const freelancersList = data?.rows

  function clearField(field) {
    setField(field, DEFAULT_FILTERS[field])
  }

  const activeChips = useMemo(() => {
    const chips = []
    if (filters.search) chips.push({ key: 'search', label: `"${filters.search}"` })
    if (filters.skillId) chips.push({ key: 'skillId', label: `Skill: ${SKILLS.find((s) => s.skillId === filters.skillId)?.skillName}` })
    if (filters.minRating) chips.push({ key: 'minRating', label: `Min rating ${filters.minRating}★` })
    if (filters.minRate) chips.push({ key: 'minRate', label: `Min ${formatCurrency(Number(filters.minRate))}/hr` })
    if (filters.maxRate) chips.push({ key: 'maxRate', label: `Max ${formatCurrency(Number(filters.maxRate))}/hr` })
    return chips
  }, [filters])

  return (
    <div>
      <PageHeader title="Find freelancers" description="Search and filter freelancers to invite to your jobs." />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Input placeholder="Search by name or bio…" value={filters.search} onChange={(e) => setField('search', e.target.value)} className="w-56" />
        <Select value={filters.skillId} onChange={(e) => setField('skillId', e.target.value)} className="w-44">
          <option value="">All skills</option>
          {SKILLS.map((s) => <option key={s.skillId} value={s.skillId}>{s.skillName}</option>)}
        </Select>
        <Select value={filters.minRating} onChange={(e) => setField('minRating', e.target.value)} className="w-36">
          <option value="">Any rating</option>
          <option value="4.5">4.5★ &amp; up</option>
          <option value="4">4★ &amp; up</option>
          <option value="3">3★ &amp; up</option>
        </Select>
        <Input type="number" min="0" placeholder="Min ₹/hr" value={filters.minRate}
               onChange={(e) => setField('minRate', e.target.value)} className="w-28" />
        <Input type="number" min="0" placeholder="Max ₹/hr" value={filters.maxRate}
               onChange={(e) => setField('maxRate', e.target.value)} className="w-28" />
        <Select value={filters.sortBy} onChange={(e) => setField('sortBy', e.target.value)} className="w-44">
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </div>

      {activeChips.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {activeChips.map((chip) => (
            <button key={chip.key} type="button" onClick={() => clearField(chip.key)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 hover:border-indigo-300">
              {chip.label}
              <span aria-hidden="true">×</span>
            </button>
          ))}
          <Button type="button" variant="secondary" onClick={clearAll} className="text-xs">Clear all</Button>
        </div>
      )}

      {isLoading && <Spinner />}
      {isError && <ErrorState />}
      {freelancersList && freelancersList.length === 0 && (
        <EmptyState title="No matching freelancers" description="Try a different search term or clear some filters." />
      )}
      {freelancersList && freelancersList.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {freelancersList.map((f) => (
            <Card key={f.freelancerId}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link to={`/client/freelancers/${f.freelancerId}`} className="text-base font-semibold text-slate-900 hover:text-indigo-600">{f.name}</Link>
                  <p className="mt-1 text-xs text-slate-500">{f.completedContracts} completed contract{f.completedContracts === 1 ? '' : 's'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-amber-500">★ {f.rating}</p>
                  <p className="text-xs text-slate-400">{formatCurrency(f.hourlyRate)}/hr</p>
                </div>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-slate-500">{f.bio}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {f.skills.map((s) => (
                  <span key={s} className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">{s}</span>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
      {data && <Pagination meta={data.meta} onPageChange={setPage} isFetching={isFetching} />}
    </div>
  )
}
