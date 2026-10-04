import { useState } from 'react'
import {
  useRequestContractTerminationMutation, useRespondToTerminationRequestMutation, useRaiseIssueMutation,
} from '../../../client/clientApi'
import Card from '../ui/Card'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import Textarea from '../ui/Textarea'
import { useNotify } from '../../notifications/NotificationProvider'

// Renders (1) the mutual-termination banner/buttons and (2) the "Raise an issue" button.
// Termination needs BOTH parties: one side requests, the other must approve. Neither side
// can end the contract alone. The mutations live in clientApi but operate on the shared
// contracts array, so they work identically for either role.
export function ContractDisputeButtons({ contract, role, userId }) {
  const notify = useNotify()
  const [requestTermination, { isLoading: requesting }] = useRequestContractTerminationMutation()
  const [respond, { isLoading: responding }] = useRespondToTerminationRequestMutation()
  const [raiseIssue, { isLoading: raising }] = useRaiseIssueMutation()
  const [terminateOpen, setTerminateOpen] = useState(false)
  const [issueOpen, setIssueOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [subject, setSubject] = useState('')

  const otherParty = role === 'Client' ? 'freelancer' : 'client'
  const isActive = contract.status === 'Active'
  const pendingFrom = contract.terminationRequestedBy // 'Client' | 'Freelancer' | null
  const iRequested = pendingFrom === role

  async function handleRequest() {
    const result = await requestTermination({ contractId: contract.contractId, requestedByRole: role, reason: reason.trim() })
    if (result.data) {
      notify.success(`Termination requested. The ${otherParty} must approve before the contract ends.`)
      setTerminateOpen(false)
      setReason('')
    } else {
      notify.error(result.error?.data ?? 'Could not send the termination request. Please try again.')
    }
  }

  async function handleRespond(approve) {
    const result = await respond({ contractId: contract.contractId, approve })
    if (result.data) notify.success(approve ? 'Contract terminated by mutual agreement.' : 'Termination request declined.')
    else notify.error(result.error?.data ?? 'Could not respond to the request. Please try again.')
  }

  async function handleRaiseIssue() {
    const result = await raiseIssue({ contractId: contract.contractId, raisedBy: userId, subject })
    if (result.data) {
      notify.success('Your issue was sent to the admin team.')
      setIssueOpen(false)
      setSubject('')
    } else {
      notify.error(result.error?.data ?? 'Could not submit this issue. Please try again.')
    }
  }

  return (
    <>
      {isActive && !pendingFrom && (
        <Button variant="secondary" onClick={() => setTerminateOpen(true)}>Request termination</Button>
      )}
      {isActive && iRequested && (
        <Button variant="secondary" onClick={() => handleRespond(false)} disabled={responding}>Withdraw termination request</Button>
      )}
      <Button variant="secondary" onClick={() => setIssueOpen(true)}>Raise issue</Button>

      <Modal open={terminateOpen} onClose={() => setTerminateOpen(false)} title="Request contract termination">
        <p className="mb-3 text-sm text-slate-600">
          Termination must be agreed by both sides. The {otherParty} will be asked to approve; the contract stays active until they do.
        </p>
        <Textarea label="Reason (optional)" id="terminate-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setTerminateOpen(false)}>Close</Button>
          <Button variant="danger" onClick={handleRequest} disabled={requesting}>{requesting ? 'Sending…' : 'Send request'}</Button>
        </div>
      </Modal>

      <Modal open={issueOpen} onClose={() => setIssueOpen(false)} title="Raise an issue to admin">
        <p className="mb-3 text-sm text-slate-600">Describe the conflict or problem. An administrator will review it.</p>
        <Textarea label="Issue" id="issue-subject" rows={4} value={subject} onChange={(e) => setSubject(e.target.value)} />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setIssueOpen(false)}>Close</Button>
          <Button onClick={handleRaiseIssue} disabled={raising || !subject.trim()}>{raising ? 'Submitting…' : 'Submit issue'}</Button>
        </div>
      </Modal>
    </>
  )
}

export function TerminationBanner({ contract, role }) {
  const notify = useNotify()
  const [respond, { isLoading }] = useRespondToTerminationRequestMutation()
  const pendingFrom = contract.terminationRequestedBy
  if (contract.status === 'Terminated') {
    return (
      <Card className="mb-6 border-red-200 bg-red-50">
        <p className="text-sm text-red-700">This contract was terminated by mutual agreement.</p>
      </Card>
    )
  }
  if (contract.status !== 'Active' || !pendingFrom) return null

  async function handle(approve) {
    const result = await respond({ contractId: contract.contractId, approve })
    if (result.data) notify.success(approve ? 'Contract terminated by mutual agreement.' : 'Termination request declined.')
    else notify.error(result.error?.data ?? 'Could not respond to the request. Please try again.')
  }

  if (pendingFrom === role) {
    return (
      <Card className="mb-6 border-amber-200 bg-amber-50">
        <p className="text-sm text-amber-800">You requested termination. Waiting for the other party to approve.</p>
      </Card>
    )
  }
  return (
    <Card className="mb-6 border-amber-200 bg-amber-50">
      <p className="text-sm text-amber-800">
        The {pendingFrom.toLowerCase()} has requested to terminate this contract.
        {contract.terminationReason ? ` Reason: ${contract.terminationReason}` : ''}
      </p>
      <div className="mt-3 flex gap-2">
        <Button variant="danger" onClick={() => handle(true)} disabled={isLoading}>Approve termination</Button>
        <Button variant="secondary" onClick={() => handle(false)} disabled={isLoading}>Decline</Button>
      </div>
    </Card>
  )
}
