import { useState } from 'react'
import { useParams } from 'react-router'
import { useSelector } from 'react-redux'
import { useGetJobDetailsForFreelancerQuery, useSubmitBidMutation, useEditBidMutation, useWithdrawBidMutation } from '../freelancerApi'
import PageHeader from '../../shared/components/layout/PageHeader'
import Card from '../../shared/components/ui/Card'
import Badge from '../../shared/components/ui/Badge'
import Button from '../../shared/components/ui/Button'
import ConfirmDialog from '../../shared/components/ui/ConfirmDialog'
import Spinner from '../../shared/components/ui/Spinner'
import ErrorState from '../../shared/components/ui/ErrorState'
import BidForm from '../components/BidForm'
import { formatCurrency, formatDate } from '../../shared/utils/format'
import { useNotify } from '../../shared/notifications/NotificationProvider'

export default function JobDetailsPage() {
  const { jobId } = useParams()
  const user = useSelector((s) => s.auth.currentUser)
  const notify = useNotify()
  const { data: job, isLoading, isError, refetch } = useGetJobDetailsForFreelancerQuery({ jobId, freelancerId: user.userId })
  const [submitBid, { isLoading: submitting, error: submitError }] = useSubmitBidMutation()
  const [editBid, { isLoading: editing, error: editError }] = useEditBidMutation()
  const [withdrawBid, { isLoading: withdrawing, error: withdrawError }] = useWithdrawBidMutation()
  const [isEditing, setIsEditing] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)

  if (isLoading) return <Spinner label="Loading job…" />
  if (isError || !job) return <ErrorState message="Job not found." />

  async function handleSubmit(bid) {
    const result = await submitBid({ jobId, freelancerId: user.userId, ...bid })
    if (result.data) {
      notify.success('Proposal submitted.')
      refetch()
    } else {
      notify.error(result.error?.data ?? 'Could not submit your proposal. Please try again.')
    }
  }

  async function handleEditSubmit(bid) {
    const result = await editBid({ bidId: job?.myBid?.bidId, ...bid })
    if (result.data) {
      notify.success('Proposal updated.')
      setIsEditing(false)
      refetch()
    } else {
      notify.error(result.error?.data ?? 'Could not save your proposal. Please try again.')
    }
  }

  async function handleWithdraw() {
    const result = await withdrawBid(job?.myBid?.bidId)
    if (result.data) {
      notify.success('Bid withdrawn.')
      setWithdrawOpen(false)
      refetch()
    } else {
      notify.error(result.error?.data ?? 'Could not withdraw this bid. Please try again.')
    }
  }

  const canEditOrWithdraw = job.myBid && (job.myBid.status === 'Pending' || job.myBid.status === 'Updated')

  return (
    <div>
      <PageHeader
        title={job.title}
        description={`${job.clientName} · posted ${formatDate(job.createdAt)} · budget ${formatCurrency(job.budget)}`}
        actions={<Badge status={job.status} />}
      />
      <Card className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Description</h2>
        <p className="text-sm text-slate-600">{job.description}</p>
      </Card>

      {job.myBid && !isEditing ? (
        <Card className="max-w-lg">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Your Bid</h2>
            <Badge status={job.myBid.status} />
          </div>
          <p className="text-lg font-bold text-slate-900">{formatCurrency(job.myBid.bidAmount)}</p>
          <p className="mt-2 text-sm text-slate-600">{job.myBid.proposal}</p>
          <p className="mt-2 text-xs text-slate-400">Last updated {formatDate(job.myBid.bidDate)}</p>
          {canEditOrWithdraw && (
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" onClick={() => setIsEditing(true)}>Edit proposal</Button>
              <Button variant="danger" onClick={() => setWithdrawOpen(true)}>Withdraw Bids</Button>
            </div>
          )}
          {withdrawError && <p className="mt-2 text-sm text-red-600">{withdrawError.data}</p>}
        </Card>
      ) : job.myBid && isEditing ? (
        <>
          <BidForm
            onSubmit={handleEditSubmit}
            isLoading={editing}
            budget={job.budget}
            initialValues={{ bidAmount: job.myBid.bidAmount, proposal: job.myBid.proposal }}
            title="Edit your bid"
            submitLabel="Save changes"
            submittingLabel="Saving…"
          />
          <div className="mt-3 max-w-lg">
            <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
          </div>
          {editError && <p className="mt-2 max-w-lg text-sm text-red-600">{editError.data}</p>}
        </>
      ) : job.status === 'Published' ? (
        <>
          <BidForm onSubmit={handleSubmit} isLoading={submitting} budget={job.budget} />
          {submitError && <p className="mt-2 max-w-lg text-sm text-red-600">{submitError.data}</p>}
        </>
      ) : (
        <Card className="max-w-lg"><p className="text-sm text-slate-500">This job is no longer accepting bids.</p></Card>
      )}

      <ConfirmDialog
        open={withdrawOpen}
        title="Withdraw Bids"
        description="Withdrawing removes your bid from consideration. You can submit a new one later if the job is still open. This cannot be undone."
        confirmLabel="Withdraw Bids"
        isLoading={withdrawing}
        error={withdrawError}
        onConfirm={handleWithdraw}
        onClose={() => setWithdrawOpen(false)}
      />
    </div>
  )
}
