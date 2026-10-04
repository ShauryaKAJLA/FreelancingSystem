import { useMemo } from 'react'
import { Link } from 'react-router'
import { useGetOpenJobsQuery } from '../freelancerApi'
import PageHeader from '../../shared/components/layout/PageHeader'
import Input from '../../shared/components/ui/Input'
import Select from '../../shared/components/ui/Select'
import Card from '../../shared/components/ui/Card'
import Badge from '../../shared/components/ui/Badge'
import Button from '../../shared/components/ui/Button'
import Pagination from '../../shared/components/ui/Pagination'
import Spinner from '../../shared/components/ui/Spinner'
import ErrorState from '../../shared/components/ui/ErrorState'
import EmptyState from '../../shared/components/ui/EmptyState'
import { useListParams } from '../../shared/hooks/useListParams'
import { useSkills } from '../../shared/api/skillsApi'
import { JOB_CATEGORIES, EXPERIENCE_LEVELS } from '../../shared/constants/jobs'
import { formatCurrency, formatDate } from '../../shared/utils/format'

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'budgetHigh', label: 'Budget: high to low' },
  { value: 'budgetLow', label: 'Budget: low to high' },
]

const DEFAULT_FILTERS = {
  search: '', skillId: '', category: '', experienceLevel: '', budgetMin: '', budgetMax: '', sortBy: 'newest',
}

export default function BrowseJobsPage() {
  const SKILLS = useSkills()
  // `filters` drives the controls; `params` (debounced search + page + limit) is what the server receives. Any filter change returns to page 1.
  const { filters, params, setFilter: setField, setPage, resetFilters: clearAll } = useListParams(DEFAULT_FILTERS)
  const { data, isLoading, isFetching, isError } = useGetOpenJobsQuery(params)
  const jobs = data?.rows

  function clearField(field) {
    setField(field, DEFAULT_FILTERS[field])
  }

  const activeChips = useMemo(() => {
    const chips = []
    if (filters.search) chips.push({ key: 'search', label: `Title: "${filters.search}"` })
    if (filters.skillId) chips.push({ key: 'skillId', label: `Skill: ${SKILLS.find((s) => s.skillId === filters.skillId)?.skillName}` })
    if (filters.category) chips.push({ key: 'category', label: `Category: ${filters.category}` })
    if (filters.experienceLevel) chips.push({ key: 'experienceLevel', label: `Level: ${filters.experienceLevel}` })
    if (filters.budgetMin) chips.push({ key: 'budgetMin', label: `Min ${formatCurrency(Number(filters.budgetMin))}` })
    if (filters.budgetMax) chips.push({ key: 'budgetMax', label: `Max ${formatCurrency(Number(filters.budgetMax))}` })
    return chips
  }, [filters])

  return (
    <div>
      <PageHeader title="Browse open jobs" description="Search and filter jobs that match your skills." />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Input placeholder="Search by title…" value={filters.search} onChange={(e) => setField('search', e.target.value)} className="w-56" />
        <Select value={filters.skillId} onChange={(e) => setField('skillId', e.target.value)} className="w-44">
          <option value="">All skills</option>
          {SKILLS.map((s) => <option key={s.skillId} value={s.skillId}>{s.skillName}</option>)}
        </Select>
        <Select value={filters.category} onChange={(e) => setField('category', e.target.value)} className="w-44">
          <option value="">All categories</option>
          {JOB_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Select value={filters.experienceLevel} onChange={(e) => setField('experienceLevel', e.target.value)} className="w-40">
          <option value="">Experience level</option>
          {EXPERIENCE_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </Select>
        <Input type="number" min="0" placeholder="Min budget" value={filters.budgetMin}
               onChange={(e) => setField('budgetMin', e.target.value)} className="w-32" />
        <Input type="number" min="0" placeholder="Max budget" value={filters.budgetMax}
               onChange={(e) => setField('budgetMax', e.target.value)} className="w-32" />
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
      {jobs && jobs.length === 0 && <EmptyState title="No matching jobs" description="Try a different search term or clear some filters." />}
      {jobs && jobs.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {jobs.map((job) => (
            <Card key={job.jobId}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link to={`/freelancer/jobs/${job.jobId}`} className="text-base font-semibold text-slate-900 hover:text-indigo-600">{job.title}</Link>
                  <p className="mt-1 text-xs text-slate-500">{job.clientName}</p>
                </div>
                <Badge status={job.status} />
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-slate-500">{job.description}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {job.category && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{job.category}</span>}
                {job.experienceLevel && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{job.experienceLevel}</span>}
              </div>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-800">{formatCurrency(job.budget)}</span>
                <span className="text-slate-400">{job.bidCount} bid{job.bidCount === 1 ? '' : 's'} · {formatDate(job.createdAt)}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
      {data && <Pagination meta={data.meta} onPageChange={setPage} isFetching={isFetching} />}
    </div>
  )
}
