# FreelanceFlow — Phase 11: paging for user-facing lists

**Rule (unchanged):** frontend is the source of truth for field names/statuses/error strings. Claim only what you ran.

## Phase 11 session: DONE / NOT DONE
Sandbox limits unchanged: no `npm install` (403), no MongoDB, no Express, no browser. Backend tests ran under the mongoose shim; frontend files were only parsed (TypeScript JSX parser) + unused-import checked. **No `vite build`, no ESLint, no browser.** No Step 0 results were supplied for Phases 9–10, so those remain unverified too.

**DONE**
- **Backend (opt-in, plain-array body, totals in `X-*` headers; no params = old behaviour):**
  - New `findPaged()` (`utils/pagination.js`) and shared `okPaged()` (`utils/response.js`; the admin controller now uses it instead of its private copy).
  - Paged + status-filtered: client jobs, client contracts, freelancer contracts, client payments, freelancer payments, freelancer bids. Paged: `GET /jobs/open` (controller passes `optPagination(req.query)` to the existing `listOpen`). Invalid `status` values are ignored, never widen scope (the owner id is always in the filter).
  - Freelancer bids stay unbounded without paging (cap 0 = no `.limit()` call, identical to before).
- **Tests:** `tests/phase11.paging.test.js` (5): `findPaged` (legacy cap / unbounded / paged), `okPaged` headers, client jobs, both contract lists, freelancer bids. Shim run: **163/163 pass** (all suites loadable without Express). `npm run audit:api` still 80/80, 4/4.
- **Frontend:**
  - New `shared/api/paging.js` (`mockPage`, `containsCI`, `livePaged`); `adminApi.js` now imports it instead of its inline copy. `useListParams` moved to `shared/hooks/` (admin pages re-pointed).
  - `getClientContracts`, `getClientPayments`, `getFreelancerContracts`, `getFreelancerPayments` now take `{ userId, page, limit, status }` and return `{ rows, meta }` in BOTH mock and live modes.
  - Four pages (client + freelancer Contracts and Payments lists) got a status filter + `Pagination`.

**NOT DONE / UNVERIFIED**
- Runtime verification of everything: `vite build`, ESLint, browser (mock + live), the 5 Express suites, real Mongo, Docker. **~16 pages edited in Phases 9–11 have never been rendered.**
- Backend paging exists but the UI does **not** use it yet for: client Jobs list (its "Pending bids" filter is derived client-side and needs a server filter first), freelancer My Bids (complex mutations on the page), Browse Jobs (`/jobs/open`), Notifications. The payments service paging has no unit test (needs a heavy multi-model stub); `/jobs/open` controller wiring and the new headers through real CORS are untested (need Express).
- Mock statuses for payments filter use `paymentStatus` values; confirm the seeded mock data covers them.
- Cutover/mock deletion, integration + concurrency tests, deploy: not started.

## Step 0 (the gate) — run on your machine
```bash
cd backend && npm install && npm test            # + phase9 (5), phase10 (2), phase11 (5)
npm run audit:api                                # 80/80, 4/4
npm run seed -- --reset && npm run dev
# with an admin/client token in $T and ids from the seed:
curl -i -H "Authorization: Bearer $T" "localhost:5000/api/clients/<id>/contracts?page=1&limit=2&status=Active"
curl -i -H "Authorization: Bearer $T" "localhost:5000/api/freelancers/<id>/payments?page=1&limit=2"
curl -i -H "Authorization: Bearer $T" "localhost:5000/api/jobs/open?page=1&limit=2&sortBy=newest"
cd ../frontend && npm install && npm run build && npx eslint .
npm run dev                                       # MOCK: client+freelancer Contracts/Payments (filter, next/prev), admin lists, Skills, profile reviews
VITE_LIVE_MODULES=all npm run dev                 # LIVE: same
```
Paste failures into the next session.
