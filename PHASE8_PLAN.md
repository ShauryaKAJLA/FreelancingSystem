# FreelanceFlow — Phase 8 Plan: Prove it, cut over, ship it

**Rule (unchanged):** the frontend is the source of truth for field names, statuses and error strings. Claim only what you actually ran.

## Phase 8 session update (DONE / NOT DONE)
Same sandbox limits as Phase 7 (no npm install, no Mongo, no browser). Shim run: `phase6.admin` + `phase7.hardening` = 22/22 pass.

**DONE**
- Admin list pagination, opt-in: `?page=&limit=` (limit max 100) on `/admin/users`, `/transactions`, `/contracts`, `/reviews`, `/actions`. Body stays a plain array; totals come in `X-Total-Count`, `X-Page`, `X-Limit`, `X-Total-Pages` (exposed via CORS). No params = old behaviour (500 cap). One new service test passes under the shim.
- Extra indexes matching real queries: Contract (client/freelancer/status + createdAt), Payment (status + createdAt), Review (status + createdAt), Job (clientId + createdAt). Additive only; not `explain()`-checked.
- `tests/phase8.routes.test.js`: role gates on all 16 admin routes, search per-role, issues, notifications `read-all` ordering + own-only, messages auth. **Written, not run** (needs Express).
- Admin UI: "Refund to client" button + confirm dialog on the admin payment page (shows for `Held` payments), `refundPayment` mutation (live-only; mock mode returns an explanatory error). **Not built or linted.**

**NOT DONE (unchanged from above unless listed)**
- Frontend mock-layer deletion / cutover (still gated on Step 0 + `vite build`).
- mongodb-memory-server integration tests, concurrency tests.
- Admin paging *UI* (the tables don't read the new headers yet; needs RTK `transformResponse` returning `{rows, meta}` or `meta` via `fetchBaseQuery`).
- Search text index: deliberately NOT switched. `$text` matches whole words/stems, so typing "Redes" would stop finding "Redesign"; regex substring is what the UI expects. Revisit only with a product decision (or an Atlas Search / prefix approach).
- `npm audit`, `explain()` review, backups, live Razorpay smoke.

**Step 0 additions:** `npm test` should now show the earlier count + `phase7.hardening` (7) + `phase8.routes` (5) + new route/pagination tests; `vite build` + `eslint` must pass on the edited `adminApi.js` and `PaymentDetailsPage.jsx`.

---

## What Phase 7 (this session) did — and did not — verify
Sandbox facts: `npm install` returned 403, no MongoDB, no browser. Everything below was checked with `node --check` and, where noted, `node --test` against a local mongoose shim (`HANDOFF/SANDBOX_TIPS.md`).

| Area | State | Evidence |
|---|---|---|
| Startup env validation (production fail-fast) | Built | 7 new tests pass under the shim (`tests/phase7.hardening.test.js`) |
| Request ids (`X-Request-Id`, in error bodies + logs), safe request logger (no query string, no tokens) | Built | Route tests written; **not run** (need Express) |
| Helmet CSP/HSTS config, exact-match CORS allow-list, `trust proxy` in production | Built | Route tests written; **not run** |
| `/api/health/ready` (DB readiness) | Built | Route test written; **not run** |
| Graceful shutdown (SIGTERM drain → close Mongo, 10 s force-exit) | Built | Syntax-checked only; needs a real run |
| Refund Option B: `POST /api/payments/:id/refund` (admin, Held only, atomic claim, released on Razorpay failure, audit-logged) | Built | 4 service tests pass under the shim; route gate test **not run**; real Razorpay refund **not run** |
| `npm run create-admin` (env-driven, 12+ char password) | Built | Input validation tested; DB write **not run** |
| Dockerfiles (api, web+nginx), `docker-compose.yml` | Written | **Never built** |
| Runbook in `backend/README.md` | Written | — |
| Frontend: `.env.example` defaults to `VITE_LIVE_MODULES=all`; register-form password hint | Done | **`vite build`/eslint not run** |

Existing suite under the shim: the same two failures occur on the **unmodified** Phase 6 code (`phase2.pure` "discovery query…", `phase5.messaging` "conversation…") — probably shim artifacts, but confirm with a real `npm test`. Files needing `express`/`bcryptjs` could not run at all.

## NOT done (deliberately or for lack of a runtime)
1. **Frontend cutover deletion** (`shared/mockData/*`, `hybrid()` helpers, mirror shim, Immer/immutableCheck re-enable, `pushNotification.js`, lint fixes). It is destructive and cannot be validated without `vite build` + a browser, and Step 0 has not been confirmed green. Do it only after Step 0.
2. Integration tests with `mongodb-memory-server` and concurrency tests.
3. HTTP route tests for messages / notifications / admin / issues / search.
4. Admin pagination + UI paging; text index for search; `explain()` review.
5. `npm audit`.
6. Admin UI button for refunds (endpoint exists).
7. Automated backups + restore drill; live Razorpay smoke.

## Step 0 (still the gate) — run on your machine
```bash
cd backend && npm install && npm test        # expect the old ~169 + 11 new (7 hardening + 3 route + 1 refund gate)
npm audit
cp .env.example .env && npm run seed -- --reset && npm run dev
# smoke-phase2..6 with a re-seed between each (as in PHASE7_PLAN.md)
curl -i localhost:5000/api/health/ready       # expect 200
# Refund check (Razorpay TEST keys): fund a milestone, then as admin:
#   POST /api/payments/<paymentId>/refund {"reason":"test"}  -> 200; webhook later -> status Refunded
cd ../frontend && npm install && npm run build && npx eslint .
VITE_LIVE_MODULES=all npm run dev             # browser walkthrough table in PHASE7_PLAN.md
docker compose up --build                     # first-ever build of the new Dockerfiles
```
Paste failures into the next session.

## Work order
1. Fix Step 0 findings (esp. anything in the new route tests, Docker builds, the 2 shim-suspect tests).
2. **Cutover** (PHASE7_PLAN.md item 1) — one file group at a time, `vite build` after each; acceptance `grep -r mockData src` empty.
3. Backend tests: route tests (messages, notifications incl. `read-all` order, admin role gate on every route, issues, search); memory-server integration (partial unique index on bids, `fundedLock`/`providerPaymentId` sparse indexes, accept-bid ordering + rollback, aggregations); concurrency (double fund/dispatch/resolve/accept/**refund**).
4. Admin refund button on the payment details page + "Refund Initiated" wording in the logs; optionally flag payments whose contract was cancelled/terminated while `Held`.
5. Pagination on admin lists (+ UI), text index for search, `explain()` on list/discovery/search/transactions.
6. Deploy: env matrix, create admin, register live webhook, backup + restore drill, then one small real payment.

## Later
Socket.IO real-time, RazorpayX automated payouts, "start conversation" picker, server-side filters on admin tables, freelancer experience level, invite-to-job, automatic refund policy (Option C).

## Prompt for the next session
> Continue FreelanceFlow. Attached: the latest zip and `FreelanceFlow_All_APIs.pdf`. Read `PHASE8_PLAN.md`, `PHASE7_PLAN.md`, `INTEGRATION_PLAN.md`, `HANDOFF/SANDBOX_TIPS.md`. My Step 0 results: *(paste failures or "all green")*. Fix those first, then follow the Phase 8 work order. Frontend is the source of truth; claim only what you ran. If room runs low, finish the current file, update the DONE / NOT DONE table at the top of `PHASE8_PLAN.md`, and zip.
