import { useState } from 'react'
import Modal from './Modal'
import Button from './Button'
import Textarea from './Textarea'

/**
 * Confirmation dialog for destructive or important actions.
 * Optionally collects a free-text reason (e.g. cancellation reason).
 */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  collectReason = false,
  reasonLabel = 'Reason (optional)',
  isLoading = false,
  error,
  onConfirm,
  onClose,
}) {
  const [reason, setReason] = useState('')

  function handleConfirm() {
    onConfirm(collectReason ? reason : undefined)
  }

  function handleClose() {
    setReason('')
    onClose()
  }

  return (
    <Modal
      open={open}
      title={title}
      onClose={handleClose}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={isLoading}>{cancelLabel}</Button>
          <Button variant={variant} onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? 'Working…' : confirmLabel}
          </Button>
        </>
      }
    >
      {description && <p className="text-sm text-slate-600">{description}</p>}
      {collectReason && (
        <div className="mt-3">
          <Textarea label={reasonLabel} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      )}
      {error && <p className="mt-3 text-xs text-red-600">{error.data ?? 'Something went wrong. Please try again.'}</p>}
    </Modal>
  )
}
