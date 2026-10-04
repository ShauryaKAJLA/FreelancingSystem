import Card from '../../shared/components/ui/Card'
import Badge from '../../shared/components/ui/Badge'
import Button from '../../shared/components/ui/Button'
import { formatCurrency, formatDate } from '../../shared/utils/format'

export default function BidCard({ bid, onAccept, disabled }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900">{bid.freelancerName}</p>
          <p className="text-xs text-slate-500">★ {bid.freelancerRating ?? '—'} rating · {formatCurrency(bid.freelancerRate)}/hr rate</p>
        </div>
        <Badge status={bid.status} />
      </div>
      <p className="mt-3 text-sm text-slate-600">{bid.proposal}</p>
      <div className="mt-4 flex items-center justify-between">
        <div>
          <p className="text-lg font-bold text-slate-900">{formatCurrency(bid.bidAmount)}</p>
          <p className="text-xs text-slate-400">Submitted {formatDate(bid.bidDate)}</p>
        </div>
        {(bid.status === 'Pending' || bid.status === 'Updated') && (
          <Button variant="primary" onClick={() => onAccept(bid.bidId)} disabled={disabled}>Accept & Hire</Button>
        )}
      </div>
    </Card>
  )
}
