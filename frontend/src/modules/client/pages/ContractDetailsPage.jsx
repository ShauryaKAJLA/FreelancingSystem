import { useState } from 'react'
import { useParams } from 'react-router'
import { useSelector } from 'react-redux'
import {
  useGetContractDetailsQuery, useReleaseMilestonePaymentMutation, useCreateMilestoneMutation,
  useEditMilestoneMutation, useDeleteMilestoneMutation, useFundMilestoneMutation, useRejectMilestoneMutation,
  useSubmitClientReviewMutation, useStartContractMutation, useCompleteContractMutation, useCancelContractMutation,
} from '../clientApi'
import PageHeader from '../../shared/components/layout/PageHeader'
import Card from '../../shared/components/ui/Card'
import Badge from '../../shared/components/ui/Badge'
import Button from '../../shared/components/ui/Button'
import Input from '../../shared/components/ui/Input'
import Textarea from '../../shared/components/ui/Textarea'
import Modal from '../../shared/components/ui/Modal'
import ConfirmDialog from '../../shared/components/ui/ConfirmDialog'
import Spinner from '../../shared/components/ui/Spinner'
import ErrorState from '../../shared/components/ui/ErrorState'
import { formatCurrency, formatDate } from '../../shared/utils/format'
import { downloadContractPdf } from '../../shared/utils/contractPdf'
import { payWithRazorpay } from '../../shared/utils/razorpay'
import { useNotify } from '../../shared/notifications/NotificationProvider'
import { ContractDisputeButtons, TerminationBanner } from '../../shared/components/contracts/ContractDisputeActions'

// Handles both "Add milestone" and "Edit milestone" — pass an existing milestone to
// switch into edit mode (pre-fills the form and calls editMilestone instead of createMilestone).
function MilestoneFormModal({ contractId, milestone, open, onClose }) {
  const isEdit = Boolean(milestone)
  const notify = useNotify()
  const [createMilestone, { isLoading: creating, error: createError }] = useCreateMilestoneMutation()
  const [editMilestone, { isLoading: editing, error: editError }] = useEditMilestoneMutation()
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  // Re-seed the form whenever the modal opens for a (possibly different) milestone,
  // without a setState-in-effect — derive during render, keyed on open + which milestone.
  const formKey = open ? (milestone?.milestoneId ?? 'new') : null
  const [loadedKey, setLoadedKey] = useState(null)
  if (open && loadedKey !== formKey) {
    setLoadedKey(formKey)
    setTitle(milestone?.title ?? '')
    setAmount(milestone ? String(milestone.amount) : '')
    setDueDate(milestone?.dueDate ? milestone.dueDate.slice(0, 10) : '')
  }

  const isLoading = isEdit ? editing : creating
  const error = isEdit ? editError : createError

  async function handleSubmit(e) {
    e.preventDefault()
    const result = isEdit
      ? await editMilestone({ milestoneId: milestone.milestoneId, title, amount, dueDate })
      : await createMilestone({ contractId, title, amount, dueDate })
    if (result.data) {
      notify.success(isEdit ? 'Milestone updated.' : 'Milestone added.')
      handleClose()
    } else {
      notify.error(result.error?.data ?? `Unable to ${isEdit ? 'save' : 'add'} this milestone. Please try again.`)
    }
  }

  function handleClose() {
    setLoadedKey(null)
    onClose()
  }

  return (
    <Modal open={open} title={isEdit ? 'Edit milestone' : 'Add milestone'} onClose={handleClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Title" id="milestone-title" value={title} onChange={(e) => setTitle(e.target.value)}
               placeholder="e.g. API integration" required />
        <Input label="Amount" id="milestone-amount" type="number" min="1" value={amount}
               onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 15000" required />
        <Input label="Due date" id="milestone-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        {error && <p className="text-xs text-red-600">{error.data ?? `Unable to ${isEdit ? 'save' : 'add'} this milestone. Please try again.`}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={handleClose}>Cancel</Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (isEdit ? 'Saving…' : 'Adding…') : (isEdit ? 'Save changes' : 'Add milestone')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default function ContractDetailsPage() {
  const { contractId } = useParams()
  const user = useSelector((s) => s.auth.currentUser)
  const notify = useNotify()
  const { data: contract, isLoading, isError } = useGetContractDetailsQuery(contractId)
  const [releasePayment, { isLoading: releasing }] = useReleaseMilestonePaymentMutation()
  const [deleteMilestone, { isLoading: deletingMilestone, error: deleteMilestoneError }] = useDeleteMilestoneMutation()
  const [rejectMilestone, { isLoading: rejecting, error: rejectError }] = useRejectMilestoneMutation()
  const [submitReview, { isLoading: submittingReview }] = useSubmitClientReviewMutation()
  const [startContract, { isLoading: starting }] = useStartContractMutation()
  const [completeContract, { isLoading: completing, error: completeError }] = useCompleteContractMutation()
  const [cancelContract, { isLoading: cancelling, error: cancelError }] = useCancelContractMutation()
  const [fundMilestone] = useFundMilestoneMutation()
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [milestoneModalOpen, setMilestoneModalOpen] = useState(false)
  const [editingMilestone, setEditingMilestone] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [rejectTarget, setRejectTarget] = useState(null)
  const [completeOpen, setCompleteOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)

  if (isLoading) return <Spinner label="Loading contract…" />
  if (isError || !contract) return <ErrorState message="Contract not found." />

  const alreadyReviewed = contract.reviews.some((r) => r.reviewerId === user.userId)
  const outstandingMilestones = contract.milestones.some((m) => m.status !== 'Completed')

  async function handleReviewSubmit(e) {
    e.preventDefault()
    const result = await submitReview({ contractId, reviewerId: user.userId, revieweeId: contract.freelancerId, rating: Number(rating), comment })
    if (result.data) {
      notify.success('Review submitted — thanks for the feedback!')
      setComment('')
    } else {
      notify.error(result.error?.data ?? 'Could not submit this review. Please try again.')
    }
  }

  async function handleComplete() {
    const result = await completeContract(contractId)
    if (result.data) {
      notify.success('Contract marked as completed.')
      setCompleteOpen(false)
    } else {
      notify.error(result.error?.data ?? 'Could not complete this contract. Please try again.')
    }
  }

  async function handleCancel(reason) {
    const result = await cancelContract({ contractId, reason })
    if (result.data) {
      notify.success('Contract cancelled.')
      setCancelOpen(false)
    } else {
      notify.error(result.error?.data ?? 'Could not cancel this contract. Please try again.')
    }
  }

  function openEditMilestone(milestone) {
    setEditingMilestone(milestone)
    setMilestoneModalOpen(true)
  }

  async function handleDeleteMilestone() {
    const result = await deleteMilestone(deleteTarget?.milestoneId)
    if (result.data) {
      notify.success('Milestone deleted.')
      setDeleteTarget(null)
    } else {
      notify.error(result.error?.data ?? 'Could not delete this milestone. Please try again.')
    }
  }

  async function handleRejectMilestone(reason) {
    const result = await rejectMilestone({ milestoneId: rejectTarget?.milestoneId, reason })
    if (result.data) {
      notify.success('Milestone sent back to the freelancer.')
      setRejectTarget(null)
    } else {
      notify.error(result.error?.data ?? 'Could not reject this milestone. Please try again.')
    }
  }

  // Client pays the milestone amount to the platform through Razorpay before the milestone starts; an admin dispatches it to the freelancer after approval.
  async function handleFundMilestone(m) {
    try {
      const razorpayPaymentId = await payWithRazorpay({
        amount: m.amount, description: `${m.title} — ${contract.job.title}`, name: user.name, email: user.email,
        notes: { milestoneId: m.milestoneId, contractId },
      })
      const result = await fundMilestone({ milestoneId: m.milestoneId, razorpayPaymentId })
      if (result.data) notify.success(`${m.title} paid to the platform. The freelancer can now start; funds are held safely until you approve the work.`)
      else notify.error(result.error?.data ?? 'Payment received but could not be recorded. Please contact support.')
    } catch (err) {
      notify.error(err.message)
    }
  }

  async function handleStartContract() {
    const result = await startContract(contractId)
    if (result.data) {
      notify.success('Contract started.')
      if (result.data.firstMilestone) await handleFundMilestone(result.data.firstMilestone)
    } else notify.error(result.error?.data ?? 'Could not start this contract. Please try again.')
  }

  async function handleReleasePayment(milestoneId) {
    const result = await releasePayment(milestoneId)
    if (result.data) {
      notify.success('Approved — the admin will dispatch the payment to the freelancer.')
      if (result.data.nextMilestone) await handleFundMilestone(result.data.nextMilestone)
    } else notify.error(result.error?.data ?? 'Could not release this payment. Please try again.')
  }

  return (
    <div>
      <PageHeader
        title={contract.job.title}
        description={
          contract.status === 'Pending Start'
            ? `Contract with ${contract.freelancerName} · awaiting start`
            : `Contract with ${contract.freelancerName} · started ${formatDate(contract.startDate)}`
        }
        actions={
          <div className="flex items-center gap-2">
            <Badge status={contract.status} />
            <Button variant="secondary" onClick={() => downloadContractPdf(contract)}>Download PDF</Button>
            {contract.status === 'Pending Start' && (
              <Button onClick={handleStartContract} disabled={starting}>
                {starting ? 'Starting…' : 'Start contract'}
              </Button>
            )}
            {contract.status === 'Active' && (
              <>
                <Button onClick={() => setCompleteOpen(true)}>Complete contract</Button>
                <Button variant="danger" onClick={() => setCancelOpen(true)}>Cancel contract</Button>
              </>
            )}
            <ContractDisputeButtons contract={contract} role="Client" userId={user.userId} />
          </div>
        }
      />

      <TerminationBanner contract={contract} role="Client" />

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

      {contract.status === 'Cancelled' && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <p className="text-sm text-red-700">
            This contract was cancelled{contract.endDate ? ` on ${formatDate(contract.endDate)}` : ''}.
            {contract.cancellationReason ? ` Reason: ${contract.cancellationReason}` : ''}
          </p>
        </Card>
      )}

      {contract.status === 'Pending Start' ? (
        <Card>
          <p className="text-sm text-slate-500">
            This contract hasn't started yet. Start it to unlock milestones and payments.
          </p>
        </Card>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Milestones & payments</h2>
          </div>
          <div className="space-y-3">
            {contract.milestones.length === 0 && (
              <Card>
                <p className="text-sm text-slate-500">No milestones yet. Add one to start tracking deliverables and payments for this contract.</p>
              </Card>
            )}
            {contract.milestones.map((m) => (
              <Card key={m.milestoneId} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">{m.title}</p>
                  {m.taskSpec && <p className="text-xs text-slate-600">{m.taskSpec}</p>}
                  <p className="text-xs text-slate-500">Due {formatDate(m.dueDate)} · {formatCurrency(m.amount)}</p>
                  {m.payment?.paymentStatus === 'Held' && <p className="mt-1 text-xs text-amber-600">Paid to platform via Razorpay — held until you approve the work</p>}
                  {m.payment?.paymentStatus === 'Awaiting Payout' && <p className="mt-1 text-xs text-sky-700">Approved — awaiting admin payout to the freelancer</p>}
                  {m.payment?.paymentStatus === 'Paid' && <p className="mt-1 text-xs text-emerald-600">Paid {formatDate(m.payment.paymentDate)}</p>}
                  {m.status === 'Pending' && m.rejectionReason && (
                    <p className="mt-1 text-xs text-red-600">You rejected this: {m.rejectionReason}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Badge status={m.status} />
                  {m.status === 'Pending' && (
                    <>
                      {m.funded === false
                        ? <Button onClick={() => handleFundMilestone(m)}>Pay {formatCurrency(m.amount)} to platform</Button>
                        : <span className="text-xs text-slate-400">In progress — waiting on freelancer</span>}
                      <Button variant="secondary" onClick={() => openEditMilestone(m)}>Edit</Button>
                      <Button variant="danger" onClick={() => setDeleteTarget(m)}>Delete</Button>
                    </>
                  )}
                  {m.status === 'Submitted' && (
                    <>
                      <Button variant="secondary" onClick={() => setRejectTarget(m)}>Reject</Button>
                      <Button onClick={() => handleReleasePayment(m.milestoneId)} disabled={releasing}>
                        {releasing ? 'Approving…' : 'Approve milestone'}
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <MilestoneFormModal
        contractId={contractId}
        milestone={editingMilestone}
        open={milestoneModalOpen}
        onClose={() => setMilestoneModalOpen(false)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete milestone"
        description={`Delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmLabel="Delete milestone"
        isLoading={deletingMilestone}
        error={deleteMilestoneError}
        onConfirm={handleDeleteMilestone}
        onClose={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(rejectTarget)}
        title="Reject milestone"
        description={`This sends "${rejectTarget?.title}" back to the freelancer as Pending so they can revise and resubmit it.`}
        confirmLabel="Reject milestone"
        variant="primary"
        collectReason
        reasonLabel="What needs to change? (optional)"
        isLoading={rejecting}
        error={rejectError}
        onConfirm={handleRejectMilestone}
        onClose={() => setRejectTarget(null)}
      />

      <ConfirmDialog
        open={completeOpen}
        title="Complete contract"
        description={
          outstandingMilestones
            ? 'This contract still has milestones that are not marked Completed. Completing it now will lock further milestone and payment activity. Continue?'
            : 'This will mark the contract as completed and make reviews available. This cannot be undone. Continue?'
        }
        confirmLabel="Complete contract"
        variant="primary"
        isLoading={completing}
        error={completeError}
        onConfirm={handleComplete}
        onClose={() => setCompleteOpen(false)}
      />

      <ConfirmDialog
        open={cancelOpen}
        title="Cancel contract"
        description="Cancelling this contract will stop further milestone and payment activity. This cannot be undone."
        confirmLabel="Cancel contract"
        collectReason
        reasonLabel="Cancellation reason (optional)"
        isLoading={cancelling}
        error={cancelError}
        onConfirm={handleCancel}
        onClose={() => setCancelOpen(false)}
      />

      {contract.status === 'Completed' && (
        <div className="mt-8">
          <h2 className="mb-3 text-base font-semibold text-slate-900">Review</h2>
          {alreadyReviewed ? (
            <Card>
              <p className="text-sm text-slate-600">You've already submitted a review for this contract. Thanks for the feedback!</p>
            </Card>
          ) : (
            <Card className="max-w-lg">
              <form onSubmit={handleReviewSubmit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Rating</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button type="button" key={n} onClick={() => setRating(n)}
                              className={`text-2xl ${n <= rating ? 'text-amber-500' : 'text-slate-300'}`}>★</button>
                    ))}
                  </div>
                </div>
                <Textarea label="Feedback" rows={3} value={comment} onChange={(e) => setComment(e.target.value)}
                          placeholder={`How was your experience working with ${contract.freelancerName}?`} />
                <Button type="submit" disabled={submittingReview}>{submittingReview ? 'Submitting…' : 'Submit review'}</Button>
              </form>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
