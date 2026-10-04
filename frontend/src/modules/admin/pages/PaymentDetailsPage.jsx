import { useState } from 'react'
import { useSelector } from 'react-redux'
import { useParams, Link } from 'react-router'
import { useGetPaymentDetailsQuery, useVerifyPaymentMutation, useDispatchPaymentMutation, useRefundPaymentMutation } from '../adminApi'
import PageHeader from '../../shared/components/layout/PageHeader'
import Card from '../../shared/components/ui/Card'
import Badge from '../../shared/components/ui/Badge'
import Spinner from '../../shared/components/ui/Spinner'
import ErrorState from '../../shared/components/ui/ErrorState'
import Button from '../../shared/components/ui/Button'
import ConfirmDialog from '../../shared/components/ui/ConfirmDialog'
import { useNotify } from '../../shared/notifications/NotificationProvider'
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
  const { data: payment, isLoading, isError } = useGetPaymentDetailsQuery(paymentId)
  const [verifyPayment, { isLoading: verifying }] = useVerifyPaymentMutation()
  const [dispatchPayment, { isLoading: dispatching }] = useDispatchPaymentMutation()
  const [refundPayment, { isLoading: refunding }] = useRefundPaymentMutation()
  const admin = useSelector((s) => s.auth.currentUser)
  const notify = useNotify()
  const [dispatchOpen, setDispatchOpen] = useState(false)
  const [refundOpen, setRefundOpen] = useState(false)

  if (isLoading) return <Spinner label="Loading payment…" />
  if (isError || !payment) return <ErrorState message="Unable to open this payment. Please try again." />

  async function handleRefund() {
    const result = await refundPayment({ paymentId: payment.paymentId, reason: 'Refund initiated by admin' })
    if (!result.error) notify.success('Refund initiated. It completes when the payment provider confirms it.')
    else notify.error(result.error?.data ?? 'Could not start the refund. Please try again.')
    setRefundOpen(false)
  }

  async function handleDispatch() {
    const result = await dispatchPayment({ paymentId: payment.paymentId, adminId: admin.userId })
    if (result.data) {
      notify.success(`${formatCurrency(payment.amount)} dispatched to ${payment.freelancerName}.`)
      setDispatchOpen(false)
    } else {
      notify.error(result.error?.data ?? 'Could not dispatch this payment. Please try again.')
      setDispatchOpen(false)
    }
  }

  const acct = payment.freelancerAccount
  const acctLabel = acct ? (acct.upiId ? `UPI: ${acct.upiId}` : `A/c ****${String(acct.accountNumber).slice(-4)} · IFSC ${acct.ifsc}`) : 'Not added by the freelancer yet'
  const awaiting = payment.paymentStatus === 'Awaiting Payout'

  return (
    <div>
      <PageHeader
        title={`Payment ${payment.paymentId}`}
        description={`${payment.paymentStatus === 'Paid' ? 'Dispatched' : 'Received'} ${formatDate(payment.paymentDate)}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge status={payment.paymentStatus} />
            {payment.paymentStatus === 'Held' && <Button variant="secondary" onClick={() => setRefundOpen(true)} disabled={refunding}>{refunding ? 'Refunding…' : 'Refund to client'}</Button>}
            {awaiting && <Button onClick={() => setDispatchOpen(true)} disabled={dispatching}>{dispatching ? 'Dispatching…' : 'Dispatch to freelancer'}</Button>}
            {!payment.adminVerified && <Button onClick={() => verifyPayment(payment.paymentId)} disabled={verifying}>{verifying ? 'Saving…' : 'Mark as verified'}</Button>}
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Transaction</h2>
          <Row label="Payment ID" value={payment.paymentId} />
          <Row label="Amount" value={formatCurrency(payment.amount)} />
          <Row label="Status" value={<Badge status={payment.paymentStatus} />} />
          <Row label="Collected via" value={payment.razorpayPaymentId ? 'Razorpay (paid to platform)' : 'Platform escrow'} />
          <Row label="Razorpay payment ID" value={payment.razorpayPaymentId ?? `txn_${payment.paymentId}`} />
          <Row label="Payout account" value={acctLabel} />
          <Row label="Paid out to" value={payment.payoutTo ?? (payment.paymentStatus === 'Held' ? 'Milestone not approved yet' : payment.paymentStatus === 'Awaiting Payout' ? 'Awaiting admin dispatch' : '—')} />
          {payment.payoutId && <Row label="Payout reference" value={payment.payoutId} />}
          <Row label="Admin review" value={payment.adminVerified ? 'Verified' : 'Not reviewed'} />
          <Row label="Date" value={formatDate(payment.paymentDate)} />
        </Card>
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Contract</h2>
          <Row label="Job" value={payment.jobTitle ?? '—'} />
          <Row label="Client" value={payment.clientName ?? '—'} />
          <Row label="Freelancer" value={payment.freelancerName ?? '—'} />
          <Row label="Milestone" value={payment.milestone?.title ?? '—'} />
          <Row
            label="Contract"
            value={
              payment.contract ? (
                <Link to={`/admin/contracts/${payment.contract.contractId}`} className="font-medium text-indigo-600 hover:underline">
                  {payment.contract.contractId}
                </Link>
              ) : '—'
            }
          />
        </Card>
      </div>
      <ConfirmDialog
        open={refundOpen}
        title="Refund payment to client"
        description={`Return ${formatCurrency(payment.amount)} to the client? Only possible while the milestone is unapproved. This cannot be undone.`}
        confirmLabel="Refund funds"
        variant="danger"
        isLoading={refunding}
        onConfirm={handleRefund}
        onClose={() => setRefundOpen(false)}
      />
      <ConfirmDialog
        open={dispatchOpen}
        title="Dispatch payment to freelancer"
        description={`Send ${formatCurrency(payment.amount)} held by the platform to ${payment.freelancerName} (${acctLabel})? This cannot be undone.`}
        confirmLabel="Dispatch funds"
        variant="primary"
        isLoading={dispatching}
        onConfirm={handleDispatch}
        onClose={() => setDispatchOpen(false)}
      />
    </div>
  )
}
