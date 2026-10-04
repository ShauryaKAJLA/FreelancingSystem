// Status colour mapping shared across Jobs, Bids, Contracts, Milestones, Payments, Users.
const STATUS_STYLES = {
  Draft: 'bg-slate-100 text-slate-500',
  Published: 'bg-emerald-50 text-emerald-700',
  Open: 'bg-emerald-50 text-emerald-700',
  'In Progress': 'bg-amber-50 text-amber-700',
  'Pending Start': 'bg-indigo-50 text-indigo-700',
  Closed: 'bg-slate-100 text-slate-600',
  Pending: 'bg-amber-50 text-amber-700',
  Updated: 'bg-sky-50 text-sky-700',
  Withdrawn: 'bg-slate-100 text-slate-500',
  Submitted: 'bg-sky-50 text-sky-700',
  Accepted: 'bg-emerald-50 text-emerald-700',
  Rejected: 'bg-red-50 text-red-700',
  Active: 'bg-indigo-50 text-indigo-700',
  Completed: 'bg-emerald-50 text-emerald-700',
  Cancelled: 'bg-red-50 text-red-700',
  Terminated: 'bg-red-50 text-red-700',
  Paid: 'bg-emerald-50 text-emerald-700',
  Held: 'bg-amber-50 text-amber-700',
  'Awaiting Payout': 'bg-sky-50 text-sky-700',
  Failed: 'bg-red-50 text-red-700',
  Resolved: 'bg-emerald-50 text-emerald-700',
  Open_issue: 'bg-red-50 text-red-700',
  Visible: 'bg-emerald-50 text-emerald-700',
  Hidden: 'bg-slate-100 text-slate-500',
  Active_user: 'bg-emerald-50 text-emerald-700',
  Flagged: 'bg-red-50 text-red-700',
}

export default function Badge({ status, children }) {
  const style = STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-600'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>
      {children ?? status}
    </span>
  )
}
