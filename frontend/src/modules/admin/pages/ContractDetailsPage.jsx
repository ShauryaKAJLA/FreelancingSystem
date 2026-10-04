import { useParams, Link } from 'react-router'
import { useGetAdminContractDetailsQuery } from '../adminApi'
import PageHeader from '../../shared/components/layout/PageHeader'
import Card from '../../shared/components/ui/Card'
import Badge from '../../shared/components/ui/Badge'
import Spinner from '../../shared/components/ui/Spinner'
import ErrorState from '../../shared/components/ui/ErrorState'
import EmptyState from '../../shared/components/ui/EmptyState'
import { formatCurrency, formatDate } from '../../shared/utils/format'

export default function ContractDetailsPage() {
  const { contractId } = useParams()
  const { data: contract, isLoading, isError } = useGetAdminContractDetailsQuery(contractId)

  if (isLoading) return <Spinner label="Loading contract…" />
  if (isError || !contract) return <ErrorState message="Contract not found." />

  return (
    <div>
      <PageHeader
        title={contract.job?.title ?? contract.contractId}
        description={
          contract.status === 'Pending Start'
            ? `${contract.clientName} · ${contract.freelancerName} · awaiting start`
            : `${contract.clientName} · ${contract.freelancerName} · started ${formatDate(contract.startDate)}`
        }
        actions={<Badge status={contract.status} />}
      />

      {contract.status === 'Cancelled' && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <p className="text-sm text-red-700">
            This contract was cancelled{contract.endDate ? ` on ${formatDate(contract.endDate)}` : ''}.
            {contract.cancellationReason ? ` Reason: ${contract.cancellationReason}` : ''}
          </p>
        </Card>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Parties</h2>
          <div className="flex items-center justify-between border-b border-slate-100 py-2.5">
            <span className="text-sm text-slate-500">Client</span>
            <Link to={`/admin/users/${contract.clientId}`} className="text-sm font-medium text-indigo-600 hover:underline">{contract.clientName}</Link>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-sm text-slate-500">Freelancer</span>
            <Link to={`/admin/users/${contract.freelancerId}`} className="text-sm font-medium text-indigo-600 hover:underline">{contract.freelancerName}</Link>
          </div>
        </Card>
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Job</h2>
          <div className="flex items-center justify-between border-b border-slate-100 py-2.5">
            <span className="text-sm text-slate-500">Title</span>
            <span className="text-sm font-medium text-slate-900">{contract.job?.title ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-sm text-slate-500">Budget</span>
            <span className="text-sm font-medium text-slate-900">{contract.job ? formatCurrency(contract.job.budget) : '—'}</span>
          </div>
        </Card>
      </div>

      <h2 className="mb-3 text-base font-semibold text-slate-900">Milestones & payments</h2>
      <div className="mb-6 space-y-3">
        {contract.milestones.length === 0 && <EmptyState title="No milestones" description="No milestones have been created for this contract yet." />}
        {contract.milestones.map((m) => (
          <Card key={m.milestoneId} className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">{m.title}</p>
              <p className="text-xs text-slate-500">Due {formatDate(m.dueDate)} · {formatCurrency(m.amount)}</p>
              {m.payment && (
                <p className="mt-1 text-xs text-emerald-600">
                  Paid {formatDate(m.payment.paymentDate)} ·{' '}
                  <Link to={`/admin/payments/${m.payment.paymentId}`} className="underline">{m.payment.paymentId}</Link>
                </p>
              )}
            </div>
            <Badge status={m.status} />
          </Card>
        ))}
      </div>

      <h2 className="mb-3 text-base font-semibold text-slate-900">Reviews</h2>
      <div className="space-y-3">
        {contract.reviews.length === 0 && <EmptyState title="No reviews" description="Neither party has left a review for this contract yet." />}
        {contract.reviews.map((r) => (
          <Card key={r.reviewId}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-900">{r.reviewerName} → {r.revieweeName}</p>
              <div className="flex items-center gap-2">
                <span className="text-sm text-amber-500">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                <Badge status={r.status ?? 'Visible'} />
              </div>
            </div>
            <p className="mt-1 text-sm text-slate-600">{r.comment}</p>
            <p className="mt-1 text-xs text-slate-400">{formatDate(r.reviewDate)}</p>
          </Card>
        ))}
      </div>
    </div>
  )
}
