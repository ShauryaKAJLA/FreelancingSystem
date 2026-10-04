# FreelanceFlow — current architecture & how to verify it (live-only, post Phase 13)

The pre-Phase-13 integration plan and mock-era feature audit are in `docs/archive/` (history only; they describe the deleted mock layer).

## Shape
- **backend/** Express + MongoDB (Mongoose). Envelope `{ success, message, data }`. Errors are `{ success:false, message, errors? }`; the frontend flattens them to one string (`toRtkError`).
- **frontend/** React + Redux Toolkit/RTK Query. Each module's `*Api.js` injects endpoints with `queryFn: live…` using `request()` / `livePaged()` (`shared/api`). No mock data exists any more; the app needs the API (`VITE_API_BASE_URL`, default `http://localhost:5000/api`).
- **Paging contract:** opt-in `?page&limit`; body stays a plain array and totals travel in `X-Total-Count / X-Page / X-Limit / X-Total-Pages` (exposed via CORS). No params = legacy capped array. Frontend: `livePaged` -> `{ rows, meta }`, `useListParams` (filters/debounced search/page), `Pagination` (also steps back if the page overshoots after a delete).
- **Routes contract:** `backend/scripts/api-contract.json`; `npm run audit:api` must print 80/80 and 4/4.

## Verification ladder (what each command proves)
| Command | Needs | Proves |
|---|---|---|
| `cd backend && npm test` | npm | unit + stubbed-model + Express route suites |
| `npm run audit:api` | node | every documented endpoint exists |
| `npm run test:integration` | npm (downloads a mongod binary) | real-Mongo: partial/sparse unique indexes, pendingBids, discovery `$facet` paging |
| `npm run explain:lists` | seeded Mongo | no COLLSCAN / in-memory SORT on every list query (use ≥10k docs for a meaningful answer) |
| `cd frontend && npm run build && npx eslint .` | npm | build + lint |
| manual click-through per role | backend + seed | pages render against real shapes |
| `bash integration-tests/phase1/run.sh` | npm | live auth e2e vs stub server |
| `docker compose up --build` | docker | images build, stack boots (web :8080, api :5000) |

## Demo data
`cd backend && npm run seed -- --reset` (accounts share the password in `VITE_DEMO_PASSWORD`, used by the login "Demo access" buttons). `npm run create-admin` for a real admin.
