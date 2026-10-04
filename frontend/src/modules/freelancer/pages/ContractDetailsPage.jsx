import { useParams } from 'react-router'
import { useSelector } from 'react-redux'
import { useGetFreelancerContractDetailsQuery, useSubmitMilestoneMutation } from '../freelancerApi'
import PageHeader from '../../shared/components/layout/PageHeader'
import Card from '../../shared/components/ui/Card'
import Badge from '../../shared/components/ui/Badge'
import Button from '../../shared/components/ui/Button'
import Spinner from '../../shared/components/ui/Spinner'
import ErrorState from '../../shared/components/ui/ErrorState'
import { formatCurrency, formatDate } from '../../shared/utils/format'
import { downloadContractPdf } from '../../shared/utils/contractPdf'
import { useNotify } from '../../shared/notifications/NotificationProvider'
import { ContractDisputeButtons, TerminationBanner } from '../../shared/components/contracts/ContractDisputeActions'

export default function ContractDetailsPage() {
  const { contractId } = useParams()
  const notify = useNotify()
  const user = useSelector((s) => s.auth.currentUser)
  const { data: contract, isLoading, isError } = useGetFreelancerContractDetailsQuery(contractId)
  const [submitMilestone, { isLoading: submitting }] = useSubmitMilestoneMutation()

  if (isLoading) return <Spinner label="Loading contract…" />
  if (isError || !contract) return <ErrorState message="Contract not found." />

  async function handleSubmitMilestone(milestoneId) {
    const result = await submitMilestone(milestoneId)
    if (result.data) notify.success('Milestone submitted for approval.')
    else notify.error(result.error?.data ?? 'Could not submit this milestone. Please try again.')
  }

  return (
    <div>
      <PageHeader
        title={contract.job.title}
        description={`Client: ${contract.clientName} · started ${formatDate(contract.startDate)}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge status={contract.status} />
            <Button variant="secondary" onClick={() => downloadContractPdf(contract)}>Download PDF</Button>
            <ContractDisputeButtons contract={contract} role="Freelancer" userId={user.userId} />
          </div>
        }
      />
      <TerminationBanner contract={contract} role="Freelancer" />

      {(contract.job?.milestoneTasks ?? []).length > 0 && (
        <Card className="mb-6">
          <h2 className="mb-2 text-base font-semibold text-slate-900">Milestone task specifications</h2>
          <ol className="space-y-2 text-sm text-slate-700">
            {contract.job.milestoneTasks.map((t, i) => (
              <li key={i}><span className="font-medium text-slate-900">Milestone {i + 1}:</span> {t}</li>
            ))}
          </ol>
        </Card>
      )}
      <h2 className="mb-3 text-base font-semibold text-slate-900">Milestones & payment status</h2>
      {contract.status === 'Pending Start' && (
        <Card className="mb-4">
          <p className="text-sm text-slate-500">Waiting for the client to start this contract. Milestones will appear here once it's active.</p>
        </Card>
      )}
      {contract.status === 'Cancelled' && (
        <Card className="mb-4 border-red-200 bg-red-50">
          <p className="text-sm text-red-700">This contract was cancelled by the client.</p>
        </Card>
      )}
      <div className="space-y-3">
        {contract.milestones.length === 0 && (
          <Card>
            <p className="text-sm text-slate-500">No milestones have been added to this contract yet.</p>
          </Card>
        )}
        {contract.milestones.map((m) => (
          <Card key={m.milestoneId} className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">{m.title}</p>
              {m.taskSpec && <p className="text-xs text-slate-600">{m.taskSpec}</p>}
              <p className="text-xs text-slate-500">Due {formatDate(m.dueDate)} · {formatCurrency(m.amount)}</p>
              {m.payment?.paymentStatus === 'Held' && <p className="mt-1 text-xs text-amber-600">Client has paid this milestone to the platform — you can start</p>}
              {m.payment?.paymentStatus === 'Awaiting Payout' && <p className="mt-1 text-xs text-sky-700">Approved by client — admin will dispatch your payment</p>}
              {m.payment?.paymentStatus === 'Paid' && <p className="mt-1 text-xs text-emerald-600">Paid {formatDate(m.payment.paymentDate)}</p>}
            </div>
            <div className="flex items-center gap-3">
              <Badge status={m.status} />
              {m.status === 'Pending' && m.funded === false && <span className="text-xs text-slate-400">Awaiting client funding</span>}
              {m.status === 'Pending' && m.funded !== false && (
                <Button onClick={() => handleSubmitMilestone(m.milestoneId)} disabled={submitting}>
                  {submitting ? 'Submitting…' : 'Mark as submitted'}
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
