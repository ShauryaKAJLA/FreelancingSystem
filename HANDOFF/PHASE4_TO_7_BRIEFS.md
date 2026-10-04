# STATUS: Phases 1-6 DONE in code + unit tests; live MongoDB / real Razorpay / Express-suite / browser runs pending. Phase 7 (cutover, hardening, deployment) is next.

## DONE
- Phase 5: reviews, dashboards, messaging (`messagesApi.js`, DTOs, polling), notifications (role-specific `link`, polling), `smoke-phase5.sh`.
- Phase 6: admin (19 frontend endpoints live-wired), issues (`raiseIssue`), search (3 workspaces), audit trail (`AdminAction`), `smoke-phase6.sh`.
- Tests: 143 backend tests run under the mongoose/dotenv shim (all passing); +26 written for Phases 5-6 slices.

## NOT DONE / NOT VERIFIED
- Never run: MongoDB, Razorpay, `express`-based test files (need `npm install`), `vite build`/`eslint`, any browser click-through.
- No HTTP-level route tests for messages/notifications/admin/issues/search.
- Refund initiation on cancel/terminate of a funded milestone: undecided.

---

# Briefs for Phases 4–7 (paste one as the prompt of a new session, with the latest project zip attached)

Common preamble for every brief: "Continue the FreelanceFlow integration. Read `INTEGRATION_PLAN.md`, `HANDOFF/SANDBOX_TIPS.md` and copy the patterns in `backend/src/services/jobService.js`. Frontend is the source of truth (field names, error strings). Per phase: backend (model/service/controller/routes/validators/DTOs) -> tests -> frontend `liveXxx` wired with `hybrid()` -> smoke script -> update the plan honestly -> zip + refreshed HANDOFF. Only claim what you ran."

## Phase 4 — Payments (Razorpay) + Payment methods (module `payments`)
- **Carry-over from Phase 3:** (a) `POST /milestones/:id/release-payment` (approve) exists in `milestoneService.approve`; wire the frontend `liveReleaseMilestonePayment` and finalise `toPaymentDTO` in `dto.js` (currently minimal: `paymentId, milestoneId, amount, paymentDate, paymentStatus, razorpayPaymentId, adminVerified:false, approvedAt`). (b) `paymentService.createOrder` orders "earlier milestones" by `dueDate`, but contract-start milestones have `dueDate: null` -> order by `createdAt/_id` instead. (c) `contractService.getDetails` joins only payments in `FUNDED_PAYMENT_STATUSES`. (d) Contract must be `Active` to fund (already checked). (e) Undecided: refund of a funded-but-unapproved milestone when a contract is cancelled/terminated.
- Backend mostly exists (`paymentService`, `razorpayService`, webhook, `paymentMethodService`). Add DTO mapping to the frontend payment fields (`paymentId, milestoneId, amount, paymentDate, paymentStatus, razorpayPaymentId, adminVerified, payoutTo, payoutId, approvedAt`), `verifyPayment` (admin) / payout account check that reads `FreelancerProfile.paymentAccount`, and `releaseMilestonePayment` wired to Phase 3's milestone approve.
- Frontend: rewrite `shared/utils/razorpay.js` to `create-order` -> Checkout with `order_id` -> `verify`, keeping the exported function name and its Promise-of-payment-id contract. `liveXxx` for `fundMilestone, releaseMilestonePayment, getClientPayments, getClientPaymentDetails, getFreelancerPayments, getFreelancerPaymentDetails, get/add/remove/setDefaultPaymentMethod`. `addPaymentMethod` must reduce the card number to `{brand, last4}` IN THE BROWSER — the full number never leaves the page; the backend already refuses raw card numbers.
- Acceptance: Razorpay TEST-mode payment; replaying `verify` doesn't double-fund; `Held -> Awaiting Payout -> Paid`; webhook signature checked on raw bytes. Highest-risk phase: list exactly what was not run against real Razorpay.

## Phase 5 — Reviews, Messaging, Notifications, Dashboards (modules `reviews, messaging, notifications`)
- Services exist: add DTO mapping, `GET /clients/:id/dashboard` and `GET /freelancers/:id/dashboard` (aggregations reproducing `getClientDashboard` / `getFreelancerDashboard` outputs — read the mocks: openJobs/draftJobs/activeContracts/pendingBids/recentJobs; pendingBids/activeContracts/totalEarned/rating/recentBids).
- Frontend: `submitClientReview`, reviews inside profile/contract queries, `MessagesPage` (conversation list + thread + send; it currently imports mock `users`), notifications (polling), both dashboards.
- Acceptance: review only on a `Completed` contract, one per party, rating recomputed; messaging gated by shared contract.

## Phase 6 — Admin, Issues, Search (modules `admin, search`)
- New `models/Issue.js`, `models/AdminAction.js`; `services/adminService.js, issueService.js, searchService.js`; `routes/adminRoutes.js, issueRoutes.js, searchRoutes.js`; review moderation `Visible/Flagged/Hidden`; every admin write also appends an `AdminAction` row.
- Frontend: all of `adminApi.js` (`getAdminDashboard, getUsers, getUserDetails, toggleUserStatus, getTransactions, getPaymentDetails, dispatchPayment, verifyPayment, getAdminContracts, getAdminContractDetails, getAdminReviews, moderateReview, getReportedIssues, resolveIssue, getAdminActionsLog, getAdminOpenJobs, get/editAdminProfile, adminSearchWorkspace`) plus `raiseIssue`, `clientSearchWorkspace`, `freelancerSearchWorkspace`.
- Acceptance: flagging a user blocks their next request immediately (already true in `authenticate`); every admin action appears in the log.

## Phase 7 — Cutover, hardening, deployment
- Set `VITE_LIVE_MODULES=all`; walk every page as Client, Freelancer, Admin.
- Delete `shared/mockData/*`, `utils/delay.js`, the mock `queryFn`s, `hybrid()`, and the TRANSITIONAL user-mirror shim in `authApi.js`; re-enable Immer auto-freeze and RTK `immutableCheck` in `store.js`.
- Backend: integration tests with `mongodb-memory-server`, `npm audit`, tighten CORS/helmet, indexes, pagination limits, request logging, graceful shutdown.
- Deployment: env matrix (`MONGODB_URI`, strong `JWT_SECRET`, Razorpay live keys + webhook secret, `CLIENT_URL`), Dockerfile, health check, README runbook.
