import { Link } from 'react-router'
import Card from '../../shared/components/ui/Card'
import Badge from '../../shared/components/ui/Badge'
import { formatCurrency, formatDate } from '../../shared/utils/format'

export default function JobCard({ job, to }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link to={to} className="text-base font-semibold text-slate-900 hover:text-indigo-600">{job.title}</Link>
          <p className="mt-1 line-clamp-2 text-sm text-slate-500">{job.description}</p>
        </div>
        <Badge status={job.status} />
      </div>
      {(job.category || job.experienceLevel) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {job.category && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{job.category}</span>}
          {job.experienceLevel && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{job.experienceLevel}</span>}
        </div>
      )}
      <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
        <span className="font-semibold text-slate-800">{formatCurrency(job.budget)}</span>
        <span>{job.bidCount ?? 0} bid{job.bidCount === 1 ? '' : 's'} · posted {formatDate(job.createdAt)}</span>
      </div>
      {(job.status === 'Draft' || job.status === 'Published') && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <Link to={`${to}/edit`} className="text-xs font-medium text-indigo-600 hover:underline">Edit job →</Link>
        </div>
      )}
    </Card>
  )
}
