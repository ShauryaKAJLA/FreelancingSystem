import { useState } from 'react'
import { useSelector } from 'react-redux'
import { Link, useSearchParams } from 'react-router'
import { useGetMyBidsQuery, useWithdrawBidMutation } from '../freelancerApi'
import { useRequestContractTerminationMutation } from '../../client/clientApi'
import PageHeader from '../../shared/components/layout/PageHeader'
import Select from '../../shared/components/ui/Select'
import Modal from '../../shared/components/ui/Modal'
import Textarea from '../../shared/components/ui/Textarea'
import Pagination from '../../shared/components/ui/Pagination'
import Table from '../../shared/components/ui/Table'
import Badge from '../../shared/components/ui/Badge'
import Spinner from '../../shared/components/ui/Spinner'
import ErrorState from '../../shared/components/ui/ErrorState'
import EmptyState from '../../shared/components/ui/EmptyState'
import Button from '../../shared/components/ui/Button'
import ConfirmDialog from '../../shared/components/ui/ConfirmDialog'
import { formatCurrency, formatDate } from '../../shared/utils/format'
import { useNotify } from '../../shared/notifications/NotificationProvider'

const PAGE_SIZE = 10

export default function MyBidsPage() {
  const user = useSelector((s) => s.auth.currentUser)
  const notify = useNotify()
  const [withdrawBid, { isLoading: withdrawing, error: withdrawError }] = useWithdrawBidMutation()
  const [withdrawTarget, setWithdrawTarget] = useState(null)
  const [requestTermination, { isLoading: requesting }] = useRequestContractTerminationMutation()
  const [terminateTarget, setTerminateTarget] = useState(null)
  const [terminateReason, setTerminateReason] = useState('')
  // ?status=Pending etc. (set by the overview card, editable via the Status filter)
  const [searchParams, setSearchParams] = useSearchParams()
  const statusFilter = searchParams.get('status') ?? ''
  // Filtering and paging are server-side. The page is remembered with the status it belongs to, so changing the status shows page 1.
  const [pageState, setPageState] = useState({ status: statusFilter, page: 1 })
  const page = pageState.status === statusFilter ? pageState.page : 1
  const { data, isLoading, isFetching, isError } = useGetMyBidsQuery(
    { userId: user?.userId, page, limit: PAGE_SIZE, status: statusFilter }, { skip: !user })
  const bids = data?.rows
  const rows = Array.isArray(bids) ? bids.filter(Boolean) : []

  async function handleRequestTermination() {
    const contractId = terminateTarget?.contractId
    if (!contractId) {
      notify.error('No active contract found for this bid.')
      setTerminateTarget(null)
      return
    }
    const result = await requestTermination({ contractId, requestedByRole: 'Freelancer', reason: terminateReason.trim() })
    if (result.data) {
      notify.success('Termination requested. The client must approve before the contract ends.')
      setTerminateTarget(null)
      setTerminateReason('')
    } else {
      notify.error(result.error?.data ?? 'Could not send the termination request. Please try again.')
    }
  }

  async function handleWithdraw() {
    const result = await withdrawBid(withdrawTarget)
    if (result.data) {
      notify.success('Bid withdrawn.')
      setWithdrawTarget(null)
    } else {
      notify.error(result.error?.data ?? 'Could not withdraw this bid. Please try again.')
    }
  }

  return (
    <div>
      <PageHeader title="My bids" description="Every proposal you've submitted, and its current status."
                  actions={
                    <Select value={statusFilter} onChange={(e) => setSearchParams(e.target.value ? { status: e.target.value } : {})} className="w-40">
                      <option value="">Status</option>
                      <option value="Pending">Pending</option>
                      <option value="Updated">Updated</option>
                      <option value="Accepted">Accepted</option>
                      <option value="Rejected">Rejected</option>
                      <option value="Withdrawn">Withdrawn</option>
                    </Select>
                  } />
      {isLoading && <Spinner />}
      {isError && <ErrorState />}
      {bids && (
        <Table
          rowKey="bidId"
          rows={rows}
          emptyState={<EmptyState title="No bids yet" description="Browse open jobs to submit your first proposal."
                                   action={<Link to="/freelancer/jobs"><Button>Browse jobs</Button></Link>} />}
          columns={[
            { key: 'jobTitle', header: 'Job', render: (r) => <Link to={`/freelancer/jobs/${r.jobId}`} className="font-medium text-indigo-600 hover:underline">{r.jobTitle}</Link> },
            { key: 'bidAmount', header: 'My bid', render: (r) => formatCurrency(r.bidAmount) },
            { key: 'jobBudget', header: 'Client budget', render: (r) => formatCurrency(r.jobBudget) },
            { key: 'bidDate', header: 'Submitted', render: (r) => formatDate(r.bidDate) },
            { key: 'status', header: 'Status', render: (r) => <Badge status={r.status} /> },
            {
              key: 'actions',
              header: '',
              render: (r) => {
                if (r.status === 'Pending' || r.status === 'Updated') {
                  return <Button variant="danger" onClick={() => setWithdrawTarget(r.bidId)}>Withdraw</Button>
                }
                if (r.status === 'Accepted') {
                  const alreadyRequested = Boolean(r.terminationRequestedBy)
                  const canRequest = r.contractStatus === 'Active' && !alreadyRequested
                  return (
                    <Button
                      variant="secondary"
                      disabled={!canRequest}
                      title={canRequest ? '' : alreadyRequested ? 'Termination already requested' : 'Only an active contract can be terminated'}
                      onClick={() => setTerminateTarget(r)}
                    >
                      {alreadyRequested ? 'Termination requested' : 'Request for termination'}
                    </Button>
                  )
                }
                return null
              },
            },
          ]}
        />
      )}
      {data && <Pagination meta={data.meta} onPageChange={(p) => setPageState({ status: statusFilter, page: p })} isFetching={isFetching} />}

      <Modal open={!!terminateTarget} onClose={() => setTerminateTarget(null)} title="Request for termination"
             footer={
               <>
                 <Button variant="secondary" onClick={() => setTerminateTarget(null)}>Close</Button>
                 <Button variant="danger" onClick={handleRequestTermination} disabled={requesting}>{requesting ? 'Sending…' : 'Send request'}</Button>
               </>
             }>
        <p className="mb-3 text-sm text-slate-600">
          Termination must be agreed by both sides. The client will be asked to approve; the contract stays active until they do.
        </p>
        <Textarea label="Reason (optional)" id="bid-terminate-reason" rows={3} value={terminateReason} onChange={(e) => setTerminateReason(e.target.value)} />
      </Modal>

      <ConfirmDialog
        open={!!withdrawTarget}
        title="Withdraw Bids"
        description="Withdrawing removes this bid from consideration. You can submit a new one later if the job is still open. This cannot be undone."
        confirmLabel="Withdraw Bids"
        isLoading={withdrawing}
        error={withdrawError}
        onConfirm={handleWithdraw}
        onClose={() => setWithdrawTarget(null)}
      />
    </div>
  )
}
