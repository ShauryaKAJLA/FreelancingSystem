import { useState } from 'react'
import { Link } from 'react-router'
import { useSelector } from 'react-redux'
import { useGetAdminReviewsQuery, useModerateReviewMutation } from '../adminApi'
import PageHeader from '../../shared/components/layout/PageHeader'
import Select from '../../shared/components/ui/Select'
import Pagination from '../../shared/components/ui/Pagination'
import { useListParams } from '../../shared/hooks/useListParams'
import Card from '../../shared/components/ui/Card'
import Badge from '../../shared/components/ui/Badge'
import Button from '../../shared/components/ui/Button'
import Spinner from '../../shared/components/ui/Spinner'
import ErrorState from '../../shared/components/ui/ErrorState'
import EmptyState from '../../shared/components/ui/EmptyState'
import { formatDate } from '../../shared/utils/format'
import { useNotify } from '../../shared/notifications/NotificationProvider'

const MODERATE_SUCCESS_MESSAGE = {
  approve: 'Review approved — visible again.',
  flag: 'Review flagged for follow-up.',
  hide: 'Review hidden.',
}

export default function ReviewsPage() {
  const admin = useSelector((s) => s.auth.currentUser)
  const notify = useNotify()
  const { filters, params, setFilter, setPage } = useListParams({ status: '' })
  const { data, isLoading, isFetching, isError } = useGetAdminReviewsQuery(params)
  const rows = data?.rows
  const [moderateReview, { isLoading: moderating }] = useModerateReviewMutation()
  const [pending, setPending] = useState(null) // { reviewId, action } while its own request is in flight


  async function handleModerate(reviewId, action) {
    setPending({ reviewId, action })
    const result = await moderateReview({ reviewId, action, adminId: admin.userId })
    setPending(null)
    if (result.data) notify.success(MODERATE_SUCCESS_MESSAGE[action] ?? 'Review updated.')
    else notify.error(result.error?.data ?? 'Could not update this review. Please try again.')
  }

  return (
    <div>
      <PageHeader
        title="Reviews"
        description="Client and freelancer reviews left across completed contracts."
        actions={
          <Select value={filters.status} onChange={(e) => setFilter('status', e.target.value)} className="w-40">
            <option value="">Status</option>
            <option value="Visible">Visible</option>
            <option value="Flagged">Flagged</option>
            <option value="Hidden">Hidden</option>
          </Select>
        }
      />
      {isLoading && <Spinner />}
      {isError && <ErrorState />}
      {rows && rows.length === 0 && <EmptyState title="No reviews" description="No reviews match this filter." />}
      {rows && rows.length > 0 && (
        <div className="space-y-3">
          {rows.map((r) => {
            const status = r.status ?? 'Visible'
            const isBusy = moderating && pending?.reviewId === r.reviewId
            return (
              <Card key={r.reviewId}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{r.reviewerName} → {r.revieweeName}</p>
                    <p className="text-xs text-slate-500">
                      {r.jobTitle ?? 'Unknown job'} · <Link to={`/admin/contracts/${r.contractId}`} className="text-indigo-600 hover:underline">{r.contractId}</Link> · {formatDate(r.reviewDate)}
                    </p>
                    <p className="mt-2 text-sm text-amber-500">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</p>
                    <p className="mt-1 text-sm text-slate-600">{r.comment}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <Badge status={status} />
                    <div className="flex gap-2">
                      {status !== 'Visible' && (
                        <Button variant="secondary" disabled={isBusy} onClick={() => handleModerate(r.reviewId, 'approve')}>
                          {isBusy && pending.action === 'approve' ? 'Working…' : 'Approve'}
                        </Button>
                      )}
                      {status !== 'Flagged' && (
                        <Button variant="secondary" disabled={isBusy} onClick={() => handleModerate(r.reviewId, 'flag')}>
                          {isBusy && pending.action === 'flag' ? 'Working…' : 'Flag'}
                        </Button>
                      )}
                      {status !== 'Hidden' && (
                        <Button variant="danger" disabled={isBusy} onClick={() => handleModerate(r.reviewId, 'hide')}>
                          {isBusy && pending.action === 'hide' ? 'Working…' : 'Hide'}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
      {data && <Pagination meta={data.meta} onPageChange={setPage} isFetching={isFetching} />}
    </div>
  )
}
