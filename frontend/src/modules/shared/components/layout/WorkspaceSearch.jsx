import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { FiSearch } from 'react-icons/fi'
import { useClientSearchWorkspaceQuery as useClientSearchQuery } from '../../../client/clientApi'
import { useFreelancerSearchWorkspaceQuery as useFreelancerSearchQuery } from '../../../freelancer/freelancerApi'
import { useAdminSearchWorkspaceQuery as useAdminSearchQuery } from '../../../admin/adminApi'

// A single topbar search box whose results differ by role:
// - Client: their own jobs and contracts, by job title
// - Freelancer: open jobs and their own contracts, by job title
// - Admin: platform users, by name or email
export default function WorkspaceSearch({ user, open, onRequestClose }) {
  const [term, setTerm] = useState('')
  const navigate = useNavigate()
  const containerRef = useRef(null)
  const role = user?.role

  const clientResult = useClientSearchQuery({ clientId: user?.userId, query: term }, { skip: role !== 'Client' || !term })
  const freelancerResult = useFreelancerSearchQuery({ freelancerId: user?.userId, query: term }, { skip: role !== 'Freelancer' || !term })
  const adminResult = useAdminSearchQuery({ query: term }, { skip: role !== 'Admin' || !term })

  const results = (role === 'Client' ? clientResult.data : role === 'Freelancer' ? freelancerResult.data : adminResult.data) ?? []

  function handleSelect(result) {
    setTerm('')
    onRequestClose()
    navigate(result.to)
  }

  function handleBlur(e) {
    if (containerRef.current && !containerRef.current.contains(e.relatedTarget)) {
      onRequestClose()
    }
  }

  if (!open) return null

  return (
    <div className="relative hidden sm:block" ref={containerRef} onBlur={handleBlur}>
      <div className="flex w-64 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
        <FiSearch className="text-slate-400" />
        <input
          autoFocus
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          className="w-full border-0 bg-transparent text-sm outline-none"
          placeholder={role === 'Admin' ? 'Search users…' : 'Search jobs…'}
        />
      </div>
      {term.trim() && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-80 rounded-xl border border-slate-200 bg-white shadow-lg">
          {results.length === 0 ? (
            <p className="px-4 py-4 text-sm text-slate-400">No matches for "{term}".</p>
          ) : (
            results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => handleSelect(r)}
                className="flex w-full flex-col items-start gap-0.5 border-b border-slate-50 px-4 py-2.5 text-left text-sm last:border-0 hover:bg-slate-50"
              >
                <span className="font-medium text-slate-800">{r.label}</span>
                <span className="text-xs text-slate-400">{r.sublabel}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
