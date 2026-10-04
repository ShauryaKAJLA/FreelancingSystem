import { useParams, Link } from 'react-router'
import { useGetFreelancerProfileQuery } from '../../freelancer/freelancerApi'
import PageHeader from '../../shared/components/layout/PageHeader'
import Card from '../../shared/components/ui/Card'
import Spinner from '../../shared/components/ui/Spinner'
import ErrorState from '../../shared/components/ui/ErrorState'
import { formatCurrency } from '../../shared/utils/format'
import UserReviewsSection from '../../shared/components/reviews/UserReviewsSection'

export default function FreelancerProfileViewPage() {
  const { freelancerId } = useParams()
  const { data: profile, isLoading, isError } = useGetFreelancerProfileQuery(freelancerId)

  if (isLoading) return <Spinner label="Loading profile…" />
  if (isError || !profile) return <ErrorState />

  return (
    <div>
      <PageHeader title={profile.fullName} description="Freelancer profile" />
      <Link to="/client/freelancers" className="mb-4 inline-block text-sm text-indigo-600 hover:underline">&larr; Back to freelancers</Link>

      <Card className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{profile.fullName}</h2>
            <p className="text-sm text-slate-500">{profile.email}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-amber-500">★ {profile.rating}</p>
            <p className="text-xs text-slate-400">{formatCurrency(profile.hourlyRate)}/hr</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-slate-600">{profile.bio}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {profile.skills.map((s) => (
            <span key={s.skillId} className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
              {s.skillName} · {s.proficiencyLevel}
            </span>
          ))}
        </div>
      </Card>

      <UserReviewsSection userId={profile.freelancerId} emptyDescription="This freelancer hasn't completed a reviewed contract yet." />
    </div>
  )
}
