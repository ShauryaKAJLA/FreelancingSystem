import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import { useGetJobDetailsQuery, useEditJobMutation } from '../clientApi'
import PageHeader from '../../shared/components/layout/PageHeader'
import Card from '../../shared/components/ui/Card'
import Input from '../../shared/components/ui/Input'
import Textarea from '../../shared/components/ui/Textarea'
import Select from '../../shared/components/ui/Select'
import Button from '../../shared/components/ui/Button'
import Spinner from '../../shared/components/ui/Spinner'
import ErrorState from '../../shared/components/ui/ErrorState'
import { useSkills } from '../../shared/api/skillsApi'
import { JOB_CATEGORIES, EXPERIENCE_LEVELS, EDITABLE_JOB_STATUSES } from '../../shared/constants/jobs'
import { useNotify } from '../../shared/notifications/NotificationProvider'

export default function EditJobPage() {
  const SKILLS = useSkills()
  const { jobId } = useParams()
  const navigate = useNavigate()
  const notify = useNotify()
  const { data: job, isLoading, isError } = useGetJobDetailsQuery(jobId)
  const [editJob, { isLoading: saving, error: saveError }] = useEditJobMutation()

  const [form, setForm] = useState(null)
  const [loadedJobId, setLoadedJobId] = useState(null)
  const [errors, setErrors] = useState({})

  // Derive form state from the loaded job the first time it becomes available
  // (or if navigating between different job ids), without a setState-in-effect.
  if (job && loadedJobId !== jobId) {
    setLoadedJobId(jobId)
    setForm({
      title: job.title,
      description: job.description,
      budget: String(job.budget),
      requiredSkillIds: job.requiredSkillIds ?? [],
      category: job.category ?? JOB_CATEGORIES[0],
      experienceLevel: job.experienceLevel ?? EXPERIENCE_LEVELS[0],
    })
  }

  function toggleSkill(skillId) {
    setForm((f) => ({
      ...f,
      requiredSkillIds: f.requiredSkillIds.includes(skillId)
        ? f.requiredSkillIds.filter((id) => id !== skillId)
        : [...f.requiredSkillIds, skillId],
    }))
  }

  function validate() {
    const e = {}
    if (!form?.title?.trim()) e.title = 'Job title is required.'
    if (!form?.description?.trim()) e.description = 'Description is required.'
    if (!form?.budget || Number(form.budget) <= 0) e.budget = 'Enter a valid budget amount.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    const result = await editJob({
      jobId,
      title: form?.title,
      description: form?.description,
      budget: Number(form?.budget),
      requiredSkillIds: form?.requiredSkillIds,
      category: form?.category,
      experienceLevel: form?.experienceLevel,
    })
    if (result.data) {
      notify.success('Job updated.')
      navigate(`/client/jobs/${jobId}`)
    } else {
      notify.error(result.error?.data ?? 'Could not save changes. Please try again.')
    }
  }

  if (isLoading || !form) return <Spinner label="Loading job…" />
  if (isError || !job) return <ErrorState message="Job not found." />

  if (!EDITABLE_JOB_STATUSES.includes(job.status)) {
    return (
      <ErrorState
        message={`This job is ${job.status.toLowerCase()} and can no longer be edited.`}
      />
    )
  }

  return (
    <div>
      <PageHeader title="Edit job" description="Update the details freelancers see for this job." />
      <Card className="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Job title" id="title" value={form.title} error={errors.title}
                 onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. E-commerce Website Redesign" />
          <Textarea label="Description" id="description" rows={5} value={form.description} error={errors.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Project requirements, deliverables, timeline expectations…" />
          <Input label="Budget (₹)" id="budget" type="number" min="0" value={form.budget} error={errors.budget}
                 onChange={(e) => setForm({ ...form, budget: e.target.value })} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label="Category" id="category" value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {JOB_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Select label="Experience level" id="experienceLevel" value={form.experienceLevel}
                    onChange={(e) => setForm({ ...form, experienceLevel: e.target.value })}>
              {EXPERIENCE_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </Select>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Required skills</p>
            <div className="flex flex-wrap gap-2">
              {SKILLS.map((s) => (
                <button type="button" key={s.skillId} onClick={() => toggleSkill(s.skillId)}
                        className={`rounded-full border px-3 py-1.5 text-sm ${
                          form.requiredSkillIds.includes(s.skillId)
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
            <Link to={`/client/jobs/${jobId}`}><Button type="button" variant="secondary">Cancel</Button></Link>
          </div>
        </form>
      </Card>
    </div>
  )
}
