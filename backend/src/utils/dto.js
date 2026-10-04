// DTO layer: the FRONTEND is the single source of truth for response shapes.
// The React app was built against these field names (userId, jobId, bidId, ...), so every service
// returns data through a mapper here instead of leaking raw Mongoose documents (_id, __v, ...).
// Later phases add toJobDTO / toBidDTO / toContractDTO / ... to this file.

const idOf = (v) => (v == null ? null : String(v._id ?? v))
const iso = (d) => (d ? new Date(d).toISOString() : null)

// Matches the frontend `users` mock: { userId, email, role, name, createdAt, status }
const toUserDTO = (u) => ({
  userId: idOf(u),
  name: u.name,
  email: u.email,
  role: u.role,
  status: u.status,
  createdAt: iso(u.createdAt),
})

// What the frontend keeps in `auth.currentUser`: { userId, name, email, role }
const toSessionUser = (u) => ({ userId: idOf(u), name: u.name, email: u.email, role: u.role })

// ── Phase 2 mappers ────────────────────────────────────────────────────────────────────────

// Skill -> { skillId, skillName }
const toSkillDTO = (s) => ({ skillId: idOf(s), skillName: s.name })

// Matches the frontend `jobs` mock. Extra keys (bidCount, clientName, ...) are added by the services.
const toJobDTO = (j) => ({
  jobId: idOf(j),
  clientId: idOf(j.clientId),
  title: j.title,
  description: j.description,
  budget: j.budget,
  status: j.status,
  createdAt: iso(j.createdAt),
  requiredSkillIds: (j.requiredSkillIds ?? []).map(idOf),
  category: j.category ?? null,
  experienceLevel: j.experienceLevel ?? null,
  numberOfMilestones: j.numberOfMilestones ?? 1,
  milestoneTasks: j.milestoneTasks ?? [],
  ...(j.cancellationReason ? { cancellationReason: j.cancellationReason } : {}),
})

// Bank details are only shown in full to the owner/admin; everyone else gets nothing (the UI only shows
// this block on the owner's own profile).
const maskAccount = (acct) => {
  if (!acct) return null
  const n = acct.accountNumber || ''
  return { holderName: acct.holderName, bankName: acct.bankName, accountNumber: n ? `${'*'.repeat(Math.max(0, n.length - 4))}${n.slice(-4)}` : '', ifsc: acct.ifsc, upiId: acct.upiId }
}
const fullAccount = (acct) => (acct ? { holderName: acct.holderName, bankName: acct.bankName, accountNumber: acct.accountNumber, ifsc: acct.ifsc, upiId: acct.upiId } : null)

// Client profile page: { ...user, ...client } => userId, name, email, role, status, createdAt, clientId, companyName, website, totalSpend
const toClientProfileDTO = (user, profile, { totalSpend = 0, includeEmail = true } = {}) => ({
  userId: idOf(user),
  name: user.name,
  ...(includeEmail && { email: user.email }),
  role: user.role,
  status: user.status,
  createdAt: iso(user.createdAt),
  clientId: idOf(user),
  companyName: profile?.companyName ?? '',
  website: profile?.website ?? '',
  totalSpend,
})

// Freelancer profile page: { freelancerId, fullName, hourlyRate, bio, rating, paymentAccount, pastProjects, email, skills[], reviews[] }
const toFreelancerProfileDTO = (user, profile, { skills = [], reviews = [], isOwnerOrAdmin = false } = {}) => ({
  freelancerId: idOf(user),
  fullName: user.name,
  hourlyRate: profile?.hourlyRate ?? 0,
  bio: profile?.bio ?? '',
  rating: profile?.rating ?? 0,
  ...(isOwnerOrAdmin && { email: user.email, paymentAccount: fullAccount(profile?.paymentAccount) }),
  ...(!isOwnerOrAdmin && { paymentAccount: null }),
  pastProjects: (profile?.pastProjects ?? []).map((p) => ({ title: p.title, description: p.description, year: p.year, link: p.link })),
  skills,
  reviews,
})

// Discovery list row (client "Find freelancers"): freelancer row + name, skills[] (names), status, completedContracts
const toFreelancerListDTO = (user, profile, { skillNames = [], completedContracts = 0 } = {}) => ({
  freelancerId: idOf(user),
  fullName: user.name,
  name: user.name,
  hourlyRate: profile.hourlyRate ?? 0,
  bio: profile.bio ?? '',
  rating: profile.rating ?? 0,
  skills: skillNames,
  status: user.status,
  completedContracts,
})

// ── Phase 3 mappers ────────────────────────────────────────────────────────────────────────

// Bid -> { bidId, jobId, freelancerId, bidAmount, status, bidDate, proposal }
const toBidDTO = (b) => ({
  bidId: idOf(b),
  jobId: idOf(b.jobId),
  freelancerId: idOf(b.freelancerId),
  bidAmount: b.bidAmount,
  status: b.status,
  bidDate: iso(b.bidDate),
  proposal: b.proposal,
})

// Contract -> { contractId, jobId, clientId, freelancerId, startDate, endDate, status, terminationRequestedBy, terminationReason }
// (+ cancellationReason only when one was given, like the mock)
const toContractDTO = (c) => ({
  contractId: idOf(c),
  jobId: idOf(c.jobId),
  clientId: idOf(c.clientId),
  freelancerId: idOf(c.freelancerId),
  startDate: iso(c.startDate),
  endDate: iso(c.endDate),
  status: c.status,
  terminationRequestedBy: c.terminationRequestedBy ?? null,
  terminationReason: c.terminationReason ?? null,
  ...(c.cancellationReason ? { cancellationReason: c.cancellationReason } : {}),
})

// Milestone -> { milestoneId, contractId, title, taskSpec, amount, status, dueDate, funded, rejectionReason }
const toMilestoneDTO = (m) => ({
  milestoneId: idOf(m),
  contractId: idOf(m.contractId),
  title: m.title,
  taskSpec: m.taskSpec ?? null,
  amount: m.amount,
  status: m.status,
  dueDate: iso(m.dueDate),
  funded: Boolean(m.funded),
  rejectionReason: m.rejectionReason ?? null,
})

// Payment -> the frontend `payments` shape (Phase 4, final):
// { paymentId, milestoneId, contractId, amount, paymentDate, paymentStatus, razorpayPaymentId, adminVerified,
//   adminVerifiedAt, approvedAt, payoutTo, payoutId }. The mock overwrites paymentDate on payout, so Paid rows use payoutAt.
const toPaymentDTO = (p) => ({
  paymentId: idOf(p),
  milestoneId: idOf(p.milestoneId),
  contractId: idOf(p.contractId),
  amount: p.amount,
  paymentDate: iso(p.status === 'Paid' ? (p.payoutAt ?? p.paidAt ?? p.createdAt) : (p.paidAt ?? p.createdAt)),
  paymentStatus: p.status,
  razorpayPaymentId: p.providerPaymentId ?? null,
  adminVerified: Boolean(p.adminVerified),
  adminVerifiedAt: iso(p.adminVerifiedAt),
  approvedAt: iso(p.approvedAt),
  payoutTo: p.payoutTo ?? null,
  payoutId: p.payoutReference ?? null,
})

// Saved payment method -> { paymentMethodId, clientId, type, brand, last4, expiry, holderName, isDefault } (+ upiId for UPI).
const toPaymentMethodDTO = (m) => ({
  paymentMethodId: idOf(m),
  clientId: idOf(m.clientId),
  type: m.type,
  brand: m.brand || (m.type === 'UPI' ? 'UPI' : 'Card'),
  last4: m.last4 ?? null,
  expiry: m.expiry ?? null,
  holderName: m.holderName ?? '',
  isDefault: Boolean(m.isDefault),
  ...(m.upiId ? { upiId: m.upiId } : {}),
})

// Review rows inside client contract details. Phase 5 owns the full review DTO.
const toReviewDTO = (r) => ({
  reviewId: idOf(r),
  contractId: idOf(r.contractId),
  reviewerId: idOf(r.reviewerId),
  revieweeId: idOf(r.revieweeId),
  rating: r.rating,
  comment: r.comment ?? '',
  reviewDate: iso(r.createdAt),
})

// Message -> the frontend `messages` mock shape { messageId, senderId, receiverId, messageText, sentAt } (+ read).
const toMessageDTO = (m) => ({
  messageId: idOf(m),
  senderId: idOf(m.senderId),
  receiverId: idOf(m.receiverId),
  messageText: m.messageText,
  sentAt: iso(m.createdAt),
  read: Boolean(m.read),
})

// Notification -> { notificationId, userId, type, title, message, link, read, createdAt }.
// `link` is role-specific and resolved by notificationService (it needs the recipient's role and, for
// Milestone/Payment entities, the owning contract), so it is passed in.
const toNotificationDTO = (n, link = null) => ({
  notificationId: idOf(n),
  userId: idOf(n.userId),
  type: n.type,
  title: n.title,
  message: n.message,
  link,
  read: Boolean(n.isRead),
  createdAt: iso(n.createdAt),
})

// Issue -> { issueId, relatedContractId, raisedBy, subject, status, raisedDate } (+ resolution fields).
const toIssueDTO = (i) => ({
  issueId: idOf(i),
  relatedContractId: idOf(i.contractId),
  raisedBy: idOf(i.raisedBy),
  subject: i.subject,
  status: i.status,
  raisedDate: iso(i.createdAt),
  resolution: i.resolution ?? null,
  resolvedAt: iso(i.resolvedAt),
})

// AdminAction -> { actionId, adminId, actionType, actionDescription, actionDate }
const toAdminActionDTO = (a) => ({
  actionId: idOf(a),
  adminId: idOf(a.adminId),
  actionType: a.actionType,
  actionDescription: a.actionDescription,
  actionDate: iso(a.createdAt),
})

module.exports = {
  toIssueDTO, toAdminActionDTO,
  toMessageDTO, toNotificationDTO,
  idOf, iso, toUserDTO, toSessionUser,
  toSkillDTO, toJobDTO, toClientProfileDTO, toFreelancerProfileDTO, toFreelancerListDTO, maskAccount,
  toBidDTO, toContractDTO, toMilestoneDTO, toPaymentDTO, toPaymentMethodDTO, toReviewDTO,
}
