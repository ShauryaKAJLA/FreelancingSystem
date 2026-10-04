> **STATUS (end of Phase 7 session):** see `PHASE8_PLAN.md` for the DONE / NOT DONE table. Done: refund endpoint (Option B), env validation, request ids/logging, helmet/CORS, readiness check, graceful shutdown, create-admin script, Dockerfiles/compose, runbook, register password hint, live-by-default `.env.example`. Not done: mock-layer deletion, integration/concurrency tests, pagination, audit, backups. Step 0 has still not been confirmed.

# FreelanceFlow — Phase 7 Plan: Verify, Cutover, Harden, Deploy

**Starting point:** Phases 1–6 are implemented in code + unit tests. Nothing has run against a real MongoDB, real Razorpay, the Express-based test files, `vite build`/`eslint`, or a browser.
**Rule (unchanged):** the frontend is the source of truth for field names, statuses and error strings. Claim only what you actually ran.

---

## Step 0 — Verify Phases 2–6 on your machine (before any new code)

Do this first. Every bug found here is cheaper to fix now than after the mock layer is deleted.

```bash
# Backend
cd backend && npm install && npm test          # expect ~169 passing
cp .env.example .env                           # MONGODB_URI, JWT_SECRET, RAZORPAY_KEY_ID/SECRET (test), RAZORPAY_WEBHOOK_SECRET
npm run seed -- --reset && npm run dev
bash scripts/smoke-phase2.sh                   # re-seed between scripts that mutate data
npm run seed -- --reset && bash scripts/smoke-phase3.sh
npm run seed -- --reset && bash scripts/smoke-phase4.sh
npm run seed -- --reset && bash scripts/smoke-phase5.sh
npm run seed -- --reset && bash scripts/smoke-phase6.sh

# Frontend
cd frontend && npm install && npm run build && npx eslint .
VITE_LIVE_MODULES=all npm run dev
```

**Browser walkthrough (all modules live)**

| Role | Path to click through |
|---|---|
| Client | Post job → Publish → accept bid → Start contract → fund milestone (Razorpay **test** card) → approve → review → raise issue |
| Freelancer | Browse → bid → edit/withdraw → submit milestone → request termination → message client → bell notification |
| Admin | Dashboard → flag/restore user → dispatch payout → moderate review → resolve issue → System Logs shows every action |

**Exit criteria:** all smoke scripts pass, `npm test` green, `vite build` + `eslint` clean, one full Razorpay test payment completed. Paste any failures into the next session; fix them before item 1 below.

---

## 1. Cutover (frontend)

- [ ] Set `VITE_LIVE_MODULES=all` as the default in `.env.example`
- [ ] Delete `shared/mockData/*` and `shared/utils/delay.js`
- [ ] Remove every mock `queryFn` and the `hybrid()` / `hybridAll()` helpers; each endpoint keeps only its live implementation
- [ ] Remove the TRANSITIONAL user-mirror shim in `auth/authApi.js` (`mirrorIntoMock`, `ensureRoleRecord`, the session-restore block)
- [ ] `store.js`: re-enable Immer auto-freeze and RTK `immutableCheck` (the mocks were the only reason they were off)
- [ ] Remove `pushNotification.js` and any remaining mock-only imports
- [ ] Fix pre-existing lint errors (`LoginPage`, `LandingPage`, `ThemeProvider`, unused `navigate` in freelancer `JobDetailsPage`)
- [ ] Add the register-form password hint (8+ chars, letter + number)

**Acceptance:** `grep -r mockData src` returns nothing; `npm run build` and `npx eslint .` pass; the app works with no mock code present.

## 2. Backend tests

- [ ] HTTP-level route tests (copy `tests/phase4.routes.test.js`) for: messages, notifications (incl. `read-all` route order), admin (role gate on every route), issues, search
- [ ] Integration tests with `mongodb-memory-server` covering what stubs can't: partial unique index on bids, `fundedLock` / `providerPaymentId` sparse indexes, accept-bid ordering + rollback, `countsForJobs` aggregation, conversation-list aggregation, sequential-funding ordering
- [ ] Concurrency tests: double-fund, double-dispatch, double-resolve, double-accept

## 3. Hardening

- [ ] `npm audit` and fix/justify findings
- [ ] CORS locked to `CLIENT_URL`; helmet configured (CSP for the API, HSTS in production)
- [ ] Indexes reviewed against real queries (`explain()` on lists, discovery, search, admin transactions)
- [ ] Pagination on admin lists (currently capped at 500 rows) and matching UI paging
- [ ] Search: consider a text index instead of regex scans on `Job.title` / `User.name`
- [ ] Request logging with request ids; no tokens/PII in logs
- [ ] Graceful shutdown (SIGTERM: stop accepting, drain, close Mongo)
- [ ] Rate limits reviewed per route group (auth, payments, messages, issues already have limiters)
- [ ] Startup validation of required env vars (fail fast in production)

## 4. Decision needed: refunds

Today `refund.processed` webhooks are handled, but nothing *initiates* a refund when a contract with a funded-but-unapproved milestone is cancelled or terminated.

| Option | Effort | Notes |
|---|---|---|
| A. Defer, document manual refund via Razorpay dashboard | none | Add an admin-visible flag on affected payments |
| B. Admin-initiated refund endpoint (`POST /payments/:id/refund`) | medium | Calls Razorpay refund API; audit-logged; only `Held` payments |
| C. Automatic refund on cancel/terminate | high | Needs policy for partial work and disputes |

**Recommendation:** B. Decide before building.

## 5. Deployment

- [ ] Env matrix: `MONGODB_URI`, strong `JWT_SECRET`, `RAZORPAY_KEY_ID/SECRET` (live), `RAZORPAY_WEBHOOK_SECRET`, `CLIENT_URL`, `NODE_ENV=production`, frontend `VITE_API_BASE_URL`
- [ ] `backend/Dockerfile` + `frontend/Dockerfile` (build → static host), `docker-compose.yml` for local (api + mongo)
- [ ] Health check on `/api/health`; add a DB-connectivity readiness check
- [ ] Create the admin account via a one-off script (admins cannot self-register); seed refuses to run in production
- [ ] Razorpay live webhook registered at `https://<host>/api/payments/webhook` (events `payment.captured, order.paid, payment.failed, refund.processed`; capture set to automatic)
- [ ] MongoDB backups + a restore drill
- [ ] Runbook in `backend/README.md`: deploy, rollback, rotate secrets, replay a failed webhook

---

## Later (not Phase 7)

- Real-time messaging/notifications via Socket.IO (polling works now)
- RazorpayX automated payouts (admin "dispatch" currently only *records* a payout)
- "Start new conversation" picker in Messages
- Server-side filtering UI on admin tables
- Freelancer-side experience level, "invite to job" (need a spec decision)

---

## Suggested order

1. Step 0 (verify) → fix findings
2. Item 4 decision (refunds)
3. Item 1 (cutover) → Item 2 (tests) → Item 3 (hardening)
4. Item 5 (deploy) → final live Razorpay smoke with a small real payment

## Prompt for the next session

> Continue the FreelanceFlow integration. Attached: the latest project zip and `FreelanceFlow_All_APIs.pdf`. Read `INTEGRATION_PLAN.md`, `HANDOFF/SANDBOX_TIPS.md` and `PHASE7_PLAN.md`. Here are the results of my Step 0 runs: *(paste failures or "all green")*. Fix those first, then do Phase 7 items in the order given. Frontend is the source of truth; claim only what you ran. If you run low on room, finish the current file, add a DONE / NOT DONE block to the top of `PHASE7_PLAN.md`, and zip.
