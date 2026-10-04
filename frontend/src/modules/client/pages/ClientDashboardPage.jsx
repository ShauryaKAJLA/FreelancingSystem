import { useSelector } from 'react-redux'
import { Link } from 'react-router'
import { useGetClientDashboardQuery } from '../clientApi'
import PageHeader from '../../shared/components/layout/PageHeader'
import StatCard from '../../shared/components/ui/StatCard'
import Card from '../../shared/components/ui/Card'
import Badge from '../../shared/components/ui/Badge'
import Button from '../../shared/components/ui/Button'
import Spinner from '../../shared/components/ui/Spinner'
import ErrorState from '../../shared/components/ui/ErrorState'
import EmptyState from '../../shared/components/ui/EmptyState'
import { formatDate } from '../../shared/utils/format'

export default function ClientDashboardPage() {
  const user = useSelector((s) => s.auth.currentUser)
  const { data, isLoading, isError } = useGetClientDashboardQuery(user.userId)

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${user.name.split(' ')[0]}`}
        description="Here's what's happening with your jobs and contracts."
        actions={<Link to="/client/jobs/new"><Button>+ Post a job</Button></Link>}
      />

      {isLoading && <Spinner label="Loading dashboard…" />}
      {isError && <ErrorState />}
      {data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <StatCard label="Published jobs" value={data.openJobs} caption="Awaiting or receiving bids" to="/client/jobs?status=Published" />
            <StatCard label="Drafts" value={data.draftJobs} tone="text-slate-500" caption="Not yet visible to freelancers" to="/client/jobs?status=Draft" />
            <StatCard label="Active contracts" value={data.activeContracts} tone="text-indigo-600" caption="In progress right now" to="/client/contracts" />
            <StatCard label="Pending bids" value={data.pendingBids} tone="text-amber-600" caption="Need your review" to="/client/jobs?status=PendingBids" />
          </div>

          <Card className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Recent job posts</h2>
              <Link to="/client/jobs" className="text-sm font-medium text-indigo-600 hover:underline">View all jobs →</Link>
            </div>
            {data.recentJobs.length === 0 ? (
              <EmptyState title="No jobs posted yet" description="Post your first job to start receiving bids from freelancers."
                          action={<Link to="/client/jobs/new"><Button>+ Post a job</Button></Link>} />
            ) : (
              <div className="divide-y divide-slate-100">
                {data.recentJobs.map((job) => (
                  <div key={job.jobId} className="flex items-center justify-between py-3">
                    <div>
                      <Link to={`/client/jobs/${job.jobId}`} className="font-medium text-slate-800 hover:text-indigo-600">{job.title}</Link>
                      <p className="text-xs text-slate-400">Posted {formatDate(job.createdAt)}</p>
                    </div>
                    <Badge status={job.status} />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
