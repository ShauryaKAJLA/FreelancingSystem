# FreelanceFlow — Phase 14: DB hardening tools, docs, paging polish

**Rule (unchanged):** frontend is the source of truth for field names/statuses/error strings. Claim only what you ran.

## Phase 14 session: DONE / NOT DONE
Sandbox limits unchanged (`npm install` 403, no MongoDB, no Express, no browser). **Step 0 (Phases 9–13) has still never been run.** Everything below is written but not executed against real runtimes, except where stated.

**DONE**
- **Indexes (backend models):** `Payment {clientId,paidAt,createdAt}` and `{freelancerId,paidAt,createdAt}` (match the user payment-list sort); `Bid {freelancerId,bidDate}` (My Bids) and `{jobId,status}` (pendingBids + per-job stats). Chosen from the actual sorts/filters in the services, NOT from `explain()` output — confirm with the script below and drop any that aren't used.
- **`npm run explain:lists`** (`scripts/explain-lists.js`): runs `explain('executionStats')` on 17 list query shapes against your seeded DB and flags COLLSCAN / in-memory SORT. Syntax-checked only.
- **`npm run test:integration`** (`tests/integration/db.integration.test.js`, mongodb-memory-server added as a devDependency): partial unique index on bids (+ re-bid after withdrawal), sparse unique `providerPaymentId`, `pendingBids` + status + paging on real data (incl. another client's job never leaking), discovery `$facet` paging (ties across 5 profiles -> no overlap, right total). **Ran only the skip path here** (it skips cleanly when the package/binary is missing; `npm test` does not include it).
- **Frontend:** `Pagination` now steps back to the last page when the current page overshoots (e.g. after withdrawing/deleting the only row on the last page) — fixes the Phase 12 known edge. Leftover "mock" comments removed.
- **Docs:** mock-era `INTEGRATION_PLAN.md`, `FEATURE_AUDIT.md`, `NEXT_STEPS.md` moved to `docs/archive/`; new live-only `INTEGRATION_PLAN.md` (architecture, paging contract, verification ladder).
- **Ran:** shim suites 167/167, `audit:api` 80/80 and 4/4, esbuild full-app bundle OK, TS checker no undefined names (same checks as Phase 13).

**NOT DONE / UNVERIFIED**
- Step 0: `npm install`, backend `npm test` incl. 5 Express suites, `vite build`, ESLint, browser click-through per role, Docker. The Pagination effect and all Phase 12–13 UI have never been rendered.
- The integration tests and explain script have never executed against Mongo; new indexes unmeasured.
- Concurrency tests (double fund/dispatch/resolve/accept/refund) not written.
- Deploy checklist items (live Razorpay webhook, backup/restore drill, small real payment) not done.
- `authSlice` still uses the legacy sessionStorage key `mockSession` (kept so live sessions survive; rename is cosmetic).

## Step 0 + new checks — run on your machine
```bash
cd backend && npm install && npm test && npm run audit:api          # all green, 80/80, 4/4
npm run test:integration                                            # 4 tests, none skipped (first run downloads mongod)
npm run seed -- --reset && npm run explain:lists                    # note any SCAN/MSORT lines
cd ../frontend && npm install && npm run build && npx eslint .
npm run dev        # click through client / freelancer / admin (see PHASE13_PLAN.md list); console: no "read only" / "state mutation" errors
docker compose up --build
```
Paste failures (and any SCAN/MSORT lines) into the next session.

## Next
1. Fix Step 0 findings (likely: Immer read-only mutations, response-shape mismatches, lint).
2. Concurrency tests on real Mongo: double fund / dispatch / resolve / accept-bid / refund must produce exactly one effect (use `Promise.all` of two calls; assert one 409/400 and one success).
3. Adjust indexes per `explain:lists` (add where SCAN/MSORT, drop unused).
4. Deploy: env matrix, `npm run create-admin`, live Razorpay webhook, backup + restore drill, one small real payment.
5. Later: Socket.IO messaging, RazorpayX payouts, "start conversation" picker, freelancer experience level, invite-to-job, automatic refund policy, CSV export, skills usage counts, text/Atlas search.

## Prompt for the next session
> Continue FreelanceFlow. Attached: the latest zip (Phase 14) and `FreelanceFlow_Revised_API_Endpoint_Reference.pdf`. Read `PHASE14_PLAN.md`, `PHASE13_PLAN.md`, `INTEGRATION_PLAN.md`, `HANDOFF/SANDBOX_TIPS.md`. My Step 0 results: *(paste failures, explain:lists SCAN/MSORT lines, or "all green")*. Fix those first, then follow the Next list. Frontend is the source of truth; claim only what you ran. If room runs low, finish the current file, update the DONE / NOT DONE block at the top of the plan, and zip.
