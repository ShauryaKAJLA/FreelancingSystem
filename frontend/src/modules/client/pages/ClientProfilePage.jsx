import { useState } from 'react'
import { useSelector } from 'react-redux'
import { useGetClientProfileQuery, useEditClientProfileMutation } from '../clientApi'
import PageHeader from '../../shared/components/layout/PageHeader'
import Card from '../../shared/components/ui/Card'
import Button from '../../shared/components/ui/Button'
import Input from '../../shared/components/ui/Input'
import Spinner from '../../shared/components/ui/Spinner'
import ErrorState from '../../shared/components/ui/ErrorState'
import { formatCurrency, formatDate } from '../../shared/utils/format'
import { useNotify } from '../../shared/notifications/NotificationProvider'

export default function ClientProfilePage() {
  const user = useSelector((s) => s.auth.currentUser)
  const notify = useNotify()
  const { data: profile, isLoading, isError } = useGetClientProfileQuery(user.userId)
  const [editProfile, { isLoading: saving, error: saveError }] = useEditClientProfileMutation()

  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState(null)

  function startEditing() {
    setForm({ name: profile?.name ?? '', companyName: profile?.companyName ?? '', website: profile?.website ?? '' })
    setIsEditing(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const result = await editProfile({ clientId: user.userId, ...form })
    if (result.data) {
      notify.success('Profile updated.')
      setIsEditing(false)
    } else {
      notify.error(result.error?.data ?? 'Could not save your profile. Please try again.')
    }
  }

  if (isLoading) return <Spinner label="Loading profile…" />
  if (isError || !profile) return <ErrorState />

  return (
    <div>
      <PageHeader
        title="My profile"
        description="Your account and company details."
        actions={!isEditing && <Button variant="secondary" onClick={startEditing}>Edit profile</Button>}
      />

      {isEditing ? (
        <Card className="max-w-lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Your name" id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="Company name" id="companyName" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
            <Input label="Website" id="website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="e.g. technova.com" />
            {saveError && <p className="text-sm text-red-600">{saveError.data ?? 'Something went wrong. Please try again.'}</p>}
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
              <Button type="button" variant="secondary" onClick={() => setIsEditing(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      ) : (
        <Card className="max-w-lg">
          <h2 className="text-lg font-bold text-slate-900">{profile.name}</h2>
          <p className="text-sm text-slate-500">{profile.email}</p>
          <div className="mt-4 divide-y divide-slate-100 text-sm">
            <div className="flex items-center justify-between py-2.5">
              <span className="text-slate-500">Company</span>
              <span className="font-medium text-slate-800">{profile.companyName || '—'}</span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-slate-500">Website</span>
              <span className="font-medium text-slate-800">{profile.website || '—'}</span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-slate-500">Total spend</span>
              <span className="font-medium text-slate-800">{formatCurrency(profile.totalSpend ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-slate-500">Member since</span>
              <span className="font-medium text-slate-800">{formatDate(profile.createdAt)}</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
