# FreelanceFlow — Phase 10 plan (next session)

**Rule:** frontend is the source of truth for field names/statuses/error strings. Claim only what you ran. If room runs low: finish the current file, update the DONE / NOT DONE block at the top of `PHASE10_PLAN.md`, zip.

## Start by reading
`PHASE9_PLAN.md`, `PHASE8_PLAN.md`, `INTEGRATION_PLAN.md`, `HANDOFF/SANDBOX_TIPS.md`, and `backend/scripts/api-contract.json`. Run `npm run audit:api` first (expect 80/80).

## Step 0 (paste results into the chat)
Backend `npm test`, `npm run audit:api`, frontend `npm run build` + `npx eslint .`, browser pass over the 7 paged admin pages in BOTH mock and live mode, `docker compose up --build`. Fix these before anything else — Phase 9 edited seven admin pages that were never rendered.

## Work order
1. **Fix Step 0 findings.**
2. **Close the PDF's "dedicated frontend gaps"** (backend routes already exist; the frontend uses mock/local state):
   - Messaging: `POST /messages`, `GET /messages/:userId`, `GET /messages/conversation/:otherUserId` as real RTK operations (`messagesApi.js`), unread counts, optional polling.
   - Skills: `GET/POST/PUT/DELETE /skills(/:id)` as real operations in `skillsApi.js`; **admin skills management page** (add/rename/delete, delete blocked or warned when in use); make Create Job / Profile / filters read skills from the API.
   - Reviews: `GET /users/:userId/reviews` as its own query; use it on the freelancer public profile and client freelancer-view page (replace reviews-embedded-in-profile reads).
3. **Paging for the remaining lists** (client/freelancer jobs, contracts, payments, bids; `/issues`, `/notifications`) using the same `requestPaged` + `Pagination` + `useListParams` pattern; add server filters where the pages still filter locally (client `FreelancersListPage` etc.).
4. **Cutover** (only after Step 0 is green): delete `shared/mockData/*`, `hybrid()` helpers, mirror shim, `pushNotification.js`; re-enable Immer/immutableCheck; acceptance `grep -r mockData src` empty. One file group at a time, `vite build` after each.
5. **Backend tests that need real runtimes:** run the 5 Express suites; mongodb-memory-server integration (partial unique index on bids, sparse `fundedLock`/`providerPaymentId`, accept-bid ordering + rollback, aggregations); concurrency (double fund/dispatch/resolve/accept/refund); `explain()` on admin lists, discovery, search, transactions with the new filters.
6. **Deploy:** env matrix, `npm run create-admin`, register live Razorpay webhook, backup + restore drill, one small real payment.

## Later
Socket.IO real-time messaging, RazorpayX automated payouts, "start conversation" picker, freelancer experience level, invite-to-job, automatic refund policy, admin export (CSV) of filtered lists, text/Atlas search for substring search at scale.

## Prompt for the next session
> Continue FreelanceFlow. Attached: the latest zip (Phase 9) and `FreelanceFlow_Revised_API_Endpoint_Reference.pdf`. Read `NEXT_PHASE_10.md`, `PHASE9_PLAN.md`, `PHASE8_PLAN.md`, `INTEGRATION_PLAN.md`, `HANDOFF/SANDBOX_TIPS.md`. My Step 0 results: *(paste failures or "all green")*. Fix those first, then follow the Phase 10 work order. Frontend is the source of truth; claim only what you ran. If room runs low, finish the current file, update the DONE / NOT DONE block at the top of the plan, and zip.
