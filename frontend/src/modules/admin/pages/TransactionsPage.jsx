import { Link } from 'react-router'
import { useGetTransactionsQuery } from '../adminApi'
import PageHeader from '../../shared/components/layout/PageHeader'
import Select from '../../shared/components/ui/Select'
import Pagination from '../../shared/components/ui/Pagination'
import { useListParams } from '../../shared/hooks/useListParams'
import Table from '../../shared/components/ui/Table'
import Badge from '../../shared/components/ui/Badge'
import Spinner from '../../shared/components/ui/Spinner'
import ErrorState from '../../shared/components/ui/ErrorState'
import EmptyState from '../../shared/components/ui/EmptyState'
import { formatCurrency, formatDate } from '../../shared/utils/format'

export default function TransactionsPage() {
  const { filters, params, setFilter, setPage } = useListParams({ status: '' })
  const { data, isLoading, isFetching, isError } = useGetTransactionsQuery(params)
  const payments = data?.rows

  return (
    <div>
      <PageHeader title="Transactions" description="Milestone payments collected from clients and dispatched to freelancers. Approved milestones appear first — open one to dispatch the funds."
                  actions={
                    <Select value={filters.status} onChange={(e) => setFilter('status', e.target.value)} className="w-44">
                      <option value="">Status</option>
                      <option value="Held">Held</option>
                      <option value="Awaiting Payout">Awaiting Payout</option>
                      <option value="Paid">Paid</option>
                      <option value="Refunded">Refunded</option>
                    </Select>
                  } />
      {isLoading && <Spinner />}
      {isError && <ErrorState />}
      {payments && (
        <Table
          rowKey="paymentId"
          rows={payments}
          emptyState={<EmptyState title="No transactions yet" />}
          columns={[
            { key: 'paymentId', header: 'Payment', render: (r) => <Link to={`/admin/payments/${r.paymentId}`} className="font-medium text-indigo-600 hover:underline">{r.paymentId}</Link> },
            { key: 'jobTitle', header: 'Job' },
            { key: 'milestoneTitle', header: 'Milestone' },
            { key: 'clientName', header: 'Client' },
            { key: 'freelancerName', header: 'Freelancer' },
            { key: 'amount', header: 'Amount', render: (r) => formatCurrency(r.amount) },
            { key: 'paymentDate', header: 'Date', render: (r) => formatDate(r.paymentDate) },
            { key: 'paymentStatus', header: 'Status', render: (r) => <Badge status={r.paymentStatus} /> },
            { key: 'adminVerified', header: 'Reviewed', render: (r) => (r.adminVerified ? 'Verified' : 'Not reviewed') },
            { key: 'action', header: '', render: (r) => (r.paymentStatus === 'Awaiting Payout' ? <Link to={`/admin/payments/${r.paymentId}`} className="font-semibold text-indigo-600 hover:underline">Dispatch</Link> : null) },
          ]}
        />
      )}
      {data && <Pagination meta={data.meta} onPageChange={setPage} isFetching={isFetching} />}
    </div>
  )
}
