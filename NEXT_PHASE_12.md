# FreelanceFlow — Phase 12 plan (next session)

**Rule:** frontend is the source of truth for field names/statuses/error strings. Claim only what you ran. If room runs low: finish the current file, update the DONE / NOT DONE block at the top of `PHASE12_PLAN.md`, zip.

## Start by reading
`PHASE11_PLAN.md`, `PHASE10_PLAN.md`, `PHASE9_PLAN.md`, `INTEGRATION_PLAN.md`, `HANDOFF/SANDBOX_TIPS.md`, `backend/scripts/api-contract.json`. Run `npm run audit:api` first (expect 80/80, 4/4).

## Step 0 (paste results; fix first)
Backend `npm test` + `npm run audit:api`; the paging curls in `PHASE11_PLAN.md`; frontend `npm run build` + `npx eslint .`; browser passes in MOCK and LIVE over: paged admin lists (P9), Admin > Skills + profile reviews (P10), client/freelancer Contracts + Payments lists (P11); `docker compose up --build`. Phases 9–11 edited ~16 pages never rendered — expect some fixes.

## Work order
1. **Fix Step 0 findings.**
2. **Remaining UI paging**, using `requestPaged`/`livePaged`, `Pagination`, `useListParams`:
   - Freelancer Browse Jobs (`/jobs/open` is paged server-side; move its local filters to query params).
   - Client Jobs list: add a server-side `pendingBids=true` filter (backend `jobService.listForClient`) so the derived "Pending bids" view can page; then page the UI with `status`.
   - Freelancer My Bids (`status` is already supported server-side; keep the withdraw/terminate dialogs working).
   - Notifications "view all" page (backend already pages with its own `{items, pagination}` shape).
   - Client `FreelancersListPage` filters -> existing `/freelancers` query params + paging (add `?page&limit` to discovery if missing).
3. **Cutover** (only when Step 0 is green): delete `shared/mockData/*`, `hybrid()`/`hybridAll()`, mock branches in every `*Api.js`, mirror shim, `pushNotification.js`; re-enable Immer/immutableCheck. One file group at a time with `vite build` after each. Acceptance: `grep -r mockData src` empty and the app works with `VITE_LIVE_MODULES` unset.
4. **Backend tests needing runtimes:** run the 5 Express suites (add route tests for the paged user-facing lists + header exposure); mongodb-memory-server integration (partial unique index on bids, sparse `fundedLock`/`providerPaymentId`, accept-bid ordering + rollback, aggregations, all new filters); concurrency (double fund/dispatch/resolve/accept/refund); `explain()` on admin lists, contracts/payments/bids lists, discovery, search, transactions — add indexes if any scan.
5. **Deploy:** env matrix, `npm run create-admin`, live Razorpay webhook, backup + restore drill, one small real payment.

## Later
Socket.IO real-time messaging, RazorpayX automated payouts, "start conversation" picker, freelancer experience level, invite-to-job, automatic refund policy, CSV export of filtered lists, skills usage counts on the admin Skills page, text/Atlas search.

## Prompt for the next session
> Continue FreelanceFlow. Attached: the latest zip (Phase 11) and `FreelanceFlow_Revised_API_Endpoint_Reference.pdf`. Read `NEXT_PHASE_12.md`, `PHASE11_PLAN.md`, `PHASE10_PLAN.md`, `PHASE9_PLAN.md`, `INTEGRATION_PLAN.md`, `HANDOFF/SANDBOX_TIPS.md`. My Step 0 results: *(paste failures or "all green")*. Fix those first, then follow the Phase 12 work order. Frontend is the source of truth; claim only what you ran. If room runs low, finish the current file, update the DONE / NOT DONE block at the top of the plan, and zip.
