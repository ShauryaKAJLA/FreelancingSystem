import { useState } from 'react'
import { useGetSkillsWithUsageQuery, useCreateSkillMutation, useUpdateSkillMutation, useDeleteSkillMutation } from '../../shared/api/skillsApi'
import PageHeader from '../../shared/components/layout/PageHeader'
import Table from '../../shared/components/ui/Table'
import Button from '../../shared/components/ui/Button'
import Input from '../../shared/components/ui/Input'
import Modal from '../../shared/components/ui/Modal'
import ConfirmDialog from '../../shared/components/ui/ConfirmDialog'
import Spinner from '../../shared/components/ui/Spinner'
import ErrorState from '../../shared/components/ui/ErrorState'
import EmptyState from '../../shared/components/ui/EmptyState'
import { useNotify } from '../../shared/notifications/NotificationProvider'

// Admin: manage the skills master list (GET/POST/PUT/DELETE /skills). A skill in use by a profile or job cannot be deleted
// (the server answers 409 and the message is shown here).
export default function SkillsPage() {
  const notify = useNotify()
  const { data: skills, isLoading, isError } = useGetSkillsWithUsageQuery()
  const [createSkill, { isLoading: creating }] = useCreateSkillMutation()
  const [updateSkill, { isLoading: renaming }] = useUpdateSkillMutation()
  const [deleteSkill, { isLoading: deleting }] = useDeleteSkillMutation()
  const [newName, setNewName] = useState('')
  const [addError, setAddError] = useState('')
  const [editing, setEditing] = useState(null) // { skillId, skillName }
  const [editError, setEditError] = useState('')
  const [toDelete, setToDelete] = useState(null)
  const [deleteError, setDeleteError] = useState(null)

  async function handleAdd(e) {
    e.preventDefault()
    setAddError('')
    const result = await createSkill({ skillName: newName })
    if (result.data) { setNewName(''); notify.success(`Added “${result.data.skillName}”.`) }
    else setAddError(result.error?.data ?? 'Could not add this skill.')
  }

  async function handleRename() {
    setEditError('')
    const result = await updateSkill({ skillId: editing.skillId, skillName: editing.skillName })
    if (result.data) { setEditing(null); notify.success('Skill renamed.') }
    else setEditError(result.error?.data ?? 'Could not rename this skill.')
  }

  async function handleDelete() {
    setDeleteError(null)
    const result = await deleteSkill(toDelete.skillId)
    if (result.data) { setToDelete(null); notify.success(`Deleted “${toDelete.skillName}”.`) }
    else setDeleteError(result.error ?? { data: 'Could not delete this skill.' })
  }

  return (
    <div>
      <PageHeader title="Skills" description="The master list used by job posts, freelancer profiles and search filters." />
      <form onSubmit={handleAdd} className="mb-4 flex items-start gap-2">
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New skill name" aria-label="New skill name" maxLength={60} error={addError} className="w-64" />
        <Button type="submit" disabled={creating || !newName.trim()}>{creating ? 'Adding…' : 'Add skill'}</Button>
      </form>
      {isLoading && <Spinner />}
      {isError && <ErrorState />}
      {skills && (
        <Table
          rowKey="skillId"
          rows={skills}
          emptyState={<EmptyState title="No skills yet" description="Add the first skill above." />}
          columns={[
            { key: 'skillName', header: 'Skill', render: (r) => <span className="font-medium text-slate-900">{r.skillName}</span> },
            { key: 'freelancerCount', header: 'Freelancers', render: (r) => r.freelancerCount ?? 0 },
            { key: 'jobCount', header: 'Jobs', render: (r) => r.jobCount ?? 0 },
            {
              key: 'actions', header: '',
              render: (r) => (
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => { setEditError(''); setEditing({ ...r }) }}>Rename</Button>
                  <Button variant="danger" onClick={() => { setDeleteError(null); setToDelete(r) }}>Delete</Button>
                </div>
              ),
            },
          ]}
        />
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Rename skill"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={renaming}>Cancel</Button>
            <Button onClick={handleRename} disabled={renaming || !editing?.skillName.trim()}>{renaming ? 'Saving…' : 'Save'}</Button>
          </>
        }
      >
        {editing && <Input value={editing.skillName} onChange={(e) => setEditing({ ...editing, skillName: e.target.value })} aria-label="Skill name" maxLength={60} error={editError} />}
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete skill"
        description={toDelete ? `Delete “${toDelete.skillName}”? Skills used by a profile or job can't be deleted.` : ''}
        confirmLabel="Delete"
        isLoading={deleting}
        error={deleteError}
        onConfirm={handleDelete}
        onClose={() => setToDelete(null)}
      />
    </div>
  )
}
