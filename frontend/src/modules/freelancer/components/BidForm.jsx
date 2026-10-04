import { useState } from 'react'
import Card from '../../shared/components/ui/Card'
import Input from '../../shared/components/ui/Input'
import Textarea from '../../shared/components/ui/Textarea'
import Button from '../../shared/components/ui/Button'

export default function BidForm({ onSubmit, isLoading, budget, initialValues, title = 'Submit a bid', submitLabel = 'Submit bid', submittingLabel = 'Submitting…' }) {
  const [amount, setAmount] = useState(initialValues?.bidAmount ? String(initialValues.bidAmount) : '')
  const [proposal, setProposal] = useState(initialValues?.proposal ?? '')
  const [errors, setErrors] = useState({})

  function validate() {
    const e = {}
    if (!amount || Number(amount) <= 0) e.amount = 'Enter a valid bid amount.'
    if (!proposal.trim() || proposal.trim().length < 20) e.proposal = 'Proposal should be at least 20 characters.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    onSubmit({ bidAmount: Number(amount), proposal })
  }

  return (
    <Card className="max-w-lg">
      <h2 className="mb-4 text-base font-semibold text-slate-900">{title}</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label={`Your quote (₹) — client budget ${budget ? `₹${budget.toLocaleString('en-IN')}` : ''}`}
               id="amount" type="number" min="0" value={amount} error={errors.amount}
               onChange={(e) => setAmount(e.target.value)} />
        <Textarea label="Proposal" id="proposal" rows={5} value={proposal} error={errors.proposal}
                  onChange={(e) => setProposal(e.target.value)}
                  placeholder="Explain your approach, relevant experience, and timeline…" />
        <Button type="submit" disabled={isLoading}>{isLoading ? submittingLabel : submitLabel}</Button>
      </form>
    </Card>
  )
}
