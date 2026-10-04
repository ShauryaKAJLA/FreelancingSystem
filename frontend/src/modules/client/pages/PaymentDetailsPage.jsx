import { useParams, Link } from 'react-router'
import { useGetClientPaymentDetailsQuery } from '../clientApi'
import PageHeader from '../../shared/components/layout/PageHeader'
import Card from '../../shared/components/ui/Card'
import Badge from '../../shared/components/ui/Badge'
import Spinner from '../../shared/components/ui/Spinner'
import ErrorState from '../../shared/components/ui/ErrorState'
import { formatCurrency, formatDate } from '../../shared/utils/format'

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2.5 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-900">{value}</span>
    </div>
  )
}

export default function PaymentDetailsPage() {
  const { paymentId } = useParams()
  const { data: payment, isLoading, isError } = useGetClientPaymentDetailsQuery(paymentId)

  if (isLoading) return <Spinner label="Loading payment…" />
  if (isError || !payment) return <ErrorState message="Unable to open this payment. Please try again." />

  return (
    <div>
      <PageHeader
        title={`Payment ${payment.paymentId}`}
        description={`${payment.paymentStatus === 'Paid' ? 'Dispatched to freelancer' : 'Paid to platform'} ${formatDate(payment.paymentDate)}`}
        actions={<Badge status={payment.paymentStatus} />}
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Transaction</h2>
          <Row label="Payment ID" value={payment.paymentId} />
          <Row label="Amount" value={formatCurrency(payment.amount)} />
          <Row label="Status" value={<Badge status={payment.paymentStatus} />} />
          <Row label="Payment method" value={payment.razorpayPaymentId ? "Razorpay (paid to platform)" : "Escrow release"} />
          <Row label="Transaction ID" value={`txn_${payment.paymentId}`} />
          <Row label="Date" value={formatDate(payment.paymentDate)} />
        </Card>
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Contract</h2>
          <Row label="Job" value={payment.jobTitle ?? '—'} />
          <Row label="Freelancer" value={payment.freelancerName ?? '—'} />
          <Row label="Milestone" value={payment.milestone?.title ?? '—'} />
          <Row
            label="Contract"
            value={
              payment.contract ? (
                <Link to={`/client/contracts/${payment.contract.contractId}`} className="font-medium text-indigo-600 hover:underline">
                  {payment.contract.contractId}
                </Link>
              ) : '—'
            }
          />
        </Card>
      </div>
    </div>
  )
}
