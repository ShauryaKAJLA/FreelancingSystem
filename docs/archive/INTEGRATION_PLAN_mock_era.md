# FreelanceFlow — Backend ↔ Frontend Integration Plan

**Rule of the whole project: the frontend is the single source of truth.**
The React app's field names, statuses, error format and page behaviour are fixed. The backend adapts to them
(through `backend/src/utils/dto.js`), never the other way round. Components keep calling the same RTK Query hooks.

## How the integration works (built in Phase 1)

| Piece | File | What it does |
|---|---|---|
| Module switchboard | `frontend/src/modules/shared/api/config.js` | `VITE_LIVE_MODULES=auth,jobs,...` (or `all`). **Empty = the app runs on mock data exactly as before.** |
| HTTP client | `frontend/src/modules/shared/api/http.js` | axios + Bearer token, 401 → sign-out, backend errors flattened to the plain string the UI reads from `error.data` |
| `hybrid()` | same file | Per endpoint: `queryFn: hybrid('jobs', mockImpl, liveImpl)`. Mock code stays until Phase 7. |
| DTO layer | `backend/src/utils/dto.js` | Maps Mongoose documents to the frontend's shapes (`_id` → `userId`, `jobId`, …) |

Because each module flips independently, you can test one phase live while everything else stays on mock data.
(While modules are mixed, live-created users are mirrored into the mock tables so mock-backed pages don't error. That shim is marked TRANSITIONAL in `authApi.js` and is deleted in Phase 7.)

**Per-phase recipe:** (1) backend model + service + controller + routes + validators, all returning DTOs →
(2) backend tests → (3) frontend `liveXxx` implementations next to the mocks, wired with `hybrid()` →
(4) add the module key to `VITE_LIVE_MODULES` → (5) run the phase's acceptance checklist.

---

## Phase 1 — Integration foundation + Authentication  ✅ DONE

**Backend**
- `src/utils/dto.js` (new) — `toUserDTO`, `toSessionUser`, `idOf`, `iso`
- `src/services/authService.js` — returns `{ token, user:{userId,name,email,role} }`; optional `role` on login (the login screen has a role selector) checked *after* the password so it can't be used to discover accounts
- `src/validators/authValidators.js` — accepts optional `role` on login
- `tests/auth.contract.test.js` (new, 13 tests)

**Frontend** (only 2 existing components touched, 1 line each)
- New: `shared/api/config.js`, `shared/api/http.js`, `.env.example`
- `auth/authApi.js` — mock + live implementations behind `hybrid('auth', …)`
- `auth/authSlice.js` — JWT kept in `tokenStore`, **not** in Redux; `currentUser` shape unchanged
- `app/store/store.js` — registers the 401 → sign-out handler
- `LoginPage.jsx` / `RegisterPage.jsx` — now pass `password` to the mutation (mock ignores it). Demo buttons use `VITE_DEMO_PASSWORD`.
- `.env` — new vars appended, default = mock mode

**Verified:** backend 21/21 tests; `vite build` passes; `integration-tests/phase1/run.sh` runs the real Express app against the frontend's real live layer (9 checks) plus a mock-mode regression check. **Not verified:** a live MongoDB run (none available in the build sandbox).

**Try it**
```bash
cd backend && cp .env.example .env && npm i && npm run seed && npm run dev      # needs MongoDB
cd frontend && npm i && VITE_LIVE_MODULES=auth npm run dev                        # or set it in .env
# Login: meera.iyer@dev.com / Password@123 (Freelancer) — demo buttons fill this in automatically
```

---

## Contract gaps found (frontend vs current backend) — these drive Phases 2–6

| # | Frontend (truth) | Backend today | Resolved in |
|---|---|---|---|
| 1 | Ids are `userId`, `jobId`, `bidId`, `contractId`, `milestoneId`, `paymentId`… | `_id` / `id` | DTOs, every phase |
| 2 | Job status: `Draft, Published, In Progress, Completed, Closed, Cancelled` | `Open, In Progress, Complete` | 2 |
| 3 | Job has `category`, `experienceLevel`, required skills, `cancellationReason` | missing | 2 |
| 4 | Skills `{skillId, skillName}`; the seed's 6 skills differ from the frontend's 8 | `{name}` | 2 |
| 5 | Freelancer profile has `paymentAccount` (bank/UPI) and `pastProjects`; admin payout needs the account | not stored | 2 |
| 6 | Contract status: `Pending Start, Active, Completed, Cancelled, Terminated` + `terminationRequestedBy/Reason` | `Active, Completed, Cancelled` | 3 |
| 7 | Bid status: `Pending, Updated, Withdrawn, Accepted, Rejected`; accepting rejects sibling bids and creates a `Pending Start` contract | no bids | 3 |
| 8 | Milestone `Pending → Submitted → Completed`, reject returns to `Pending`; funded milestones can't be edited/deleted | partial | 3 |
| 9 | `fundMilestone({milestoneId, razorpayPaymentId})`; Razorpay opened with a client-side amount and no order | server flow is `create-order` → Checkout → `verify` | 4 |
| 10 | `addPaymentMethod({cardNumber, expiry, holderName})` | backend **refuses raw card numbers** | 4 (browser reduces to brand/last4 before sending) |
| 11 | Payment fields `adminVerified`, `payoutTo`, `payoutId`, `razorpayPaymentId`; `verifyPayment` | different names, no verify | 4 |
| 12 | Termination request/response, issues (`raiseIssue`), admin actions log, review moderation | not built | 3 / 6 |
| 13 | Dashboards, workspace search (client/freelancer/admin) | not built | 5 / 6 |

Statuses in the backend's stand-in `Job/Contract/Milestone` models are referenced by `paymentService` and `reviewService`
(e.g. `'Active'`, `'Complete'`). When those enums change, grep both services and their tests in the same commit.

---

## Phase 2 — Profiles, Skills, Jobs & Discovery  ✅ DONE (code + unit tests; live run pending)
Module keys: `profiles`, `jobs`, `discovery` — **switch all three on together** (`VITE_LIVE_MODULES=auth,profiles,jobs,discovery`), because skill ids are shared between them.

**Backend (new/changed)**
- `models/Job.js` rewritten (gap #2/#3): statuses `Draft…Cancelled`, `category`, `experienceLevel`, `requiredSkillIds`, `milestoneTasks`, `numberOfMilestones`, `cancellationReason`. `constants.js` gains `JOB_CATEGORIES`, `EXPERIENCE_LEVELS`, `EDITABLE_JOB_STATUSES`.
- `models/FreelancerProfile.js`: + `paymentAccount`, `pastProjects` (gap #5). `models/Skill.js` unchanged (DTO maps `name` -> `skillName`).
- `services/jobService.js` (lifecycle with the mock's exact error strings; conditional updates so double-clicks can't race), `freelancerService.js` (discovery via aggregation, flagged users excluded), `skillService.js` (admin CRUD; a skill in use cannot be deleted), `profileService.js` rewritten to return frontend DTOs (+ `updateFreelancerExtras`, client `name` edit, `totalSpend` from funded payments).
- Routes: `jobRoutes.js`, `skillRoutes.js` (new); `clientRoutes.js` (+`/:id/jobs`), `freelancerRoutes.js` (+ `GET /`, `GET /:id`, `PUT /:id/extras`, `GET /:id/jobs/:jobId`).
- `utils/dto.js`: `toJobDTO, toSkillDTO, toClientProfileDTO, toFreelancerProfileDTO`. `utils/seed.js`: the frontend's 8 skills + jobs j1..j7 (`npm run seed -- --reset` wipes the dev DB first).
- Payout bank details are returned only to the owner/admin; everyone else gets `paymentAccount: null`. Draft jobs are visible only to their owner/admin.

**Frontend**
- New `shared/api/skillsApi.js` (`useSkills()` replaces the static `SKILLS` import in 5 pages: Create/Edit job, Freelancers list, Browse jobs, Freelancer profile).
- `liveXxx` next to the mocks (wired with `hybrid()`): `getClientJobs, getJobDetails, createJob, editJob, publishJob, deleteJob, cancelJob, getFreelancers, get/editClientProfile, getOpenJobs, getJobDetailsForFreelancer, get/editFreelancerProfile, updateFreelancerExtras`. `cleanParams()` added to `http.js`.

**Verified:** 34 new backend tests pass (21 pure: validators/query builders/lifecycle rules/DTOs, 13 with stubbed models: ownership, transitions, draft privacy, client names). JSX/JS of every touched frontend file parses. **Not verified:** a real MongoDB run and a browser run (none in the build sandbox) — run `backend/scripts/smoke-phase2.sh` (≈40 checks) as the acceptance step, then click through Create Job -> Publish -> Browse Jobs -> Cancel.

**Known Phase 2 limits (by design, closed in Phase 3+)**
- ~~Bids don't exist yet~~ — closed in Phase 3 (real `bidCount`, `pendingBids`, `bids`, `myBid`; cancelling a job rejects its open bids).
- Dashboards, contracts and payments pages are still mock-backed, so a live job won't appear in mock dashboards/contract lists until Phases 3/5.
- Skill proficiency level is not stored (all skills show `Intermediate`, same as the mock's edit behaviour).
- Jobs from flagged clients are not hidden from Browse Jobs (the mock didn't either).

## Phase 3 — Bids, Contracts, Milestones, Termination  ✅ DONE (code + unit tests; live run pending)
Module keys: `bids`, `contracts`, `milestones` — **switch all three on together with the Phase 2 keys**
(`VITE_LIVE_MODULES=auth,profiles,jobs,discovery,bids,contracts,milestones`). A live contract only makes sense next to a live job/bid, and mixed
live/mock ids never match (mock ids are `b1/ct1/m1`, live ids are 24-char ObjectIds).

**Backend (new/changed)**
- Models: `Bid.js` (new; `isActive` flag + partial unique index `(jobId, freelancerId)` so re-bidding after a withdrawal works), `Contract.js` rewritten (`Pending Start | Active | Completed | Cancelled | Terminated`, optional `startDate`, `cancellationReason`, `terminationRequestedBy/Reason`), `Milestone.js` rewritten (optional `dueDate`, `taskSpec`, `rejectionReason`, `funded`). `constants.js`: `BID_STATUSES`, `OPEN_BID_STATUSES`, `CONTRACT_STATUSES`, `TERMINAL_CONTRACT_STATUSES`, `TERMINATION_ROLES`, `EDITABLE_MILESTONE_STATUSES`.
- Services: `bidService.js` (submit / edit / withdraw / accept / listForFreelancer + the Phase 2 placeholders `statsForJobs, listForJob, countsForJobs, myBid, rejectAllForJob`), `contractService.js` (lists, joined details, start / complete / cancel / requestTermination / respondToTermination), `milestoneService.js` (create / edit / delete / submit / reject / approve). Each has a pure `rules` table with the mock's exact error strings.
- `jobService.js`: placeholders replaced — `bidCount / pendingBidCount / pendingBids[]` (list), `bids[]` (details), real `bidCount` (Browse Jobs), `myBid` (freelancer details; `getForFreelancer` now takes the viewer), and `cancel` rejects Pending/Updated bids.
- Routes: `bidRoutes.js`, `milestoneRoutes.js` (new), `contractRoutes.js` extended, plus `POST /jobs/:jobId/bids`, `POST /jobs/:jobId/bids/:bidId/accept`, `GET /clients/:id/contracts`, `GET /freelancers/:id/{bids,contracts}`. Validators: `bidValidators.js`, `contractValidators.js`, `milestoneValidators.js` (single-message 400s carry the mock's exact text, no "Validation failed:" prefix).
- `utils/dto.js`: `toBidDTO, toContractDTO, toMilestoneDTO, toPaymentDTO (minimal — Phase 4 finalises), toReviewDTO (minimal — Phase 5 finalises)`. Seed: bids b1..b6 and milestones m3/m4 (+ their Paid payments) for the completed demo contract.
- **Accept is atomic without a transaction** (standalone Mongo dev servers don't support them): ordered conditional updates — job `Published -> In Progress` (the lock), bid `Pending|Updated -> Accepted`, create the `Pending Start` contract (job + bid are rolled back if this fails), then reject the other non-withdrawn bids.
- Notifications: bid received, bid accepted, contract started / completed / cancelled, termination requested / answered, milestone submitted / rejected. (Approval notifies through `paymentService.markMilestoneApproved`.)
- Backend also exposes `POST /milestones/:id/release-payment` (= approve: milestone `Submitted -> Completed` + payment `Held -> Awaiting Payout`, rolled back if the payment moved meanwhile). **The frontend `releaseMilestonePayment` and `fundMilestone` stay mock until Phase 4.**

**Frontend:** `liveXxx` next to the mocks, wired with `hybrid()`: `submitBid, editBid, withdrawBid, getMyBids` (bids) · `acceptBid` (bids) · `startContract, completeContract, cancelContract, getClientContracts, getFreelancerContracts, getContractDetails, getFreelancerContractDetails, requestContractTermination, respondToTerminationRequest` (contracts) · `createMilestone, editMilestone, deleteMilestone, rejectMilestone, submitMilestone` (milestones). No component changed.

**Deliberate deviations from the mocks (all backend-side, none change a UI string)**
1. `pendingBids` / `pendingBidCount` include `Updated` bids, not just `Pending` (the mock's filter hid an edited bid from the client, yet the UI treats both as actionable).
2. Only the *other* party may **approve** a termination; either party may **decline/withdraw** (the UI's "Withdraw termination request" button calls `respond(approve:false)` as the requester). Approve/decline require a real boolean.
3. `requestedByRole` in the body is ignored — the role comes from the token. A second request while one is pending → 400.
4. `cancelContract` also refuses `Terminated` contracts (same message as Completed/Cancelled). Cancel and termination move the job `In Progress -> Closed`; complete moves it to `Completed`.
5. Milestones can't be added to a Completed/Cancelled/Terminated contract, and can't be submitted unless the contract is `Active` (backend-only hardening; new messages).
6. Complete / cancel / start are **client-only**; admins are read-only on these routes (Phase 6 adds admin views). A stranger gets 404, the wrong party 403.

**Verified (actually run in the build sandbox)**
- `cd backend && npm test`: **110/110 pass** (55 pre-existing — 4 Phase 2 job tests were updated to stub the new Bid model — plus 55 new: 22 pure in `tests/phase3.pure.test.js`, 33 stubbed-model in `tests/phase3.services.test.js`). One deliberate mutation (dropping `isActive:false` from withdraw) was confirmed to make a test fail.
- Express app loads with the new routes (`require('./src/app')`); `node --check` on `seed.js` and `bash -n` on `smoke-phase3.sh`.
- Frontend: `npm install`, `vite build` passes, `eslint` clean on `clientApi.js` and `freelancerApi.js`.

**NOT verified — run these on your machine**
- Nothing ran against a real MongoDB: the partial unique index on bids, `insertMany`, the aggregation in `countsForJobs`, and the accept/rollback sequence under real concurrency are covered by stubs only. → `npm run seed -- --reset && npm run dev`, then `bash scripts/smoke-phase3.sh` (~90 checks; needs MongoDB, and flips `funded` in the DB because funding is Phase 4).
- No browser run. Click through: Post job -> Publish -> (as freelancer) Submit / Edit / Withdraw bid -> (as client) Accept -> Start contract -> add / edit / delete milestone -> (set `funded` in the DB) -> Submit -> Reject -> Resubmit -> Request termination -> Approve.
- Milestone amounts/`dueDate: null` and Phase 4's sequential-funding query: `paymentService.createOrder` orders milestones by `dueDate`; contract-created milestones have `dueDate: null`. Review before Phase 4 (see HANDOFF).

**Mirror hazard while payments are still mock:** a live contract's milestones show `funded: false` and `payment: null` (real values only from the DB). The freelancer cannot submit a live milestone until it is funded, so until Phase 4 the smoke script/DB flip is the only way through. Nothing is faked in the UI.

## Phase 4 — Payments (Razorpay) + Payment Methods  ✅ DONE (code + unit/HTTP-wiring tests; live MongoDB and real Razorpay run pending)
Module key: `payments` — **switch on together with the Phase 3 keys** (`VITE_LIVE_MODULES=auth,profiles,jobs,discovery,bids,contracts,milestones,payments`). A live milestone can only be funded by a live payment (and the mock payments table knows nothing of live ids).

**Backend (new/changed)**
- `models/Payment.js`: + `adminVerified, adminVerifiedAt, payoutTo, dispatchedBy`. `constants.js`: + `VISIBLE_PAYMENT_STATUSES` (`Held, Awaiting Payout, Paid, Refunded`; unpaid `Pending/Failed` Razorpay orders are never shown as payments).
- `utils/dto.js`: `toPaymentDTO` finalised -> `{ paymentId, milestoneId, contractId, amount, paymentDate, paymentStatus, razorpayPaymentId, adminVerified, adminVerifiedAt, approvedAt, payoutTo, payoutId }` (Paid rows report the payout date as `paymentDate`, like the mock); new `toPaymentMethodDTO`. Contract details still join only `FUNDED_PAYMENT_STATUSES` payments.
- `services/paymentService.js`: every output goes through the DTO (the viewer-dependent `shape()` with `id/status/providerOrderId` is gone). Lists return **plain arrays** with the joined fields the pages read (`milestoneTitle, jobTitle, freelancerName` for clients / `clientName` for freelancers = company name else account name); details return `{...payment, milestone, contract, jobTitle, freelancerName, clientName}`. **Sequential funding now orders by `createdAt`, then `_id`** (`earlierMilestoneFilter`, pure) instead of `dueDate` (contract-start milestones have `dueDate: null`). `dispatchPayout` now reads `FreelancerProfile.paymentAccount` (UPI wins, else `A/c ****1234`), stores `payoutTo/payoutId/dispatchedBy`, sets `adminVerified`, and uses the mock's exact messages (`This payment has already been dispatched.`, `Funds can only be dispatched after the client approves the milestone.`, `The freelancer has not added a payout account (bank/UPI) yet.`); the Awaiting Payout -> Paid update is conditional so two admins cannot both dispatch. New `verifyByAdmin` (`POST /payments/:id/verify-admin`, Admin).
- `services/paymentMethodService.js` returns `{ paymentMethodId, clientId, type, brand, last4, expiry, holderName, isDefault }`; remove returns `{ paymentMethodId }`.
- Release/approve (`POST /milestones/:id/release-payment`) is unchanged from Phase 3 but now returns the final payment DTO + `nextMilestone`.
- Seed: Paid payments carry `payoutTo/adminVerified`; Meera has a UPI payout account (`meera@upi`) so a dispatch works out of the box. Karan has none (useful for the "no payout account" message).

**Frontend**
- `shared/utils/razorpay.js`: same export and Promise-of-payment-id contract. Live: `POST /payments/create-order` (milestoneId only, never the amount) -> Checkout with `order_id`/server-supplied key id -> resolves the payment id; the order id + signature Checkout returns are parked in memory (`takeCheckoutProof`). Mock path is byte-for-byte the old behaviour.
- `clientApi.js`: `liveFundMilestone` (posts the parked proof to `/payments/verify`; if the page was reloaded in between it says so, and the webhook still records the payment), `liveReleaseMilestonePayment`, `liveGetClientPayments`, `liveGetClientPaymentDetails`, `liveGet/Add/Remove/SetDefaultPaymentMethod`. `freelancerApi.js`: `liveGetFreelancerPayments`, `liveGetFreelancerPaymentDetails`. All wired with `hybrid('payments', ...)`. No component changed.
- `shared/utils/card.js` (new): `addPaymentMethod` validates the card number **in the browser** with the mock's exact messages and sends only `{type, brand, last4, expiry, holderName}`. The backend additionally refuses any payload carrying `cardNumber/cvv/pan/...`.

**Verified (actually run in the build sandbox)**
- `cd backend && npm test`: **138/138 pass** (110 existing — 1 updated for the final payment DTO — plus 22 in `tests/phase4.test.js` and 6 in `tests/phase4.routes.test.js`). The route tests drive the **real Express app over HTTP** with only the Mongoose models stubbed: auth/role gates, route order for `verify-admin`, response envelope and payment row keys, raw-card refusal (400) vs brand/last4 (201 DTO), webhook signature over the raw bytes (a re-serialised body is rejected) and duplicate-delivery idempotency.
- Two deliberate mutations were confirmed to fail tests: dropping the `status: 'Awaiting Payout'` condition from the payout update, and disabling the same-payment-id replay branch of `verifyPayment`.
- Frontend: `vite build` passes; `eslint` clean on `clientApi.js`, `freelancerApi.js`, `razorpay.js`, `card.js`; `card.js` checked with a throwaway node script (brand, last4, mock error strings, number absent from the output).
- `bash -n scripts/smoke-phase4.sh`.

**NOT verified — run these on your machine**
- **Nothing ran against a real MongoDB** (the sparse unique `fundedLock`/`providerPaymentId` indexes, the conditional updates under real concurrency, the populate-free joins) and **nothing ran against real Razorpay** (`api.razorpay.com` create-order, Checkout, real signatures, real webhook delivery, RazorpayX payouts — the admin "dispatch" only *records* a payout; it does not move money). No browser run either.
- `cd backend && npm run seed -- --reset && npm run dev`, then `bash scripts/smoke-phase4.sh`. It simulates the Razorpay side (inserts the Pending order row and signs the Checkout response with `RAZORPAY_KEY_SECRET`), so it needs the key secret and webhook secret in `backend/.env`. It covers verify -> Held, replay-safety, `Held -> Awaiting Payout -> Paid`, payout guards, payment-method privacy, and the webhook signature.
- **Manual Razorpay TEST-mode run (required):** set `RAZORPAY_KEY_ID/SECRET` (test) in `backend/.env`, `VITE_LIVE_MODULES=...,payments`, log in as Aisha, open her Active contract, fund the unfunded milestone with a Razorpay test card, confirm the toast and that the freelancer can now submit; then approve as Aisha and dispatch as admin (the admin UI still calls the mock `dispatchPayment` until Phase 6 — use `POST /api/payments/:id/payout` with the admin token meanwhile). For webhooks: `ngrok http 5000`, add `https://<id>.ngrok.app/api/payments/webhook` in the Razorpay dashboard with the same secret, events `payment.captured, order.paid, payment.failed, refund.processed`.
- Sequential-funding rule against real `createdAt` values (contract-start milestones are inserted with `insertMany`, so they can share a `createdAt`; the `_id` tie-break covers that, but only a real run proves the ordering). Unit-tested as a filter only.

**Deliberate deviations / decisions**
1. Lists and details return **payments only in `Held / Awaiting Payout / Paid / Refunded`**; `Pending`/`Failed` orders are internal. `Refunded` has no badge colour in the UI (falls back to grey).
2. Payment ordering for funding is `createdAt/_id`; `dueDate` is not used at all (it cannot define an order when null).
3. The freelancer sees the client's *company name* on payments, the client sees the account name (as in the two mocks).
4. **Still undecided (not built):** refund of a funded-but-unapproved milestone when a contract is cancelled/terminated. `refund.processed` webhooks are handled (`Refunded`, `funded` reset), but nothing *initiates* a refund. Decide together with Phase 6 (admin/issues).
5. Admin views of payments/transactions, `dispatchPayment`, `verifyPayment` on the frontend stay mock until Phase 6 (module `admin`); their backend endpoints exist now (`POST /payments/:id/payout`, `POST /payments/:id/verify-admin`, `GET /payments`).

## Phase 5 — Reviews, Messaging, Notifications, Dashboards  ✅ DONE (code + unit tests; live run pending)

### Phase 5 STATUS: DONE (code + tests; live MongoDB / browser run pending)

**Done earlier:** reviews (`liveSubmitClientReview`, review DTO, HTTP tests) and both dashboards (`dashboardService`, `hybridAll`).

**Done in this slice - messaging (module `messaging`)**
- `utils/dto.js`: `toMessageDTO` -> `{ messageId, senderId, receiverId, messageText, sentAt, read }`. `messageService` returns DTOs from `send`, the flat list and the conversation; `?view=conversations` rows are `{ userId, name, role, unreadCount, lastMessage:{ messageId, senderId, messageText, sentAt } }` (were `id/createdAt`). Rules unchanged: sender = token user, shared contract required (non-admins), private mailboxes, opening a conversation marks incoming messages read.
- Frontend: new `messaging/messagesApi.js` (`getConversations`, `getConversation`, `sendMessage`, each `hybrid('messaging', mock, live)`; the mock versions read/write the mock `messages` array so the page has ONE code path). `MessagesPage.jsx`: data layer replaced by these hooks (JSX/layout, mobile back-button behaviour unchanged); it no longer imports mock `users`/`messages`; send errors surface via `useNotify().error`; live mode polls every 15 s.
- Limitation (same as the mock): a thread only appears once a message exists; there is no "start new conversation" picker.

**Done in this slice - notifications (module `notifications`)**
- `utils/dto.js`: `toNotificationDTO` -> `{ notificationId, userId, type, title, message, link, read, createdAt }`.
- `notificationService.linkFor(role, notification, contractIdOf)` (pure, exported) derives the role-specific `link` from `relatedEntityType` + the RECIPIENT's role, using routes that exist in `AppRouter.jsx`: Job -> `/client|freelancer/jobs/:id` (Admin `/admin/jobs`), Contract -> `/<role>/contracts/:id`, Payment -> `/<role>/payments/:id` (Admin `/admin/payments/:id`), User+`message` -> the role's messages page, User+`account` -> `/admin/users/:id` (Admin only), Issue -> `/admin/reports`. **Milestone** notifications need the contract id: it is resolved at read time with one batched `Milestone.find` (and one `Payment.find`) per page - no producer had to change; if the lookup fails the link degrades to the contracts list page. `list` and `markRead` now return DTOs; `list` still adds `unreadCount` + `pagination`.
- Frontend: `getMyNotifications / markNotificationRead / markAllNotificationsRead` are `hybrid('notifications', ...)`; the bell polls every 30 s in live mode (`NotificationsDropdown`). `PATCH /notifications/read-all` stays registered before `/:notificationId/read`.

**Dashboards gating (decision):** `getClientDashboard` is live only when `jobs,bids,contracts` are all live; `getFreelancerDashboard` needs `jobs,bids,contracts,payments`.

**Tests:** new `tests/phase5.messaging.notifications.test.js` (10 tests: link table, milestone/payment contract resolution, degraded lookup, owner-scoped mark-read, notify never throws, send/conversation/inbox DTOs and privacy). **Run in the build sandbox with the mongoose shim** (`NODE_PATH=/tmp/fakemods node --test tests/phase5.messaging.notifications.test.js` -> 10/10). The full `npm test` could NOT be run this session (npm registry returned 403, so no `node_modules`); the 145 earlier tests were last run in the previous session and this slice does not change their code paths except `messageService`/`notificationService` return shapes. Frontend: every touched file parses with esbuild and the whole app bundles from `main.jsx` (externals for the npm packages); `vite build` / `eslint` NOT run this session.
**Not written:** HTTP-level route tests for messages/notifications (needs `express`, unavailable here) - copy `tests/phase4.routes.test.js` if you want them. `backend/scripts/smoke-phase5.sh` is written (`bash -n` only; ~40 checks covering reviews, dashboards, messaging, notifications) and has NOT been run - it needs MongoDB.
**Acceptance (run on your machine):** `npm test` (expect 155 passing), `npm run seed -- --reset && npm run dev`, `bash scripts/smoke-phase5.sh`, then in the browser with `reviews,messaging,notifications` live: Aisha messages Meera -> Meera's bell shows it (<=30 s) linking to `/freelancer/messages`.

Module keys: `reviews`, `messaging`, `notifications`

**Backend:** services exist; add DTO mapping, `GET /clients/:id/dashboard`, `GET /freelancers/:id/dashboard` (aggregations that reproduce `getClientDashboard` / `getFreelancerDashboard` output).
**Frontend:** `submitClientReview`, reviews inside profile/contract queries, `MessagesPage` calls (conversation list + thread + send), `getMyNotifications, markNotificationRead, markAllNotificationsRead`, both dashboards. Notifications are polled (`pollingInterval`) — Socket.IO stays optional.
**Acceptance:** review only on a `Completed` contract, one per party, rating recomputed; messaging gated by shared contract.

## Phase 6 — Admin, Issues, Search  ✅ DONE (code + unit tests; live MongoDB / browser run pending)
Module keys: `admin` (all admin pages + `raiseIssue`), `search` (all three workspace searches). Switch on with the earlier keys (`VITE_LIVE_MODULES=all`).

**Backend (new)**
- Models: `Issue` (`contractId, raisedBy, subject, status Open|Resolved, resolution, resolvedBy/At`), `AdminAction` (`adminId, actionType, actionDescription`, append-only). `Review.status` (`Visible|Flagged|Hidden`) already existed.
- Services: `adminService` (dashboard, users, user details, flag/restore, transactions, payment details, contracts + details, reviews + moderation, action log, open jobs, own profile), `issueService` (raise / list / resolve), `searchService` (client / freelancer / admin), `adminActionService` (`log`, `logPayout` - both never throw).
- Routes: `/api/admin/*` (all 16 reference endpoints, one `router.use(authenticate, requireRole('Admin'))` gate), `/api/issues` (`POST` Client/Freelancer, `GET` admin=all / others=own, `PATCH /:id/resolve` Admin), `/api/search/{client,freelancer,admin}`. Validators: `issueValidators`, `adminValidators` (single-message 400s carry the mock's exact strings).
- DTOs: `toIssueDTO` -> `{ issueId, relatedContractId, raisedBy, subject, status, raisedDate, resolution, resolvedAt }` (+ admin-list joins `jobTitle, raisedByName, clientName, freelancerName, contractStatus`); `toAdminActionDTO` (+ `adminName`). Every list is a plain array with the mock's joined fields.
- **Audit trail:** flag/restore, review moderation, issue resolution (`/issues/:id/resolve` and `/admin/issues/:id/resolve` share one service) and payout dispatch (`paymentController.payout` -> `logPayout`, wording copied from the mock) each append an `AdminAction`. Log failures are swallowed (logged to stderr) so an audit hiccup never undoes the action.
- Notifications: new issue -> all admins (`/admin/reports`); resolved -> the reporter (link to their contract page via the existing role-specific link table).
- Seed: one Open + one Resolved issue and two audit rows (`seedIssues`).

**Frontend:** every `adminApi.js` endpoint (19), `raiseIssue`, `clientSearchWorkspace`, `freelancerSearchWorkspace` are `hybrid('admin'|'search', mock, live)`; the mock bodies are untouched. `dispatchPayment` / `verifyPayment` call the Phase 4 routes (`POST /payments/:id/payout`, `/verify-admin`). No component changed.

**Deliberate deviations from the mocks (backend-side)**
1. An admin cannot flag **themselves** or any **Admin** account (400) - the mock allowed both (an admin could lock the platform out).
2. Only a **party of the contract** can raise an issue (strangers get 404); the reporter comes from the token; admins cannot raise issues. `resolve` is admin-only and only works once (400 `This issue has already been resolved.`).
3. Moderating a review to/from `Hidden` **recomputes the freelancer's rating** (hidden reviews are excluded from it).
4. `GET /admin/profile/:adminId` and `PUT` are limited to the admin's own profile; email changes are checked for uniqueness (409 with the register message).
5. Search: `/search/client?clientId=` naming someone else is refused (403) instead of silently ignored; blank query returns `[]`; input is regex-escaped; max 8 results.
6. Admin lists are capped at 500 rows (no pagination UI exists yet).

**Verified (run in the build sandbox, mongoose/dotenv shims - `NODE_PATH=/tmp/fakemods`)**
- New `tests/phase6.admin.test.js`: **14/14** (validators, raise/list/resolve incl. lost-race, flag/restore + log wording, moderation + rating recompute, dashboard, profile 409, payout log wording + non-throwing log, search escaping/shape/cap/routes).
- All earlier suites that can load without `express`/`bcryptjs` still pass under the shim (payments 8, phase2 jobs 13 + pure 21, phase3 pure 22 + services 33, phase4 22, phase5 messaging/notifications 10) = **143 tests**. `auth.contract`, `phase4.routes`, `phase5.dashboards`, `phase5.reviews` need `express`/`bcryptjs` and could NOT be loaded here (npm registry 403) - run the full `npm test` on your machine (expect 169: 145 + 10 + 14).
- Frontend: touched files parse; whole app bundles from `main.jsx` with esbuild (npm packages external). `vite build` / `eslint` NOT run.

**NOT verified / NOT written**
- Nothing ran against MongoDB, Express or a browser. **HTTP-level route tests for `/admin`, `/issues`, `/search` are not written** (no `express` here); `scripts/smoke-phase6.sh` (~60 checks incl. "flagged user is locked out on the next request" and "every admin action appears in the log") is `bash -n` only.
- Existing gap unchanged: refund initiation for a funded-but-unapproved milestone when a contract is cancelled/terminated is still undecided (admins can see the contract/issue but have no refund action).
- The admin pages have no server-side filter UI (they filter client-side); the `?status=` / `?role=` / `?search=` query params exist for when they do.

## Phase 7 — Cutover, Hardening, Deployment
1. Set `VITE_LIVE_MODULES=all`; walk every page as Client, Freelancer, Admin.
2. Delete `shared/mockData/*`, `utils/delay.js`, the mock `queryFn`s, `hybrid()`, and the TRANSITIONAL shim; re-enable Immer auto-freeze and RTK `immutableCheck` in `store.js` (the mock layer was the only reason they were off).
3. Backend: integration tests against `mongodb-memory-server`, `npm audit`, tighten CORS/helmet, indexes, pagination limits, request logging, graceful shutdown.
4. Deployment: env matrix (`MONGODB_URI`, strong `JWT_SECRET`, Razorpay live keys + webhook secret, `CLIENT_URL`), Dockerfile, health check, README runbook.

---

## Known limits of this hand-off
- Nothing was run against a real MongoDB or Razorpay (none in the build environment). Logic is covered by unit tests and an in-memory end-to-end test of the auth path; the first live run of each phase is its acceptance step.
- `LoginPage.jsx` has one unused import (`FiBriefcase`) and 6 other lint errors exist in untouched files — all pre-existing, left as-is.
- Registration now enforces the backend password rule (8+ chars, letter + number); the register form doesn't show that hint, so a weak password produces the backend's message in the existing error box.
