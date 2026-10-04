import { Link } from 'react-router'
import { useGetAdminOpenJobsQuery } from '../adminApi'
import PageHeader from '../../shared/components/layout/PageHeader'
import Input from '../../shared/components/ui/Input'
import Pagination from '../../shared/components/ui/Pagination'
import { useListParams } from '../../shared/hooks/useListParams'
import Table from '../../shared/components/ui/Table'
import Badge from '../../shared/components/ui/Badge'
import Spinner from '../../shared/components/ui/Spinner'
import ErrorState from '../../shared/components/ui/ErrorState'
import EmptyState from '../../shared/components/ui/EmptyState'
import { formatCurrency, formatDate } from '../../shared/utils/format'

export default function OpenJobsPage() {
  const { filters, params, setFilter, setPage } = useListParams({ search: '' })
  const { data, isLoading, isFetching, isError } = useGetAdminOpenJobsQuery(params)
  const jobs = data?.rows

  return (
    <div>
      <PageHeader title="Open jobs" description="Jobs currently accepting bids. Active and completed jobs are not listed here."
                  actions={<Input value={filters.search} onChange={(e) => setFilter('search', e.target.value)} placeholder="Search job title" aria-label="Search jobs" className="w-56" />} />
      <p className="mb-3 text-sm"><Link to="/admin/dashboard" className="text-indigo-600 hover:underline">← Back to overview</Link></p>
      {isLoading && <Spinner />}
      {isError && <ErrorState />}
      {jobs && (
        <Table
          rowKey="jobId"
          rows={jobs}
          emptyState={<EmptyState title="No open jobs" description="No jobs are accepting bids right now." />}
          columns={[
            { key: 'title', header: 'Job', render: (r) => <span className="font-medium text-slate-900">{r.title}</span> },
            { key: 'clientName', header: 'Client' },
            { key: 'budget', header: 'Budget', render: (r) => formatCurrency(r.budget) },
            { key: 'bidCount', header: 'Bids' },
            { key: 'createdAt', header: 'Posted', render: (r) => formatDate(r.createdAt) },
            { key: 'status', header: 'Status', render: () => <Badge status="Published" /> },
          ]}
        />
      )}
      {data && <Pagination meta={data.meta} onPageChange={setPage} isFetching={isFetching} />}
    </div>
  )
}
