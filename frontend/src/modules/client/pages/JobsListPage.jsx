import { useState } from 'react'
import { useSelector } from 'react-redux'
import { Link, useSearchParams } from 'react-router'
import { useGetClientJobsQuery } from '../clientApi'
import PageHeader from '../../shared/components/layout/PageHeader'
import Select from '../../shared/components/ui/Select'
import Button from '../../shared/components/ui/Button'
import Pagination from '../../shared/components/ui/Pagination'
import Spinner from '../../shared/components/ui/Spinner'
import ErrorState from '../../shared/components/ui/ErrorState'
import EmptyState from '../../shared/components/ui/EmptyState'
import JobCard from '../components/JobCard'
import Card from '../../shared/components/ui/Card'
import Badge from '../../shared/components/ui/Badge'
import { formatCurrency, formatDate } from '../../shared/utils/format'

const PAGE_SIZE = 10

export default function JobsListPage() {
  const user = useSelector((s) => s.auth.currentUser)
  // ?status=Published | Draft | PendingBids (set by the overview cards, also editable here). Filtering and paging are server-side:
  // "PendingBids" is sent as pendingBids=true, every other value as status=<value>.
  const [searchParams, setSearchParams] = useSearchParams()
  const filter = searchParams.get('status') ?? ''
  // The page is remembered together with the filter it belongs to, so a filter change from anywhere (e.g. an overview-card link) shows page 1.
  const [pageState, setPageState] = useState({ filter, page: 1 })
  const page = pageState.filter === filter ? pageState.page : 1
  const setPage = (p) => setPageState({ filter, page: p })
  const { data, isLoading, isFetching, isError } = useGetClientJobsQuery({
    userId: user.userId, page, limit: PAGE_SIZE,
    ...(filter === 'PendingBids' ? { pendingBids: true } : filter ? { status: filter } : {}),
  })
  const visibleJobs = data?.rows ?? []

  function changeFilter(value) {
    setSearchParams(value ? { status: value } : {})
  }

  return (
    <div>
      <PageHeader title="My jobs" description="All jobs you've posted, across every status."
                  actions={
                    <div className="flex items-center gap-2">
                      <Select value={filter} onChange={(e) => changeFilter(e.target.value)} className="w-44">
                        <option value="">Status</option>
                        <option value="Published">Published</option>
                        <option value="Draft">Draft</option>
                        <option value="PendingBids">Pending bids</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Closed">Closed</option>
                      </Select>
                      <Link to="/client/jobs/new"><Button>+ Post a job</Button></Link>
                    </div>
                  } />
      {isLoading && <Spinner />}
      {isError && <ErrorState />}
      {data && visibleJobs.length === 0 && !filter && (
        <EmptyState title="No jobs yet" description="Post a job so freelancers can start bidding."
                    action={<Link to="/client/jobs/new"><Button>+ Post a job</Button></Link>} />
      )}
      {data && visibleJobs.length === 0 && filter && (
        <EmptyState title="No matching jobs" description="No jobs match this filter." />
      )}
      {data && visibleJobs.length > 0 && filter === 'PendingBids' && (
        <div className="space-y-4">
          {visibleJobs.map((job) => (
            <Card key={job.jobId}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link to={`/client/jobs/${job.jobId}`} className="text-base font-semibold text-slate-900 hover:text-indigo-600">{job.title}</Link>
                  <p className="mt-1 text-sm text-slate-500">{formatCurrency(job.budget)} · posted {formatDate(job.createdAt)}</p>
                </div>
                <Badge status={job.status} />
              </div>
              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {job.pendingBidCount} pending bid{job.pendingBidCount === 1 ? '' : 's'}
                </p>
                <div className="divide-y divide-slate-100">
                  {job.pendingBids.map((b) => (
                    <div key={b.bidId} className="flex items-start justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800">
                          {b.freelancerName}
                          {b.freelancerRating ? <span className="ml-2 text-xs text-amber-500">★ {b.freelancerRating}</span> : null}
                        </p>
                        {b.proposal && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{b.proposal}</p>}
                        <p className="mt-1 text-xs text-slate-400">Submitted {formatDate(b.bidDate)}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-semibold text-slate-900">{formatCurrency(b.bidAmount)}</p>
                        <Link to={`/client/jobs/${job.jobId}`} className="text-xs font-medium text-indigo-600 hover:underline">Review bid →</Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      {data && visibleJobs.length > 0 && filter !== 'PendingBids' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {visibleJobs.map((job) => <JobCard key={job.jobId} job={job} to={`/client/jobs/${job.jobId}`} />)}
        </div>
      )}
      {data && <Pagination meta={data.meta} onPageChange={setPage} isFetching={isFetching} />}
    </div>
  )
}
