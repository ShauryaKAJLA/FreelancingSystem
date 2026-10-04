import { useState } from 'react'
import { useSelector } from 'react-redux'
import { useGetFreelancerProfileQuery, useEditFreelancerProfileMutation, useUpdateFreelancerExtrasMutation } from '../freelancerApi'
import PageHeader from '../../shared/components/layout/PageHeader'
import Card from '../../shared/components/ui/Card'
import Button from '../../shared/components/ui/Button'
import Input from '../../shared/components/ui/Input'
import Textarea from '../../shared/components/ui/Textarea'
import Spinner from '../../shared/components/ui/Spinner'
import ErrorState from '../../shared/components/ui/ErrorState'
import { useSkills } from '../../shared/api/skillsApi'
import { formatCurrency } from '../../shared/utils/format'
import UserReviewsSection from '../../shared/components/reviews/UserReviewsSection'
import { useNotify } from '../../shared/notifications/NotificationProvider'

export default function ProfilePage() {
  const SKILLS = useSkills()
  const user = useSelector((s) => s.auth.currentUser)
  const notify = useNotify()
  const { data: profile, isLoading, isError } = useGetFreelancerProfileQuery(user.userId)
  const [editProfile, { isLoading: saving, error: saveError }] = useEditFreelancerProfileMutation()

  const [updateExtras, { isLoading: savingExtras }] = useUpdateFreelancerExtrasMutation()
  const [acctForm, setAcctForm] = useState(null)      // null = not editing
  const [projForm, setProjForm] = useState(null)      // { index (-1 = new), title, description, year, link }
  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState(null)

  function startEditing() {
    // Optional chaining: React Compiler reads these deps on every render, including
    // the loading render where `profile` is still undefined.
    setForm({
      bio: profile?.bio ?? '',
      hourlyRate: String(profile?.hourlyRate ?? ''),
      skillIds: (profile?.skills ?? []).map((s) => s.skillId),
    })
    setIsEditing(true)
  }

  function toggleSkill(skillId) {
    setForm((f) => ({
      ...f,
      skillIds: f.skillIds.includes(skillId) ? f.skillIds.filter((id) => id !== skillId) : [...f.skillIds, skillId],
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const result = await editProfile({
      freelancerId: user.userId, bio: form?.bio, hourlyRate: form?.hourlyRate, skillIds: form?.skillIds,
    })
    if (result.data) {
      notify.success('Profile updated.')
      setIsEditing(false)
    } else {
      notify.error(result.error?.data ?? 'Could not save your profile. Please try again.')
    }
  }

  async function saveAccount(e) {
    e.preventDefault()
    const result = await updateExtras({ freelancerId: user.userId, paymentAccount: acctForm })
    if (result.data) { notify.success('Payment account saved.'); setAcctForm(null) }
    else notify.error(result.error?.data ?? 'Could not save the payment account.')
  }

  async function saveProject(e) {
    e.preventDefault()
    if (!projForm.title.trim()) { notify.error('Enter a project title.'); return }
    const { index, ...proj } = projForm
    const list = [...(profile?.pastProjects ?? [])]
    if (index >= 0) list[index] = proj; else list.push(proj)
    const result = await updateExtras({ freelancerId: user.userId, pastProjects: list })
    if (result.data) { notify.success('Past projects updated.'); setProjForm(null) }
    else notify.error(result.error?.data ?? 'Could not save this project.')
  }

  async function removeProject(i) {
    const list = (profile?.pastProjects ?? []).filter((_, j) => j !== i)
    const result = await updateExtras({ freelancerId: user.userId, pastProjects: list })
    if (result.data) notify.success('Project removed.')
    else notify.error(result.error?.data ?? 'Could not remove this project.')
  }

  if (isLoading) return <Spinner label="Loading profile…" />
  if (isError || !profile) return <ErrorState />

  return (
    <div>
      <PageHeader
        title="My profile"
        description="How clients see your professional profile."
        actions={!isEditing && <Button variant="secondary" onClick={startEditing}>Edit profile</Button>}
      />

      {isEditing ? (
        <Card className="mb-6 max-w-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Hourly rate (₹)" id="hourlyRate" type="number" min="0" value={form.hourlyRate}
                   onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })} />
            <Textarea label="Bio" id="bio" rows={4} value={form.bio}
                      onChange={(e) => setForm({ ...form, bio: e.target.value })}
                      placeholder="Tell clients about your experience and specialties…" />
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">Skills</p>
              <div className="flex flex-wrap gap-2">
                {SKILLS.map((s) => (
                  <button type="button" key={s.skillId} onClick={() => toggleSkill(s.skillId)}
                          className={`rounded-full border px-3 py-1.5 text-sm ${
                            form.skillIds.includes(s.skillId)
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                              : 'border-slate-300 text-slate-600 hover:border-slate-400'
                          }`}>
                    {s.skillName}
                  </button>
                ))}
              </div>
            </div>
            {saveError && <p className="text-sm text-red-600">{saveError.data ?? 'Something went wrong. Please try again.'}</p>}
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
              <Button type="button" variant="secondary" onClick={() => setIsEditing(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      ) : (
        <Card className="mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{profile.fullName}</h2>
              <p className="text-sm text-slate-500">{profile.email}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-amber-500">★ {profile.rating}</p>
              <p className="text-xs text-slate-400">{formatCurrency(profile.hourlyRate)}/hr</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-600">{profile.bio}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {profile.skills.map((s) => (
              <span key={s.skillId} className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
                {s.skillName} · {s.proficiencyLevel}
              </span>
            ))}
          </div>
        </Card>
      )}

      <Card className="mb-6 max-w-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Payment account</h2>
          {!acctForm && (
            <Button variant="secondary" onClick={() => setAcctForm({ holderName: '', bankName: '', accountNumber: '', ifsc: '', upiId: '', ...(profile.paymentAccount ?? {}) })}>
              {profile.paymentAccount ? 'Edit' : 'Add account'}
            </Button>
          )}
        </div>
        {acctForm ? (
          <form onSubmit={saveAccount} className="space-y-3">
            <Input label="Account holder name" id="holderName" value={acctForm.holderName} onChange={(e) => setAcctForm({ ...acctForm, holderName: e.target.value })} />
            <Input label="Bank name" id="bankName" value={acctForm.bankName} onChange={(e) => setAcctForm({ ...acctForm, bankName: e.target.value })} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input label="Account number" id="accountNumber" value={acctForm.accountNumber} onChange={(e) => setAcctForm({ ...acctForm, accountNumber: e.target.value })} />
              <Input label="IFSC" id="ifsc" value={acctForm.ifsc} onChange={(e) => setAcctForm({ ...acctForm, ifsc: e.target.value })} />
            </div>
            <Input label="UPI ID (optional)" id="upiId" value={acctForm.upiId} onChange={(e) => setAcctForm({ ...acctForm, upiId: e.target.value })} placeholder="name@bank" />
            <div className="flex gap-2">
              <Button type="submit" disabled={savingExtras}>{savingExtras ? 'Saving…' : 'Save account'}</Button>
              <Button type="button" variant="secondary" onClick={() => setAcctForm(null)}>Cancel</Button>
            </div>
          </form>
        ) : profile.paymentAccount ? (
          <div className="space-y-1 text-sm text-slate-600">
            {profile.paymentAccount.holderName && <p>{profile.paymentAccount.holderName}{profile.paymentAccount.bankName ? ` · ${profile.paymentAccount.bankName}` : ''}</p>}
            {profile.paymentAccount.accountNumber && <p>A/c ****{String(profile.paymentAccount.accountNumber).slice(-4)} · IFSC {profile.paymentAccount.ifsc}</p>}
            {profile.paymentAccount.upiId && <p>UPI: {profile.paymentAccount.upiId}</p>}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Add the account where milestone payments should be sent.</p>
        )}
      </Card>

      <div className="mb-6 max-w-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Past projects</h2>
          {!projForm && <Button variant="secondary" onClick={() => setProjForm({ index: -1, title: '', description: '', year: '', link: '' })}>Add project</Button>}
        </div>
        {projForm && (
          <Card className="mb-3">
            <form onSubmit={saveProject} className="space-y-3">
              <Input label="Project title" id="projTitle" value={projForm.title} onChange={(e) => setProjForm({ ...projForm, title: e.target.value })} />
              <Textarea label="Description" id="projDesc" rows={3} value={projForm.description} onChange={(e) => setProjForm({ ...projForm, description: e.target.value })} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input label="Year" id="projYear" value={projForm.year} onChange={(e) => setProjForm({ ...projForm, year: e.target.value })} />
                <Input label="Link (optional)" id="projLink" value={projForm.link} onChange={(e) => setProjForm({ ...projForm, link: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={savingExtras}>{savingExtras ? 'Saving…' : 'Save project'}</Button>
                <Button type="button" variant="secondary" onClick={() => setProjForm(null)}>Cancel</Button>
              </div>
            </form>
          </Card>
        )}
        {(profile.pastProjects ?? []).length === 0 && !projForm && <p className="text-sm text-slate-500">No past projects added yet.</p>}
        <div className="space-y-3">
          {(profile.pastProjects ?? []).map((pr, i) => (
            <Card key={i}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">{pr.title}{pr.year ? ` · ${pr.year}` : ''}</p>
                  {pr.description && <p className="mt-1 text-sm text-slate-600">{pr.description}</p>}
                  {pr.link && <a href={pr.link} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-indigo-600 hover:underline">{pr.link}</a>}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="secondary" onClick={() => setProjForm({ index: i, link: '', year: '', description: '', ...pr })}>Edit</Button>
                  <Button variant="danger" onClick={() => removeProject(i)}>Delete</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <UserReviewsSection userId={profile.freelancerId} emptyDescription="Reviews appear here after you complete your first contract." />
    </div>
  )
}
