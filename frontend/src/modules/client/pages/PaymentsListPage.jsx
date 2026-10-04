import { useSelector } from 'react-redux'
import { Link } from 'react-router'
import { useGetClientPaymentsQuery } from '../clientApi'
import PaymentMethodsSection from '../components/PaymentMethodsSection'
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

export default function PaymentsListPage() {
  const user = useSelector((s) => s.auth.currentUser)
  const { filters, params, setFilter, setPage } = useListParams({ status: '' })
  const { data, isLoading, isFetching, isError } = useGetClientPaymentsQuery({ userId: user.userId, ...params })
  const payments = data?.rows

  return (
    <div>
      <PageHeader title="Payments" description="Milestone payments you've made to the platform. Funds are dispatched to the freelancer by the admin after you approve each milestone." />
      <PaymentMethodsSection clientId={user.userId} />
      <h2 className="mb-3 text-base font-semibold text-slate-900">Payment history</h2>
      <div className="mb-3 flex justify-end">
        <Select value={filters.status} onChange={(e) => setFilter('status', e.target.value)} className="w-44" aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="Held">Held</option>
          <option value="Awaiting Payout">Awaiting Payout</option>
          <option value="Paid">Paid</option>
          <option value="Refunded">Refunded</option>
        </Select>
      </div>
      {isLoading && <Spinner label="Loading payments…" />}
      {isError && <ErrorState message="Unable to load payments. Please try again." />}
      {payments && (
        <Table
          rowKey="paymentId"
          rows={payments}
          emptyState={<EmptyState title="No payment records" description="No payment records are available yet. They'll appear here once you release a milestone payment." />}
          columns={[
            { key: 'paymentId', header: 'Payment', render: (r) => <Link to={`/client/payments/${r.paymentId}`} className="font-medium text-indigo-600 hover:underline">{r.paymentId}</Link> },
            { key: 'jobTitle', header: 'Job' },
            { key: 'freelancerName', header: 'Freelancer' },
            { key: 'milestoneTitle', header: 'Milestone' },
            { key: 'amount', header: 'Amount', render: (r) => formatCurrency(r.amount) },
            { key: 'paymentDate', header: 'Date', render: (r) => formatDate(r.paymentDate) },
            { key: 'paymentStatus', header: 'Status', render: (r) => <Badge status={r.paymentStatus} /> },
          ]}
        />
      )}
      {data && <Pagination meta={data.meta} onPageChange={setPage} isFetching={isFetching} />}
    </div>
  )
}
