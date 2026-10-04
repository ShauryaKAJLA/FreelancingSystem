import { useSelector } from 'react-redux'
import { Link } from 'react-router'
import { useGetClientContractsQuery } from '../clientApi'
import PageHeader from '../../shared/components/layout/PageHeader'
import Select from '../../shared/components/ui/Select'
import Pagination from '../../shared/components/ui/Pagination'
import { useListParams } from '../../shared/hooks/useListParams'
import Table from '../../shared/components/ui/Table'
import Badge from '../../shared/components/ui/Badge'
import Spinner from '../../shared/components/ui/Spinner'
import ErrorState from '../../shared/components/ui/ErrorState'
import EmptyState from '../../shared/components/ui/EmptyState'
import { formatDate } from '../../shared/utils/format'

export default function ContractsListPage() {
  const user = useSelector((s) => s.auth.currentUser)
  const { filters, params, setFilter, setPage } = useListParams({ status: '' })
  const { data, isLoading, isFetching, isError } = useGetClientContractsQuery({ userId: user.userId, ...params })
  const contracts = data?.rows

  return (
    <div>
      <PageHeader title="Contracts" description="Active and completed contracts with your hired freelancers." />
      <div className="mb-3 flex justify-end">
        <Select value={filters.status} onChange={(e) => setFilter('status', e.target.value)} className="w-44" aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="Pending Start">Pending</option>
          <option value="Active">Active</option>
          <option value="Completed">Completed</option>
          <option value="Cancelled">Cancelled</option>
          <option value="Terminated">Terminated</option>
        </Select>
      </div>
      {isLoading && <Spinner />}
      {isError && <ErrorState />}
      {contracts && (
        <Table
          rowKey="contractId"
          rows={contracts}
          emptyState={<EmptyState title="No contracts yet" description="Contracts appear here once you accept a bid on a job." />}
          columns={[
            { key: 'jobTitle', header: 'Job', render: (r) => <Link to={`/client/contracts/${r.contractId}`} className="font-medium text-indigo-600 hover:underline">{r.jobTitle}</Link> },
            { key: 'freelancerName', header: 'Freelancer' },
            { key: 'startDate', header: 'Started', render: (r) => formatDate(r.startDate) },
            { key: 'status', header: 'Status', render: (r) => <Badge status={r.status} /> },
          ]}
        />
      )}
      {data && <Pagination meta={data.meta} onPageChange={setPage} isFetching={isFetching} />}
    </div>
  )
}
