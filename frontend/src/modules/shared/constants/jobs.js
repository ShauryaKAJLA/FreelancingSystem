// Job form/filter option lists and lifecycle constants (mirrors backend models/constants.js).
export const JOB_CATEGORIES = [
  'Web Development',
  'Mobile Development',
  'Design',
  'Data & Analytics',
  'Writing & Content',
  'Marketing',
]

export const EXPERIENCE_LEVELS = ['Entry', 'Intermediate', 'Expert']

// Job status lifecycle: Draft -> Published -> In Progress -> Completed / Closed / Cancelled.
// Draft: not yet visible to freelancers, no bids possible, freely editable or deletable.
// Published: visible on Browse Jobs, accepting bids, editable, can be cancelled.
// In Progress: a bid has been accepted and a contract created; job is locked from edits.
// Completed / Closed / Cancelled: terminal states.
export const JOB_STATUSES = ['Draft', 'Published', 'In Progress', 'Completed', 'Closed', 'Cancelled']
export const EDITABLE_JOB_STATUSES = ['Draft', 'Published']

