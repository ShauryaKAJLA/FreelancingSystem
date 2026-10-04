import { Link } from 'react-router'

// label -> value -> caption pattern, reused across every dashboard.
// Pass `to` to make the whole card a clickable link into the relevant workspace section.
export default function StatCard({ label, value, caption, tone = 'text-slate-900', to }) {
  const content = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${tone}`}>{value}</p>
      {caption && <p className="mt-1 text-sm text-slate-500">{caption}</p>}
    </>
  )

  if (to) {
    return (
      <Link
        to={to}
        className="block rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-indigo-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
      >
        {content}
      </Link>
    )
  }

  return <div className="rounded-xl border border-slate-200 bg-white p-5">{content}</div>
}
