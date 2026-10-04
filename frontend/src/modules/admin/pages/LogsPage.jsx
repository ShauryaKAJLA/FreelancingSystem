import { useGetAdminActionsLogQuery } from '../adminApi'
import PageHeader from '../../shared/components/layout/PageHeader'
import Input from '../../shared/components/ui/Input'
import Pagination from '../../shared/components/ui/Pagination'
import { useListParams } from '../../shared/hooks/useListParams'
import Table from '../../shared/components/ui/Table'
import Spinner from '../../shared/components/ui/Spinner'
import ErrorState from '../../shared/components/ui/ErrorState'
import EmptyState from '../../shared/components/ui/EmptyState'
import { formatDate } from '../../shared/utils/format'

export default function LogsPage() {
  const { filters, params, setFilter, setPage } = useListParams({ search: '' })
  const { data, isLoading, isFetching, isError } = useGetAdminActionsLogQuery(params)
  const logs = data?.rows

  return (
    <div>
      <PageHeader title="System logs" description="Audit trail of administrative actions."
                  actions={<Input value={filters.search} onChange={(e) => setFilter('search', e.target.value)} placeholder="Search actions" aria-label="Search actions" className="w-56" />} />
      {isLoading && <Spinner />}
      {isError && <ErrorState />}
      {logs && (
        <Table
          rowKey="actionId"
          rows={logs}
          emptyState={<EmptyState title="No log entries yet" />}
          columns={[
            { key: 'actionType', header: 'Action' },
            { key: 'actionDescription', header: 'Description' },
            { key: 'adminName', header: 'Performed by' },
            { key: 'actionDate', header: 'Date', render: (r) => formatDate(r.actionDate) },
          ]}
        />
      )}
      {data && <Pagination meta={data.meta} onPageChange={setPage} isFetching={isFetching} />}
    </div>
  )
}
