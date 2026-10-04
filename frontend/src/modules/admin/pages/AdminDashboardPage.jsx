import { useGetAdminDashboardQuery } from '../adminApi'
import PageHeader from '../../shared/components/layout/PageHeader'
import StatCard from '../../shared/components/ui/StatCard'
import Spinner from '../../shared/components/ui/Spinner'
import ErrorState from '../../shared/components/ui/ErrorState'
import { formatCurrency } from '../../shared/utils/format'

export default function AdminDashboardPage() {
  const { data, isLoading, isError } = useGetAdminDashboardQuery()

  return (
    <div>
      <PageHeader title="Platform overview" description="Users, activity, and health across the marketplace." />
      {isLoading && <Spinner label="Loading overview…" />}
      {isError && <ErrorState />}
      {data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total users" value={data.totalUsers} caption={`${data.totalClients} clients · ${data.totalFreelancers} freelancers`} to="/admin/users" />
          <StatCard label="Open jobs" value={data.openJobs} caption="Currently accepting bids" to="/admin/jobs" />
          <StatCard label="Active contracts" value={data.activeContracts} tone="text-indigo-600" caption="In progress" to="/admin/contracts?status=Active" />
          <StatCard label="Platform payments" value={formatCurrency(data.totalPlatformPayments)} tone="text-emerald-600" caption="Dispatched to freelancers" to="/admin/transactions" />
          <StatCard label="Awaiting payout" value={formatCurrency(data.awaitingPayoutAmount)} tone={data.awaitingPayoutCount > 0 ? 'text-amber-600' : 'text-slate-900'} caption={`${data.awaitingPayoutCount} approved milestone${data.awaitingPayoutCount === 1 ? '' : 's'} to dispatch`} to="/admin/transactions" />
          <StatCard label="Flagged accounts" value={data.flaggedUsers} tone={data.flaggedUsers > 0 ? 'text-red-600' : 'text-slate-900'} caption="Pending admin review" to="/admin/users?status=Flagged" />
          <StatCard label="Open reported issues" value={data.openIssues} tone={data.openIssues > 0 ? 'text-amber-600' : 'text-slate-900'} caption="Awaiting resolution" to="/admin/reports?status=Open" />
        </div>
      )}
    </div>
  )
}
