import { useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate, Link } from 'react-router'
import { useCreateJobMutation } from '../clientApi'
import PageHeader from '../../shared/components/layout/PageHeader'
import Card from '../../shared/components/ui/Card'
import Input from '../../shared/components/ui/Input'
import Textarea from '../../shared/components/ui/Textarea'
import Select from '../../shared/components/ui/Select'
import Button from '../../shared/components/ui/Button'
import { useSkills } from '../../shared/api/skillsApi'
import { JOB_CATEGORIES, EXPERIENCE_LEVELS } from '../../shared/constants/jobs'
import { useNotify } from '../../shared/notifications/NotificationProvider'

export default function CreateJobPage() {
  const SKILLS = useSkills()
  const user = useSelector((s) => s.auth.currentUser)
  const [createJob, { isLoading }] = useCreateJobMutation()
  const navigate = useNavigate()
  const notify = useNotify()
  const [form, setForm] = useState({
    title: '', description: '', budget: '', requiredSkillIds: [],
    category: JOB_CATEGORIES[0], experienceLevel: EXPERIENCE_LEVELS[0],
    numberOfMilestones: '1', milestoneTasks: [''],
  })
  const [errors, setErrors] = useState({})

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
    if (!form.title.trim()) e.title = 'Job title is required.'
    if (!form.description.trim()) e.description = 'Description is required.'
    if (!form.budget || Number(form.budget) <= 0) e.budget = 'Enter a valid budget amount.'
    if (form.milestoneTasks.some((t) => !t.trim())) e.milestoneTasks = 'Enter a task specification for every milestone.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e, status) {
    e.preventDefault()
    if (!validate()) return
    const result = await createJob({
      clientId: user.userId, title: form.title, description: form.description, budget: Number(form.budget),
      requiredSkillIds: form.requiredSkillIds, category: form.category, experienceLevel: form.experienceLevel,
      numberOfMilestones: Number(form.numberOfMilestones),
      milestoneTasks: form.milestoneTasks.map((t) => t.trim()),
      status,
    })
    if (result.data) {
      notify.success(status === 'Draft' ? 'Draft saved.' : 'Job published — it\u2019s now visible to freelancers.')
      navigate(`/client/jobs/${result.data.jobId}`)
    } else {
      notify.error(result.error?.data ?? 'Could not save this job. Please try again.')
    }
  }

  return (
    <div>
      <PageHeader title="Post a new job" description="Describe the project so freelancers can submit relevant bids." />
      <Card className="max-w-2xl">
        <form onSubmit={(e) => handleSubmit(e, 'Published')} className="space-y-4">
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
          <Select label="Milestones (number of milestones)" id="numberOfMilestones" value={form.numberOfMilestones}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    setForm({ ...form, numberOfMilestones: e.target.value, milestoneTasks: Array.from({ length: n }, (_, i) => form.milestoneTasks[i] ?? '') })
                  }}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={String(n)}>{n}</option>)}
          </Select>
          <div className="space-y-3">
            {form.milestoneTasks.map((t, i) => (
              <Textarea key={i} label={`Milestone ${i + 1} — task specification`} id={`milestone-task-${i}`} rows={2} value={t}
                        onChange={(e) => setForm({ ...form, milestoneTasks: form.milestoneTasks.map((x, j) => (j === i ? e.target.value : x)) })}
                        placeholder={`What should be delivered in milestone ${i + 1}?`} />
            ))}
            {errors.milestoneTasks && <p className="text-xs text-red-600">{errors.milestoneTasks}</p>}
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
          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="submit" disabled={isLoading}>{isLoading ? 'Publishing…' : 'Publish job'}</Button>
            <Button type="button" variant="secondary" disabled={isLoading} onClick={(e) => handleSubmit(e, 'Draft')}>
              {isLoading ? 'Saving…' : 'Save as draft'}
            </Button>
            <Link to="/client/jobs"><Button type="button" variant="ghost">Cancel</Button></Link>
          </div>
          <p className="text-xs text-slate-500">
            Drafts aren't visible to freelancers until you publish them. You can edit or delete a draft any time.
          </p>
        </form>
      </Card>
    </div>
  )
}
