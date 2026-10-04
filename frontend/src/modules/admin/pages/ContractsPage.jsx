import { Link, useSearchParams } from 'react-router'
import { useGetAdminContractsQuery } from '../adminApi'
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

export default function ContractsPage() {
  const [searchParams] = useSearchParams()
  const { filters, params, setFilter, setPage } = useListParams({ status: searchParams.get('status') ?? '' })
  const { data, isLoading, isFetching, isError } = useGetAdminContractsQuery(params)
  const contracts = data?.rows

  return (
    <div>
      <PageHeader
        title="Contracts"
        description="All contracts formed between clients and freelancers across the platform."
        actions={
          <Select value={filters.status} onChange={(e) => setFilter('status', e.target.value)} className="w-44">
            <option value="">Status</option>
            <option value="Pending Start">Pending</option>
            <option value="Active">Active</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
            <option value="Terminated">Terminated</option>
          </Select>
        }
      />
      {isLoading && <Spinner />}
      {isError && <ErrorState />}
      {contracts && (
        <Table
          rowKey="contractId"
          rows={contracts}
          emptyState={<EmptyState title="No contracts" description="No contracts match this filter." />}
          columns={[
            { key: 'contractId', header: 'Contract', render: (r) => <Link to={`/admin/contracts/${r.contractId}`} className="font-medium text-indigo-600 hover:underline">{r.contractId}</Link> },
            { key: 'jobTitle', header: 'Job' },
            { key: 'clientName', header: 'Client' },
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
