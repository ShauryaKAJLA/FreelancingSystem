import { useState } from 'react'
import { useGetUserReviewsQuery } from '../../api/reviewsApi'
import Card from '../ui/Card'
import Spinner from '../ui/Spinner'
import ErrorState from '../ui/ErrorState'
import EmptyState from '../ui/EmptyState'
import Pagination from '../ui/Pagination'
import { formatDate } from '../../utils/format'

// Public reviews received by a user, paged, backed by its own endpoint (GET /users/:userId/reviews).
export default function UserReviewsSection({ userId, emptyDescription }) {
  const [page, setPage] = useState(1)
  const { data, isLoading, isFetching, isError } = useGetUserReviewsQuery({ userId, page, limit: 5 }, { skip: !userId })

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-base font-semibold text-slate-900">Client reviews</h2>
        {data && data.summary.reviewCount > 0 && (
          <p className="text-sm text-slate-500"><span className="text-amber-500">★</span> {data.summary.averageRating} · {data.summary.reviewCount} review{data.summary.reviewCount === 1 ? '' : 's'}</p>
        )}
      </div>
      {isLoading && <Spinner />}
      {isError && <ErrorState />}
      {data && data.items.length === 0 && <EmptyState title="No reviews yet" description={emptyDescription} />}
      {data && data.items.length > 0 && (
        <div className="space-y-3">
          {data.items.map((r) => (
            <Card key={r.reviewId}>
              <div className="flex items-center justify-between">
                <p className="font-medium text-slate-800">{r.reviewerName}</p>
                <p className="text-amber-500">{'★'.repeat(r.rating)}</p>
              </div>
              <p className="mt-2 text-sm text-slate-600">{r.comment}</p>
              <p className="mt-2 text-xs text-slate-400">{formatDate(r.reviewDate)}</p>
            </Card>
          ))}
        </div>
      )}
      {data && <Pagination meta={data.pagination} onPageChange={setPage} isFetching={isFetching} />}
    </section>
  )
}
