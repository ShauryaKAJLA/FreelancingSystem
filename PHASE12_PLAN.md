# FreelanceFlow — Phase 12: remaining UI paging

**Rule (unchanged):** frontend is the source of truth for field names/statuses/error strings. Claim only what you ran.

## Phase 12 session: DONE / NOT DONE
Sandbox limits unchanged: `npm install` 403, no MongoDB, no Express, no browser. So **Step 0 was NOT run**, and the cutover (work-order item 3, gated on Step 0 being green) was deliberately NOT started.

**DONE (work-order item 2 — remaining UI paging)**
- **Backend**
  - `GET /clients/:id/jobs?pendingBids=true` (new): only jobs with a Pending/Updated bid; combines with `status` and paging. Owner scope is applied first (`Job.distinct('_id', {clientId,...})` -> `bidService.jobIdsWithOpenBids`), so it can never widen. Any other value of `pendingBids` is ignored.
  - `GET /freelancers` (discovery) now accepts `?page&limit` (opt-in, plain array + `X-*` headers via `okPaged`). Paged mode uses `$facet` (rows + count); `_id` was added as the final sort tiebreaker (both modes) so pages never overlap on ties. No params = old behaviour (200 cap).
  - Notifications already paged server-side (`{items, unreadCount, pagination}`); unchanged.
- **Frontend** (all pages: server-side filters + `Pagination`; mock and live return `{rows, meta}`)
  - Freelancer Browse Jobs and client Find Freelancers: filters moved onto `useListParams` (debounced search, any filter change -> page 1; chips + "Clear all" via the new `resetFilters`). They are API query params, not URL params.
  - Client Jobs list: `status` / `PendingBids` (-> `pendingBids=true`) from the URL as before, now server-side + paged.
  - Freelancer My Bids: status filter server-side + paged; withdraw/terminate dialogs untouched.
  - Notifications: new `NotificationsPage` (all / unread-only, mark read, mark all, paging) at `/client|freelancer|admin/notifications`, linked from the bell dropdown ("View all notifications"). The dropdown still uses the unpaged `getMyNotifications`.
- **Tests / checks that actually ran**
  - `tests/phase12.paging.test.js` (4): pendingBids filter composition + owner scope, no-widening, discovery unpaged/paged pipelines. Shim run: **all 13 loadable suites pass, 167/167** (the 5 Express suites still can't load here). `npm run audit:api` 80/80, 4/4.
  - **Whole frontend bundles with esbuild** (`--bundle --packages=external` from `src/main.jsx`): every relative import/export in the app, including the ~16 pages from Phases 9-11 that were never rendered, resolves. This is NOT `vite build` and NOT a render.
  - `integration-tests/phase12/run.sh`: runs the MOCK queryFns in node (RTK/axios stubbed) — Jobs paging/status/pendingBids, Browse sort + no page overlap, My Bids status, Freelancers, Notifications paging/unread. All assertions true.
  - Changed files parse; crude unused-import scan clean.

**NOT DONE / UNVERIFIED**
- Everything needing real runtimes: `vite build`, ESLint, browser (MOCK + LIVE), Express suites, real Mongo, Docker. The new pages/hook changes have never been rendered.
- `$facet` discovery pipeline and `Job.distinct`/`Bid.distinct` only verified against stubs; run them on real Mongo (+ `explain()`).
- Known small edge: on My Bids / Contracts etc., withdrawing the only row on the last page can leave an empty page until the user clicks Previous (no auto-clamp in live mode).
- Mock "pending bids" counts `Pending` only while the backend counts `Pending|Updated` (pre-existing difference).
- Cutover, backend integration + concurrency tests, deploy: not started.

## Step 0 (the gate) — run on your machine
```bash
cd backend && npm install && npm test             # + phase12 (4); expect all suites green incl. the 5 Express ones
npm run audit:api                                 # 80/80, 4/4
npm run seed -- --reset && npm run dev
# $T = client token, ids from the seed:
curl -i -H "Authorization: Bearer $T" "localhost:5000/api/clients/<id>/jobs?pendingBids=true&page=1&limit=2"
curl -i -H "Authorization: Bearer $T" "localhost:5000/api/freelancers?page=2&limit=2&sortBy=ratingHigh"   # X-Total-Count etc.
curl -i -H "Authorization: Bearer $T" "localhost:5000/api/jobs/open?page=1&limit=2&sortBy=newest"
cd ../frontend && npm install && npm run build && npx eslint .
npm run dev                                       # MOCK: Browse Jobs, My Jobs (+Pending bids), My Bids, Find Freelancers, bell > View all, + P9-P11 pages
VITE_LIVE_MODULES=all npm run dev                 # LIVE: same
```
Paste failures into the next session.

## Next (work order carried forward)
1. Fix Step 0 findings.
2. **Cutover** (only when Step 0 is green): delete `shared/mockData/*`, `hybrid()`/`hybridAll()`, mock branches in every `*Api.js`, mirror shim, `pushNotification.js`; re-enable Immer/immutableCheck. One file group at a time with `vite build` after each. Acceptance: `grep -r mockData src` empty and the app works with `VITE_LIVE_MODULES` unset.
3. Backend tests needing runtimes: mongodb-memory-server integration (partial unique index on bids, sparse `fundedLock`/`providerPaymentId`, accept-bid ordering + rollback, aggregations, all new filters incl. pendingBids + discovery `$facet`); concurrency (double fund/dispatch/resolve/accept/refund); `explain()` on admin lists, contracts/payments/bids lists, client jobs `pendingBids`, discovery, search, transactions — add indexes if any scan.
4. Deploy: env matrix, `npm run create-admin`, live Razorpay webhook, backup + restore drill, one small real payment.
5. Later: Socket.IO messaging, RazorpayX payouts, "start conversation" picker, freelancer experience level, invite-to-job, automatic refund policy, CSV export, skills usage counts, text/Atlas search.

## Prompt for the next session
> Continue FreelanceFlow. Attached: the latest zip (Phase 12) and `FreelanceFlow_Revised_API_Endpoint_Reference.pdf`. Read `PHASE12_PLAN.md`, `PHASE11_PLAN.md`, `PHASE10_PLAN.md`, `PHASE9_PLAN.md`, `INTEGRATION_PLAN.md`, `HANDOFF/SANDBOX_TIPS.md`. My Step 0 results: *(paste failures or "all green")*. Fix those first, then follow the carried-forward work order (cutover next). Frontend is the source of truth; claim only what you ran. If room runs low, finish the current file, update the DONE / NOT DONE block at the top of the plan, and zip.
