# FreelanceFlow — Phase 15: concurrency tests, deploy tooling

**Rule (unchanged):** frontend is the source of truth for field names/statuses/error strings. Claim only what you ran.

## Phase 15 session: DONE / NOT DONE
Sandbox limits unchanged (`npm install` 403, no MongoDB, no Express, no browser). **Step 0 (Phases 9–14) has still never been run.** Nothing in this phase executed against Mongo.

**DONE (written; syntax-checked; skip path run)**
- `tests/integration/concurrency.integration.test.js` (7 tests, real Mongo via mongodb-memory-server, part of `npm run test:integration`): racing callers must give exactly one effect for
  accept-bid (two different bids; same bid 5x), fund/verify (same payment 5x; two different orders for one milestone -> `fundedLock` 409), payout dispatch (5 admins), refund (5 admins, Razorpay stub called once), dispute resolve (5 admins, one notification).
  Total integration suite: 11 tests, all skip cleanly without mongodb-memory-server (`# skipped 11`).
- `npm run preflight` (`scripts/preflight.js`): production env validation, Mongo connect, required indexes present, an Admin exists, warnings (test keys, non-https origin). Ran only the env-failure path (shim).
- `docs/DEPLOY.md`: env matrix, first-deploy steps, webhook setup, the one-small-real-payment smoke test, backup + restore drill, ops notes (incl. the 300 req/15 min rate limit vs. polling).
- Re-read the money paths while writing the tests (`applyCaptured`, `dispatchPayout`, `refundPayment`, `accept`, `resolve`): each uses a conditional update as its claim, so I expect the tests to pass — but that is reasoning, not a run.
- Unchanged and still green: shim suites 167/167, `audit:api` 80/80 and 4/4.

**NOT DONE / UNVERIFIED**
- Step 0: `npm install`, backend `npm test` (5 Express suites), `npm run test:integration` (real runs of 11 tests), `explain:lists`, `vite build`, ESLint, browser click-through per role, Docker.
- A failing concurrency test may be a test-assumption bug (fixture shapes, error `statusCode`) rather than a race bug — read the assertion message before changing services. Known soft spot to look at first: `accept()` compensation on failure restores the job to `Published` even if another path changed it meanwhile (only reachable on contract-create failure).
- Live Razorpay webhook, real payment, backup/restore drill: procedures documented, not performed (need your accounts).
- RazorpayX automated payouts: not built (dispatch only records the payout).

## Step 0 + new checks — run on your machine
```bash
cd backend && npm install && npm test && npm run audit:api
npm run test:integration                 # 11 tests, 0 skipped, 0 failed (first run downloads mongod)
npm run seed -- --reset && npm run explain:lists
cd ../frontend && npm install && npm run build && npx eslint .
npm run dev                               # click through client / freelancer / admin; console clean
docker compose up --build
# staging/production env loaded:
cd ../backend && NODE_ENV=production npm run preflight
```
Then follow `docs/DEPLOY.md` §3–4.

## Next
1. Fix Step 0 findings (expect Immer read-only mutations, shape mismatches, lint, possibly a concurrency-test fixture fix).
2. Adjust indexes per `explain:lists`.
3. Staging deploy + DEPLOY.md smoke test + restore drill; record RTO.
4. Features (pick by priority): RazorpayX automated payouts, Socket.IO messaging, "start conversation" picker, freelancer experience level, invite-to-job, automatic refund policy, CSV export, skills usage counts, text/Atlas search, per-user rate limiting.

## Prompt for the next session
> Continue FreelanceFlow. Attached: the latest zip (Phase 15) and `FreelanceFlow_Revised_API_Endpoint_Reference.pdf`. Read `PHASE15_PLAN.md`, `PHASE14_PLAN.md`, `PHASE13_PLAN.md`, `INTEGRATION_PLAN.md`, `docs/DEPLOY.md`, `HANDOFF/SANDBOX_TIPS.md`. My Step 0 results: *(paste failures, integration-test output, explain:lists SCAN/MSORT lines, preflight output, or "all green")*. Fix those first, then follow the Next list. Frontend is the source of truth; claim only what you ran. If room runs low, finish the current file, update the DONE / NOT DONE block at the top of the plan, and zip.
