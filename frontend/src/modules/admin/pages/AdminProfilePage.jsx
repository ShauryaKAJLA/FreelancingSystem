import { useState } from 'react'
import { useSelector } from 'react-redux'
import { useGetAdminProfileQuery, useEditAdminProfileMutation } from '../adminApi'
import PageHeader from '../../shared/components/layout/PageHeader'
import Card from '../../shared/components/ui/Card'
import Button from '../../shared/components/ui/Button'
import Input from '../../shared/components/ui/Input'
import Spinner from '../../shared/components/ui/Spinner'
import ErrorState from '../../shared/components/ui/ErrorState'
import { formatDate } from '../../shared/utils/format'
import { useNotify } from '../../shared/notifications/NotificationProvider'

export default function AdminProfilePage() {
  const user = useSelector((s) => s.auth.currentUser)
  const notify = useNotify()
  const { data: profile, isLoading, isError } = useGetAdminProfileQuery(user.userId)
  const [editProfile, { isLoading: saving, error: saveError }] = useEditAdminProfileMutation()

  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState(null)

  function startEditing() {
    setForm({ name: profile?.name ?? '', email: profile?.email ?? '' })
    setIsEditing(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const result = await editProfile({ adminId: user.userId, ...form })
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
        description="Your administrator account details."
        actions={!isEditing && <Button variant="secondary" onClick={startEditing}>Edit profile</Button>}
      />

      {isEditing ? (
        <Card className="max-w-lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Name" id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="Email" id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
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
              <span className="text-slate-500">Role</span>
              <span className="font-medium text-slate-800">{profile.role}</span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-slate-500">Admin since</span>
              <span className="font-medium text-slate-800">{formatDate(profile.createdAt)}</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
