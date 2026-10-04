# FreelanceFlow Backend

Express + MongoDB (Mongoose) API. **Status: Phases 1-2 (foundation, auth, profiles) plus Phase 5 (Razorpay payments) and Phase 6 (messaging, notifications, reviews) implemented. Frontend integration: Phase 1 (auth) done - see `../INTEGRATION_PLAN.md`.**

## Run
```bash
cp .env.example .env      # set JWT_SECRET; MongoDB must be running
npm install
npm run seed              # optional demo accounts (password: Password@123)
npm run dev
```
`GET http://localhost:5000/api/health` -> 200 `{ "success": true, "message": "FreelanceFlow API is running" }`

## Frontend integration contract (Integration Phase 1)
The React app is the source of truth for response shapes. Services return DTOs from `src/utils/dto.js`
(`userId`, not `_id`). `POST /api/auth/login` accepts `{ email, password, role? }`; `role` (the login screen's selector)
is verified only after the password, so it cannot reveal which emails exist. Both auth endpoints return
`{ token, user: { userId, name, email, role } }`. Errors keep `{ success:false, message, errors? }`; the frontend flattens
them into the plain string its components display.

## Endpoints - Phase 2
| Method | Path | Access |
|---|---|---|
| POST | /api/auth/register | public (roles: Client, Freelancer) |
| POST | /api/auth/login | public |
| GET | /api/auth/me | any authenticated user |
| GET | /api/freelancers/:freelancerId/profile | authenticated |
| PUT | /api/freelancers/:freelancerId/profile | that freelancer, or Admin |
| GET | /api/clients/:clientId/profile | authenticated |
| PUT | /api/clients/:clientId/profile | that client, or Admin |

Responses: `{ success, message, data }`; errors: `{ success:false, message, errors? }`. Send `Authorization: Bearer <token>`.

## Quick test
```bash
curl -X POST localhost:5000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"meera.iyer@dev.com","password":"Password@123"}'
curl -X PUT localhost:5000/api/freelancers/<userId>/profile -H "Authorization: Bearer <token>" \
  -H 'Content-Type: application/json' -d '{"bio":"Hello","hourlyRate":50}'
```

## Design decisions
- Admin accounts can't self-register (privilege escalation); create them via seed/DB.
- Profile ids equal user ids, matching the frontend (`freelancerId: 'u4'`).
- `rating` is server-controlled and cannot be written via the profile API; body fields are whitelisted.
- Token holders are re-checked against the DB each request, so flagging a user takes effect immediately.
- Login uses one generic error and a dummy hash compare to avoid revealing which emails exist.
- Strict `JWT_SECRET` check in production; seed refuses to run in production.
- Standalone MongoDB has no transactions; registration compensates by deleting the user if profile creation fails.

## Endpoints - Phase 5 (payments)
All money rules are enforced server-side; the amount is always read from the milestone, never from the request.

| Method | Path | Access |
|---|---|---|
| POST | /api/payments/create-order `{ milestoneId }` | Client who owns the contract. Returns `{ orderId, amount(paise), currency, keyId, paymentId }` for Checkout |
| POST | /api/payments/verify `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }` | the paying Client |
| POST | /api/payments/webhook | Razorpay only (HMAC-signed, raw body, idempotent) |
| GET | /api/payments | Admin (`?status=Awaiting Payout&page=&limit=`) |
| POST | /api/payments/:paymentId/payout `{ payoutReference? }` | Admin - records dispatch, `Awaiting Payout -> Paid` |
| GET | /api/payments/:paymentId | the client, the freelancer, or Admin |
| GET | /api/clients/:clientId/payments | that client / Admin |
| GET | /api/freelancers/:freelancerId/payments | that freelancer / Admin |
| GET / POST | /api/clients/:clientId/payment-methods | that client (Admin can list) |
| DELETE | /api/payment-methods/:id | owner |
| PATCH | /api/payment-methods/:id/default | owner |

`create-order`, `verify`, `webhook`, `payout` are additions beyond the 80-endpoint reference (as the Phase 5 brief recommends).

**Payment status flow**
`Pending -> Held` (verified/captured) `-> Awaiting Payout` (milestone approved) `-> Paid` (admin dispatch).
`Pending/Failed -> Failed` on `payment.failed` (the same order stays payable, so a retry works); `Held/Awaiting Payout -> Refunded` on `refund.processed`.

**Razorpay setup**
1. Put test keys in `.env`: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`.
2. Dashboard > Webhooks: URL `https://<host>/api/payments/webhook`, choose a secret -> `RAZORPAY_WEBHOOK_SECRET`; events `payment.captured`, `order.paid`, `payment.failed`, `refund.processed`. Use a tunnel (ngrok) locally.
3. Keep payment capture on **automatic** in the dashboard so `payment.captured` fires.

**Frontend hookup** (replaces `payWithRazorpay` in `shared/utils/razorpay.js`)
```js
const order = await api.post('/payments/create-order', { milestoneId })        // amount comes from the server
const rzp = new window.Razorpay({
  key: order.keyId, order_id: order.orderId, amount: order.amount, currency: order.currency, name: 'FreelanceFlow',
  handler: (r) => api.post('/payments/verify', r),   // r = { razorpay_order_id, razorpay_payment_id, razorpay_signature }
})
rzp.open()
```

**Hook for Phase 4 (milestone approval)**: in the same handler that sets a milestone `Completed`, call
`require('./services/paymentService').markMilestoneApproved(milestoneId)` so the payment moves `Held -> Awaiting Payout`
and admins are notified. Milestones that are funded must also be blocked from edit/delete in Phase 4.

## Endpoints - Phase 6
| Method | Path | Access |
|---|---|---|
| POST | /api/messages `{ receiverId, messageText }` | authenticated; sender = token user |
| GET | /api/messages/:userId (`?view=conversations` for the inbox list; else paged flat list) | that user only |
| GET | /api/messages/conversation/:otherUserId (`?page&limit`, default 50, marks incoming as read) | the two participants |
| GET | /api/notifications/:userId (`?unreadOnly=true&page&limit`, includes `unreadCount`) | that user only |
| PATCH | /api/notifications/:notificationId/read | owner |
| PATCH | /api/notifications/read-all | caller |
| POST | /api/contracts/:contractId/reviews `{ rating 1-5, comment? }` | contract client or freelancer, contract `Completed`, one review each |
| GET | /api/users/:userId/reviews (`?page&limit`) | authenticated; returns `summary` (average, count); `Hidden` reviews only visible to Admin |

Notes: the reviewee is derived from the contract (not the body); submitting a review recomputes `FreelancerProfile.rating`.
Messaging between non-admin users requires a shared contract (`MESSAGING_REQUIRES_CONTRACT` in `models/constants.js`).
`notificationService.notify / notifyMany / notifyAdmins` never throw - call them from Phase 3/4 for bids, contracts,
milestones and issues. Moderation endpoints for `Flagged/Hidden` reviews are intentionally not built (pending DB design confirmation).

## Design decisions (Phase 5-6)
- No Razorpay SDK: Node 18+ `fetch` + `crypto`, so no new dependencies. Signatures use constant-time comparison.
- Double-funding is impossible: a sparse unique `fundedLock` index plus atomic `findOneAndUpdate` transitions; `/verify` replays are idempotent.
- Webhook events are claimed in `WebhookEvent` before processing (duplicate deliveries ack'd, failures release the claim so Razorpay retries).
- Raw card data is refused by the API; saved methods hold brand / last4 / expiry / UPI id only.
- Mailboxes and notifications are private - not even admins read another user's.
- Sequential funding (previous milestone must be approved first) follows the contract wording; toggle `ENFORCE_SEQUENTIAL_FUNDING`.

## Phase 3-4 stand-ins
Jobs, bids, contracts and milestones are not built yet. Minimal `Job`, `Contract`, `Milestone` models exist only because
payments and reviews depend on them; `npm run seed` creates an Active contract (Aisha <-> Meera, one unfunded Rs 21,000
milestone) and a Completed contract (Rohan <-> Karan, ready to review). Replace/extend these models in Phase 3-4.

## Tests
`npm test` runs offline unit tests (signature verification, paise conversion, validators, auth contract with stubbed models).

## Phase 5 response shapes (messaging / notifications)
Messages: `{ messageId, senderId, receiverId, messageText, sentAt, read }`; `GET /messages/:userId?view=conversations` -> `items:[{ userId, name, role, unreadCount, lastMessage }]`. Notifications: `{ notificationId, userId, type, title, message, link, read, createdAt }` where `link` is the recipient's role-specific frontend route (`notificationService.linkFor`).

## Phase 6 endpoints (admin, issues, search)
| Method | Path | Access |
|---|---|---|
| GET | /api/admin/dashboard · /users · /users/:id · /transactions · /payments/:id · /contracts · /contracts/:id · /reviews · /issues · /actions · /jobs/open | Admin |
| PATCH | /api/admin/users/:id/status (flag/restore) · /reviews/:id `{action: approve\|flag\|hide}` · /issues/:id/resolve | Admin |
| GET / PUT | /api/admin/profile/:adminId | that admin |
| POST | /api/issues `{contractId, subject}` | Client / Freelancer who is a party |
| GET | /api/issues (`?status=`) | Admin = all, others = own |
| PATCH | /api/issues/:id/resolve `{resolution?}` | Admin |
| GET | /api/search/client · /freelancer · /admin `?query=` | that role |
Admin dispatch/verify of payouts stays on `POST /api/payments/:id/payout` and `/verify-admin` (Phase 4). Every admin write appends an `AdminAction` (read it via `GET /api/admin/actions`). Acceptance: `bash scripts/smoke-phase6.sh`.

## Not yet done
Phases 3-4 (jobs, bids, contracts, milestones endpoints), Phases 7-9 (admin, integration tests, deployment), review moderation,
RazorpayX automated payouts, real-time messaging (Socket.IO), and connecting the frontend RTK Query layer.
**Not executed:** this environment had no network, so `npm install` and a live MongoDB/Razorpay run were impossible. All files
are syntax-checked and the pure logic is unit-tested, but the service/route layer has not run end-to-end - run through the
flow once with Razorpay test keys before relying on it.

## Phase 2 endpoints (jobs, skills, profiles, discovery)

| Method | Path | Who |
|---|---|---|
| GET | `/api/skills`, `/api/skills/:id` | any signed-in user |
| POST / PUT / DELETE | `/api/skills`, `/api/skills/:id` | Admin (delete refused while a skill is in use) |
| GET | `/api/clients/:clientId/jobs` | owner client / Admin |
| POST | `/api/jobs` | Client (owner = caller, never the body) |
| GET | `/api/jobs/:jobId` | owner / Admin; Freelancers only if not Draft |
| PUT | `/api/jobs/:jobId` | owner / Admin, only while Draft or Published |
| PATCH | `/api/jobs/:jobId/publish` · `/cancel` | owner / Admin (Draft -> Published · Published -> Cancelled) |
| DELETE | `/api/jobs/:jobId` | owner / Admin, Draft only |
| GET | `/api/jobs/open` | Freelancer / Admin - `search, skillId, category, experienceLevel, budgetMin, budgetMax, sortBy` |
| GET | `/api/freelancers` | Client / Admin - `search, skillId, minRating, minRate, maxRate, sortBy`; flagged users excluded |
| GET | `/api/freelancers/:id` · `/:id/profile` | any signed-in user (payout account only for owner/admin) |
| PUT | `/api/freelancers/:id/profile` · `/extras` | owner / Admin |
| GET | `/api/freelancers/:id/jobs/:jobId` | owner Freelancer / Admin |
| GET / PUT | `/api/clients/:id/profile` | any signed-in user / owner (email only for owner/admin) |

Reseed for Phase 2 data: `npm run seed -- --reset` (dev only). Acceptance: `bash scripts/smoke-phase2.sh`.

---

# Runbook (Phase 7)

## Required production environment
`NODE_ENV=production`, `MONGODB_URI` (non-local), `JWT_SECRET` (32+ chars), `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `CLIENT_URL` (exact origin(s), comma separated). Frontend build args: `VITE_API_BASE_URL`, `VITE_RAZORPAY_KEY_ID`. The API **refuses to start** in production if any is missing/weak and lists every problem at once.

## Health
`GET /api/health` = liveness. `GET /api/health/ready` = readiness (200 only when MongoDB is connected, else 503). Point the load balancer / orchestrator at `/ready`.

## Deploy
1. `docker build -t freelanceflow-api ./backend` and `docker build -t freelanceflow-web --build-arg VITE_API_BASE_URL=https://<api-host>/api --build-arg VITE_RAZORPAY_KEY_ID=<live key id> ./frontend`.
2. Run the API with the env above. Put TLS in front (the API trusts one proxy hop in production).
3. Create the first admin (one-off; admins cannot self-register; `npm run seed` refuses to run in production):
   `ADMIN_NAME="Ops" ADMIN_EMAIL=ops@example.com ADMIN_PASSWORD='<12+ chars, letter+number>' npm run create-admin`
4. Register the Razorpay webhook: `https://<api-host>/api/payments/webhook`, events `payment.captured, order.paid, payment.failed, refund.processed`, same secret as `RAZORPAY_WEBHOOK_SECRET`; payment capture = automatic.

## Rollback
Redeploy the previous image tag. Schema changes so far are additive (Phase 7 added optional `Payment.refund*` fields), so an older image still runs against newer data.

## Rotate secrets
- `JWT_SECRET`: set a new value and restart; every user is signed out (acceptable) — no data migration.
- Razorpay key: create a new key in the dashboard, update `RAZORPAY_KEY_*` (+ the frontend `VITE_RAZORPAY_KEY_ID` build arg), redeploy, then revoke the old key.
- Webhook secret: change it in the Razorpay dashboard and `RAZORPAY_WEBHOOK_SECRET` back-to-back; events sent in between fail signature checks and Razorpay retries them.

## Replay a failed webhook
Razorpay Dashboard → Webhooks → the delivery → *Retry*. Handling is idempotent (events are de-duplicated in `WebhookEvent`, state changes are guarded), so retrying is always safe. If the dashboard no longer offers it, ask the client to press "Verify" on the payment (`POST /api/payments/verify`) or use the admin `verify-admin` route; both converge on the same state.

## Refunds (Option B, admin-initiated)
`POST /api/payments/:paymentId/refund` (Admin, body `{ "reason": "..." }`). Only `Held` payments (milestone not yet approved). It records the claim, calls Razorpay's refund API, and the `refund.processed` webhook flips the payment to `Refunded` and un-funds the milestone. If Razorpay rejects the call the claim is released and the request can be retried. Every refund is written to System Logs ("Refund Initiated"). Approved/paid-out money is intentionally not refundable here (needs a dispute decision).
**Not yet exposed in the admin UI** — see PHASE8_PLAN.md.

## Backups (not automated by this repo)
Use MongoDB Atlas continuous backup, or `mongodump --uri "$MONGODB_URI" --gzip --archive=ff.gz` on a schedule. Restore drill: `mongorestore --uri "<staging uri>" --gzip --archive=ff.gz --drop`, then boot the API against staging and check `/api/health/ready` and a login. Do this once before go-live and record the date.

## Phase 9: admin list filters + paging, API contract audit
- Admin lists accept opt-in `?page=&limit=` (max 100; totals in `X-Total-Count`/`X-Page`/`X-Limit`/`X-Total-Pages`) on `/admin/users|transactions|contracts|reviews|issues|actions|jobs/open`. No params = legacy 500-row array.
- Filters: users `role,status,search`; transactions `status`; contracts `status`; reviews `status`; issues `status`; actions `actionType,search`; open jobs `search,category,experienceLevel,budgetMin,budgetMax,sortBy` (always `Published` only).
- `npm run audit:api` statically compares the Express route table with `scripts/api-contract.json` (the 80 PDF endpoints + the live wire paths of the 3 "frontend-only" operations). Exit code 1 if anything is unrouted.

## Phase 10: skills audit trail
`POST/PUT/DELETE /api/skills` (Admin) now write System Log entries (`Skill Added` / `Skill Renamed` / `Skill Deleted`). Failed writes (duplicate name, skill in use -> 409) are not logged.

## Phase 11: opt-in paging on user-facing lists
Same contract as the admin lists (`?page=&limit=` max 100, totals in `X-Total-Count`/`X-Page`/`X-Limit`/`X-Total-Pages`, body stays a plain array; no params = legacy behaviour): `GET /clients/:id/jobs` (+`status`), `/clients/:id/contracts` and `/freelancers/:id/contracts` (+`status`), `/clients/:id/payments` and `/freelancers/:id/payments` (+`status`), `/freelancers/:id/bids` (+`status`), `/jobs/open`. Helpers: `utils/pagination.js#findPaged`, `utils/response.js#okPaged`.
