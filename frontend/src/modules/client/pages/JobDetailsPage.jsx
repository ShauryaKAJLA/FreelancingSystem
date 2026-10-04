import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import {
  useGetJobDetailsQuery, useAcceptBidMutation,
  usePublishJobMutation, useDeleteJobMutation, useCancelJobMutation,
} from '../clientApi'
import PageHeader from '../../shared/components/layout/PageHeader'
import Card from '../../shared/components/ui/Card'
import Badge from '../../shared/components/ui/Badge'
import Button from '../../shared/components/ui/Button'
import Spinner from '../../shared/components/ui/Spinner'
import ErrorState from '../../shared/components/ui/ErrorState'
import EmptyState from '../../shared/components/ui/EmptyState'
import ConfirmDialog from '../../shared/components/ui/ConfirmDialog'
import BidCard from '../components/BidCard'
import { formatCurrency, formatDate } from '../../shared/utils/format'
import { useNotify } from '../../shared/notifications/NotificationProvider'

export default function JobDetailsPage() {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const notify = useNotify()
  const { data: job, isLoading, isError } = useGetJobDetailsQuery(jobId)
  const [acceptBid, { isLoading: accepting }] = useAcceptBidMutation()
  const [publishJob, { isLoading: publishing }] = usePublishJobMutation()
  const [deleteJob, { isLoading: deleting, error: deleteError }] = useDeleteJobMutation()
  const [cancelJob, { isLoading: cancelling, error: cancelError }] = useCancelJobMutation()

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)

  async function handleAccept(bidId) {
    const result = await acceptBid({ jobId, bidId })
    if (result.data) {
      notify.success('Bid accepted — contract created.')
      navigate(`/client/contracts/${result.data.contractId}`)
    } else {
      notify.error(result.error?.data ?? 'Could not accept this bid. Please try again.')
    }
  }

  async function handlePublish() {
    const result = await publishJob(jobId)
    if (result.data) notify.success('Job published — it\u2019s now visible to freelancers.')
    else notify.error(result.error?.data ?? 'Could not publish this job. Please try again.')
  }

  async function handleDelete() {
    const result = await deleteJob(jobId)
    if (result.data) {
      notify.success('Draft deleted.')
      navigate('/client/jobs')
    } else {
      notify.error(result.error?.data ?? 'Could not delete this draft. Please try again.')
    }
  }

  async function handleCancel(reason) {
    const result = await cancelJob({ jobId, reason })
    if (result.data) {
      notify.success('Job cancelled.')
      setCancelOpen(false)
    } else {
      notify.error(result.error?.data ?? 'Could not cancel this job. Please try again.')
    }
  }

  if (isLoading) return <Spinner label="Loading job…" />
  if (isError || !job) return <ErrorState message="Job not found." />

  const isDraft = job.status === 'Draft'
  const isPublished = job.status === 'Published'

  return (
    <div>
      <PageHeader
        title={job.title}
        description={`Posted ${formatDate(job.createdAt)} · Budget ${formatCurrency(job.budget)}`}
        actions={<Badge status={job.status} />}
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {(isDraft || isPublished) && (
          <Link to={`/client/jobs/${jobId}/edit`}><Button variant="secondary">Edit job</Button></Link>
        )}
        {isDraft && (
          <Button onClick={handlePublish} disabled={publishing}>{publishing ? 'Publishing…' : 'Publish job'}</Button>
        )}
        {isDraft && (
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>Delete draft</Button>
        )}
        {isPublished && (
          <Button variant="danger" onClick={() => setCancelOpen(true)}>Cancel job</Button>
        )}
      </div>

      {isDraft && (
        <Card className="mb-6 border-slate-200 bg-slate-50">
          <p className="text-sm text-slate-600">
            This job is a draft and isn't visible to freelancers yet. Publish it when you're ready to start receiving bids.
          </p>
        </Card>
      )}

      <Card className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Description</h2>
        <p className="text-sm text-slate-600">{job.description}</p>
      </Card>

      {!isDraft && (
        <>
          <h2 className="mb-3 text-base font-semibold text-slate-900">
            Bids received ({job.bids.length})
          </h2>
          {job.bids.length === 0 ? (
            <EmptyState title="No bids yet" description="Freelancers haven't submitted proposals on this job yet — check back soon." />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {job.bids.map((bid) => (
                <BidCard key={bid.bidId} bid={bid} onAccept={handleAccept} disabled={accepting || job.status !== 'Published'} />
              ))}
            </div>
          )}
        </>
      )}

      {job.status === 'In Progress' && (
        <p className="mt-4 text-sm text-slate-500">
          A freelancer has been hired for this job. <Link to="/client/contracts" className="font-medium text-indigo-600 hover:underline">View the contract →</Link>
        </p>
      )}

      <ConfirmDialog
        open={deleteOpen}
        title="Delete draft job"
        description="This permanently deletes the draft. This cannot be undone."
        confirmLabel="Delete draft"
        variant="danger"
        isLoading={deleting}
        error={deleteError}
        onConfirm={handleDelete}
        onClose={() => setDeleteOpen(false)}
      />

      <ConfirmDialog
        open={cancelOpen}
        title="Cancel job"
        description="Cancelling closes this job to new bids and rejects any pending proposals. This cannot be undone."
        confirmLabel="Cancel job"
        variant="danger"
        collectReason
        reasonLabel="Reason (optional)"
        isLoading={cancelling}
        error={cancelError}
        onConfirm={handleCancel}
        onClose={() => setCancelOpen(false)}
      />
    </div>
  )
}
