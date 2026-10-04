import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useSelector } from 'react-redux'
import { useGetReportedIssuesQuery, useResolveIssueMutation } from '../adminApi'
import PageHeader from '../../shared/components/layout/PageHeader'
import Card from '../../shared/components/ui/Card'
import Badge from '../../shared/components/ui/Badge'
import Button from '../../shared/components/ui/Button'
import Select from '../../shared/components/ui/Select'
import Pagination from '../../shared/components/ui/Pagination'
import { useListParams } from '../../shared/hooks/useListParams'
import Modal from '../../shared/components/ui/Modal'
import Spinner from '../../shared/components/ui/Spinner'
import ErrorState from '../../shared/components/ui/ErrorState'
import EmptyState from '../../shared/components/ui/EmptyState'
import { formatDate } from '../../shared/utils/format'
import { useNotify } from '../../shared/notifications/NotificationProvider'

export default function ReportsPage() {
  const admin = useSelector((s) => s.auth.currentUser)
  const notify = useNotify()
  const [searchParams] = useSearchParams()
  const { filters, params, setFilter, setPage } = useListParams({ status: searchParams.get('status') ?? '' })
  const { data, isLoading, isFetching, isError } = useGetReportedIssuesQuery(params)
  const issues = data?.rows
  const [resolveIssue, { isLoading: resolving }] = useResolveIssueMutation()
  const [selectedId, setSelectedId] = useState(null)
  const selected = issues?.find((i) => i.issueId === selectedId) ?? null

  async function handleResolve(issueId) {
    const result = await resolveIssue({ issueId, adminId: admin.userId })
    if (result.data) notify.success('Issue marked as resolved.')
    else notify.error(result.error?.data ?? 'Could not resolve this issue. Please try again.')
  }

  return (
    <div>
      <PageHeader title="Review Conflicts" description="Client- and freelancer-reported issues and disputes requiring admin attention."
                  actions={
                    <Select value={filters.status} onChange={(e) => setFilter('status', e.target.value)} className="w-40">
                      <option value="">Status</option>
                      <option value="Open">Open</option>
                      <option value="Resolved">Resolved</option>
                    </Select>
                  } />
      {isLoading && <Spinner />}
      {isError && <ErrorState />}
      {issues && issues.length === 0 && !filters.status && <EmptyState title="No reported issues" description="Nothing currently needs your attention." />}
      {issues && issues.length === 0 && filters.status && <EmptyState title="No matching issues" description="No issues match this filter." />}
      {issues && issues.length > 0 && (
        <div className="space-y-3">
          {issues.map((issue) => (
            <Card key={issue.issueId} className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">{issue.subject}</p>
                <p className="text-xs text-slate-500">{issue.jobTitle} · raised by {issue.raisedByName} on {formatDate(issue.raisedDate)}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge status={issue.status} />
                <Button variant="secondary" onClick={() => setSelectedId(issue.issueId)}>View details</Button>
                {issue.status === 'Open' && (
                  <Button disabled={resolving} onClick={() => handleResolve(issue.issueId)}>
                    Mark resolved
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {data && <Pagination meta={data.meta} onPageChange={setPage} isFetching={isFetching} />}

      <Modal open={Boolean(selected)} onClose={() => setSelectedId(null)} title="Conflict details"
             footer={selected && (
               <>
                 <Button variant="secondary" onClick={() => setSelectedId(null)}>Close</Button>
                 {selected.status === 'Open' && (
                   <Button disabled={resolving} onClick={() => handleResolve(selected.issueId)}>Mark resolved</Button>
                 )}
               </>
             )}>
        {selected && (
          <div className="space-y-3 text-sm">
            <p className="font-medium text-slate-900">{selected.subject}</p>
            <dl className="divide-y divide-slate-100">
              {[
                ['Status', <Badge key="s" status={selected.status} />],
                ['Raised by', selected.raisedByName],
                ['Raised on', formatDate(selected.raisedDate)],
                ['Job', selected.jobTitle ?? '—'],
                ['Client', selected.clientName],
                ['Freelancer', selected.freelancerName],
                ['Contract status', selected.contractStatus ?? '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between py-2">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="font-medium text-slate-800">{value}</dd>
                </div>
              ))}
            </dl>
            {selected.relatedContractId && (
              <Link to={`/admin/contracts/${selected.relatedContractId}`} className="text-indigo-600 hover:underline">
                Open related contract →
              </Link>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
