# FreelanceFlow — Phase 13: mock-layer cutover

**Rule (unchanged):** frontend is the source of truth for field names/statuses/error strings. Claim only what you ran.

## Phase 13 session: DONE / NOT DONE
Sandbox limits unchanged (`npm install` 403, no MongoDB, no Express, no browser). **Step 0 from Phase 12 has still never been run**, so this cutover is verified only statically. The Phase 12 zip is the rollback point (it still has the mock layer).

**DONE**
- **Mock layer deleted.** `shared/mockData/*`, `shared/utils/pushNotification.js`, `shared/utils/delay.js`, `hybrid()`/`hybridAll()`/`isLive()`, the mock branch of `payWithRazorpay`, the auth mirror shim + mock-session recovery, `mockPage`/`containsCI`, and the Immer `setAutoFreeze(false)` / `immutableCheck:false` workarounds (both defaults are back on).
- Method: AST codemod replaced every `hybrid(mod, mock, live)`, `hybridAll(...)`, `pick(...)` call (85 sites in 8 files) with its live function, then iteratively pruned unused imports/declarations. `*Api.js` total: 1,972 -> 620 lines.
- Job option lists/`EDITABLE_JOB_STATUSES` moved to `shared/constants/jobs.js` (CreateJob / EditJob / BrowseJobs re-pointed).
- `VITE_LIVE_MODULES` removed from `.env`, `.env.example`, `Dockerfile`; polling (notifications 30 s, messages) is now unconditional. README updated. `integration-tests/phase1`: mock half and the mock-mirror assertion removed.
- **Ran:** esbuild bundle of the whole app from `src/main.jsx` (all imports/exports resolve); TypeScript checker over `src` reporting **no TS2304/TS2552 (undefined names)** — verified the checker does flag a planted undefined name; `grep -r "mockData\|hybrid\|isLive\|pushNotification" src` is empty. Backend untouched this phase (167/167 shim, audit 80/80, 4/4 from Phase 12).

**NOT DONE / UNVERIFIED**
- `vite build`, ESLint, any browser render (the app now REQUIRES a running backend, so every page must be clicked through live), Express suites, Mongo, Docker. Highest-risk areas: pages that relied on mock-side effects or on mock-only response shapes (dashboards, contract details, milestone flows, admin pages), the 401 sign-out path now that Immer freezing is on (a page that mutates a cached RTK object will throw "read only" — fix by copying before mutating), and the login "Demo access" buttons.
- Leftover comments that still mention "mock" (http.js, adminApi.js, card.js, authSlice `mockSession` key kept for compatibility). Cosmetic.
- `FEATURE_AUDIT.md`, `NEXT_STEPS.md`, `INTEGRATION_PLAN.md` still describe the mock era.
- Backend integration/concurrency tests, `explain()`, deploy: not started.

## Step 0 (the gate) — now the only way to find regressions
```bash
cd backend && npm install && npm test && npm run audit:api       # expect all green (+ phase12: 4), 80/80, 4/4
npm run seed -- --reset && npm run dev
cd ../frontend && npm install && npm run build && npx eslint .
npm run dev      # backend must be running; sign in with each seeded role (Demo access buttons) and click through:
#  client: dashboard, Jobs (+Pending bids), create/edit job, accept bid, Contracts, milestones, fund (Razorpay test), Payments, Find Freelancers, profile, bell > View all
#  freelancer: dashboard, Browse Jobs, bid/withdraw, My Bids, contracts/milestones, Payments, profile
#  admin: every admin page incl. Skills, reviews, reports, transactions
#  watch the console for "Cannot assign to read only property" / "A state mutation was detected"
docker compose up --build
bash integration-tests/phase1/run.sh   # live auth e2e against the stub server
```
Paste failures into the next session.

## Next
1. Fix Step 0 findings (expect Immer read-only mutations and a few shape mismatches).
2. Backend runtime tests: mongodb-memory-server integration (partial unique index on bids, sparse `fundedLock`/`providerPaymentId`, accept-bid ordering + rollback, aggregations, pendingBids, discovery `$facet`); concurrency (double fund/dispatch/resolve/accept/refund); `explain()` on admin lists, contracts/payments/bids lists, client jobs `pendingBids`, discovery, search, transactions — add indexes if any scan.
3. Docs cleanup: rewrite `INTEGRATION_PLAN.md`/`FEATURE_AUDIT.md`/`NEXT_STEPS.md` for the live-only app; delete remaining "mock" comments.
4. Deploy: env matrix, `npm run create-admin`, live Razorpay webhook, backup + restore drill, one small real payment.
5. Later: Socket.IO messaging, RazorpayX payouts, "start conversation" picker, freelancer experience level, invite-to-job, automatic refund policy, CSV export, skills usage counts, text/Atlas search, auto-clamp to last page after a delete.

## Prompt for the next session
> Continue FreelanceFlow. Attached: the latest zip (Phase 13, live-only frontend) and `FreelanceFlow_Revised_API_Endpoint_Reference.pdf`. Read `PHASE13_PLAN.md`, `PHASE12_PLAN.md`, `PHASE11_PLAN.md`, `HANDOFF/SANDBOX_TIPS.md`. My Step 0 results: *(paste failures or "all green")*. Fix those first, then follow the Next list. Frontend is the source of truth; claim only what you ran. If room runs low, finish the current file, update the DONE / NOT DONE block at the top of the plan, and zip.
