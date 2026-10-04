module.exports = {
  ROLES: ['Client', 'Freelancer', 'Admin'],
  // Roles a person may pick for themselves at sign-up. Admin accounts are never self-service.
  SELF_REGISTER_ROLES: ['Client', 'Freelancer'],
  USER_STATUSES: ['Active', 'Flagged'],

  // --- Phase 3/4 entities (minimal shape; full CRUD arrives with those phases) ---
  // Job lifecycle (frontend is the source of truth): Draft -> Published -> In Progress -> Completed / Closed / Cancelled.
  JOB_STATUSES: ['Draft', 'Published', 'In Progress', 'Completed', 'Closed', 'Cancelled'],
  EDITABLE_JOB_STATUSES: ['Draft', 'Published'],
  JOB_CATEGORIES: ['Web Development', 'Mobile Development', 'Design', 'Data & Analytics', 'Writing & Content', 'Marketing'],
  EXPERIENCE_LEVELS: ['Entry', 'Intermediate', 'Expert'],
  // Phase 3 (frontend is the source of truth for these lists).
  BID_STATUSES: ['Pending', 'Updated', 'Withdrawn', 'Accepted', 'Rejected'],
  // A bid the client can still act on / the freelancer can still edit-or-withdraw.
  OPEN_BID_STATUSES: ['Pending', 'Updated'],
  CONTRACT_STATUSES: ['Pending Start', 'Active', 'Completed', 'Cancelled', 'Terminated'],
  // Contract states that can never change again.
  TERMINAL_CONTRACT_STATUSES: ['Completed', 'Cancelled', 'Terminated'],
  TERMINATION_ROLES: ['Client', 'Freelancer'],
  MILESTONE_STATUSES: ['Pending', 'Submitted', 'Completed'],
  // Only a Pending (and unfunded) milestone can be edited or deleted.
  EDITABLE_MILESTONE_STATUSES: ['Pending'],

  // --- Phase 5 ---
  PAYMENT_STATUSES: ['Pending', 'Held', 'Awaiting Payout', 'Paid', 'Failed', 'Refunded'],
  // Statuses in which the milestone's money is with the platform (or already paid out).
  FUNDED_PAYMENT_STATUSES: ['Held', 'Awaiting Payout', 'Paid'],
  // Payments shown to users in lists/details. Pending/Failed rows are unpaid Razorpay orders, not payments.
  VISIBLE_PAYMENT_STATUSES: ['Held', 'Awaiting Payout', 'Paid', 'Refunded'],
  PAYMENT_METHOD_TYPES: ['Card', 'UPI'],
  // Contract text: "subsequent milestones shall be funded following approval of the preceding one".
  ENFORCE_SEQUENTIAL_FUNDING: true,

  // --- Phase 6 ---
  // When true, two non-admin users may only message each other if they share a contract.
  MESSAGING_REQUIRES_CONTRACT: true,
  NOTIFICATION_TYPES: ['bid', 'contract', 'milestone', 'payment', 'issue', 'review', 'message', 'account'],
  REVIEW_STATUSES: ['Visible', 'Flagged', 'Hidden'],
}
