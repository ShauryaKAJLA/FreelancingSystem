import { useParams } from 'react-router'
import { useSelector } from 'react-redux'
import { useGetUserDetailsQuery, useToggleUserStatusMutation } from '../adminApi'
import PageHeader from '../../shared/components/layout/PageHeader'
import Card from '../../shared/components/ui/Card'
import Badge from '../../shared/components/ui/Badge'
import Button from '../../shared/components/ui/Button'
import Spinner from '../../shared/components/ui/Spinner'
import ErrorState from '../../shared/components/ui/ErrorState'
import { formatCurrency, formatDate } from '../../shared/utils/format'
import { useNotify } from '../../shared/notifications/NotificationProvider'

export default function UserDetailsPage() {
  const { userId } = useParams()
  const admin = useSelector((s) => s.auth.currentUser)
  const notify = useNotify()
  const { data: user, isLoading, isError } = useGetUserDetailsQuery(userId)
  const [toggleStatus, { isLoading: toggling }] = useToggleUserStatusMutation()

  if (isLoading) return <Spinner label="Loading user…" />
  if (isError || !user) return <ErrorState message="User not found." />

  async function handleToggleStatus() {
    const willFlag = user.status !== 'Flagged'
    const result = await toggleStatus({ userId, adminId: admin.userId })
    if (result.data) notify.success(willFlag ? 'Account flagged.' : 'Account restored.')
    else notify.error(result.error?.data ?? 'Could not update this account. Please try again.')
  }

  return (
    <div>
      <PageHeader
        title={user.name}
        description={`${user.email} · joined ${formatDate(user.createdAt)}`}
        actions={
          <>
            <Badge status={user.status} />
            <Button variant={user.status === 'Flagged' ? 'secondary' : 'danger'} disabled={toggling}
                    onClick={handleToggleStatus}>
              {user.status === 'Flagged' ? 'Restore account' : 'Flag account'}
            </Button>
          </>
        }
      />

      <Card className="mb-6 max-w-md">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Role</p>
        <p className="mt-1 text-sm font-medium text-slate-800">{user.role}</p>
      </Card>

      {user.role === 'Client' && user.profile && (
        <div>
          <h2 className="mb-3 text-base font-semibold text-slate-900">Jobs posted ({user.profile.jobsPosted.length})</h2>
          <div className="space-y-2">
            {user.profile.jobsPosted.map((j) => (
              <Card key={j.jobId} className="flex items-center justify-between">
                <span className="font-medium text-slate-800">{j.title}</span>
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <span>{formatCurrency(j.budget)}</span>
                  <Badge status={j.status} />
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {user.role === 'Freelancer' && user.profile && (
        <div>
          <h2 className="mb-3 text-base font-semibold text-slate-900">Contracts ({user.profile.contracts.length})</h2>
          <div className="space-y-2">
            {user.profile.contracts.map((c) => (
              <Card key={c.contractId} className="flex items-center justify-between">
                <span className="font-medium text-slate-800">{c.jobTitle}</span>
                <Badge status={c.status} />
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
