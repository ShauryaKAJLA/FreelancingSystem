# FreelanceFlow — Phase 11 plan (next session)

**Rule:** frontend is the source of truth for field names/statuses/error strings. Claim only what you ran. If room runs low: finish the current file, update the DONE / NOT DONE block at the top of `PHASE11_PLAN.md`, zip.

## Start by reading
`PHASE10_PLAN.md`, `PHASE9_PLAN.md`, `PHASE8_PLAN.md`, `INTEGRATION_PLAN.md`, `HANDOFF/SANDBOX_TIPS.md`, `backend/scripts/api-contract.json`. Run `npm run audit:api` first (expect 80/80, 4/4).

## Step 0 (paste results; fix first)
Backend `npm test` + `npm run audit:api`; frontend `npm run build` + `npx eslint .`; browser passes in MOCK and LIVE over: the 7 paged admin lists (Phase 9), Admin > Skills, freelancer profile reviews, client freelancer-view reviews (Phase 10); `docker compose up --build`. Phases 9 and 10 edited ~12 pages that have never been rendered.

## Work order
1. **Fix Step 0 findings.**
2. **Paging + server filters for the remaining lists**, reusing `requestPaged`, `Pagination`, `useListParams`: client jobs / contracts / payments, freelancer bids / contracts / payments / browse jobs, `/issues`, `/notifications` (+ notifications dropdown "view all"). Backend: add opt-in `?page&limit` + headers to those services (pattern: `optPagination` + `withPageInfo`, tests like `phase9.admin-filters.test.js`). Move local filtering (client `FreelancersListPage`, etc.) to query params where the backend already supports them.
3. **Cutover** (only when Step 0 is green): delete `shared/mockData/*`, `hybrid()`/`hybridAll()` helpers, mock branches in every `*Api.js`, the mirror shim, `pushNotification.js`; re-enable Immer/immutableCheck. One file group at a time, `vite build` after each. Acceptance: `grep -r "mockData" src` empty, app works with `VITE_LIVE_MODULES` unset.
4. **Backend tests needing runtimes:** run the 5 Express suites; mongodb-memory-server integration (partial unique index on bids, sparse `fundedLock`/`providerPaymentId`, accept-bid ordering + rollback, aggregations, new filters); concurrency (double fund/dispatch/resolve/accept/refund); `explain()` on admin lists, discovery, search, transactions.
5. **Deploy:** env matrix, `npm run create-admin`, live Razorpay webhook, backup + restore drill, one small real payment.

## Later
Socket.IO real-time messaging, RazorpayX automated payouts, "start conversation" picker, freelancer experience level, invite-to-job, automatic refund policy, CSV export of filtered admin lists, skills usage counts on the admin Skills page, text/Atlas search.

## Prompt for the next session
> Continue FreelanceFlow. Attached: the latest zip (Phase 10) and `FreelanceFlow_Revised_API_Endpoint_Reference.pdf`. Read `NEXT_PHASE_11.md`, `PHASE10_PLAN.md`, `PHASE9_PLAN.md`, `PHASE8_PLAN.md`, `INTEGRATION_PLAN.md`, `HANDOFF/SANDBOX_TIPS.md`. My Step 0 results: *(paste failures or "all green")*. Fix those first, then follow the Phase 11 work order. Frontend is the source of truth; claim only what you ran. If room runs low, finish the current file, update the DONE / NOT DONE block at the top of the plan, and zip.
