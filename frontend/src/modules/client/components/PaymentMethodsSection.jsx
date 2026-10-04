import { useState } from 'react'
import {
  useGetPaymentMethodsQuery, useAddPaymentMethodMutation,
  useRemovePaymentMethodMutation, useSetDefaultPaymentMethodMutation,
} from '../clientApi'
import Card from '../../shared/components/ui/Card'
import Button from '../../shared/components/ui/Button'
import Input from '../../shared/components/ui/Input'
import Modal from '../../shared/components/ui/Modal'
import Spinner from '../../shared/components/ui/Spinner'
import { useNotify } from '../../shared/notifications/NotificationProvider'

// The client's medium for paying freelancers. Only a masked last-4 is ever shown or stored.
export default function PaymentMethodsSection({ clientId }) {
  const notify = useNotify()
  const { data: methods, isLoading } = useGetPaymentMethodsQuery(clientId)
  const [addMethod, { isLoading: adding }] = useAddPaymentMethodMutation()
  const [removeMethod, { isLoading: removing }] = useRemovePaymentMethodMutation()
  const [setDefault] = useSetDefaultPaymentMethodMutation()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ holderName: '', cardNumber: '', expiry: '' })

  async function handleAdd(e) {
    e.preventDefault()
    const result = await addMethod({ clientId, ...form })
    if (result.data) {
      notify.success('Payment method added.')
      setOpen(false)
      setForm({ holderName: '', cardNumber: '', expiry: '' })
    } else {
      notify.error(result.error?.data ?? 'Could not add this payment method. Please try again.')
    }
  }

  async function handleRemove(id) {
    const result = await removeMethod(id)
    if (result.data) notify.success('Payment method removed.')
    else notify.error(result.error?.data ?? 'Could not remove this payment method.')
  }

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Payment methods</h2>
          <p className="text-sm text-slate-500">Saved cards for reference. Milestones are paid to the platform through Razorpay before they start.</p>
        </div>
        <Button variant="secondary" onClick={() => setOpen(true)}>+ Add payment method</Button>
      </div>

      {isLoading && <Spinner label="Loading payment methods…" />}
      {methods && methods.length === 0 && (
        <Card><p className="text-sm text-slate-500">No payment method yet. Add one so you can pay freelancers.</p></Card>
      )}
      <div className="space-y-2">
        {methods?.map((m) => (
          <Card key={m.paymentMethodId} className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">
                {m.brand} •••• {m.last4}
                {m.isDefault && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Default</span>}
              </p>
              <p className="text-xs text-slate-500">{m.holderName} · expires {m.expiry}</p>
            </div>
            <div className="flex gap-2">
              {!m.isDefault && <Button variant="secondary" onClick={() => setDefault(m.paymentMethodId)}>Make default</Button>}
              <Button variant="danger" disabled={removing} onClick={() => handleRemove(m.paymentMethodId)}>Remove</Button>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Add payment method">
        <form onSubmit={handleAdd} className="space-y-3">
          <Input label="Cardholder name" id="holderName" value={form.holderName} onChange={(e) => setForm({ ...form, holderName: e.target.value })} />
          <Input label="Card number" id="cardNumber" inputMode="numeric" value={form.cardNumber} onChange={(e) => setForm({ ...form, cardNumber: e.target.value })} placeholder="1234 5678 9012 3456" />
          <Input label="Expiry (MM/YY)" id="expiry" value={form.expiry} onChange={(e) => setForm({ ...form, expiry: e.target.value })} placeholder="09/28" />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={adding}>{adding ? 'Saving…' : 'Save method'}</Button>
          </div>
        </form>
      </Modal>
    </section>
  )
}
