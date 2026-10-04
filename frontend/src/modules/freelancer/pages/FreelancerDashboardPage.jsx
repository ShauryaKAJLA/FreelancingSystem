import { useSelector } from 'react-redux'
import { Link } from 'react-router'
import { useGetFreelancerDashboardQuery } from '../freelancerApi'
import PageHeader from '../../shared/components/layout/PageHeader'
import StatCard from '../../shared/components/ui/StatCard'
import Card from '../../shared/components/ui/Card'
import Badge from '../../shared/components/ui/Badge'
import Button from '../../shared/components/ui/Button'
import Spinner from '../../shared/components/ui/Spinner'
import ErrorState from '../../shared/components/ui/ErrorState'
import EmptyState from '../../shared/components/ui/EmptyState'
import { formatCurrency, formatDate } from '../../shared/utils/format'

export default function FreelancerDashboardPage() {
  const user = useSelector((s) => s.auth.currentUser)
  const { data, isLoading, isError } = useGetFreelancerDashboardQuery(user.userId)

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${user.name.split(' ')[0]}`}
        description="Here's your bidding and contract activity."
        actions={<Link to="/freelancer/jobs"><Button>Browse jobs</Button></Link>}
      />
      {isLoading && <Spinner label="Loading dashboard…" />}
      {isError && <ErrorState />}
      {data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <StatCard label="Pending bids" value={data.pendingBids} tone="text-amber-600" caption="Awaiting client response" to="/freelancer/bids?status=Pending" />
            <StatCard label="Active contracts" value={data.activeContracts} tone="text-indigo-600" caption="In progress" to="/freelancer/contracts" />
            <StatCard label="Total earned" value={formatCurrency(data.totalEarned)} tone="text-emerald-600" caption="Paid milestones" to="/freelancer/payments" />
            <StatCard label="Rating" value={data.rating ? `★ ${data.rating}` : '—'} caption="Average across reviews" to="/freelancer/profile" />
          </div>

          <Card className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Recent bids</h2>
              <Link to="/freelancer/bids" className="text-sm font-medium text-indigo-600 hover:underline">View all bids →</Link>
            </div>
            {data.recentBids.length === 0 ? (
              <EmptyState title="No bids yet" description="Browse open jobs and submit your first proposal."
                          action={<Link to="/freelancer/jobs"><Button>Browse jobs</Button></Link>} />
            ) : (
              <div className="divide-y divide-slate-100">
                {data.recentBids.map((b) => (
                  <div key={b.bidId} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium text-slate-800">{b.jobTitle}</p>
                      <p className="text-xs text-slate-400">Bid {formatCurrency(b.bidAmount)} · {formatDate(b.bidDate)}</p>
                    </div>
                    <Badge status={b.status} />
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
