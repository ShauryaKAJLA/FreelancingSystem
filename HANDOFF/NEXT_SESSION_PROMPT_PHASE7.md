You are continuing a phased backend<->frontend integration of **FreelanceFlow** (React 19 + Vite + Redux Toolkit Query frontend; Express + MongoDB/Mongoose + JWT + Razorpay backend).

Attached: the latest project zip and `FreelanceFlow_All_APIs.pdf` (80-endpoint reference).

**Read first:** `INTEGRATION_PLAN.md` (rules, per-phase verified / NOT verified lists - Phase 5 and 6 blocks are the newest), `HANDOFF/SANDBOX_TIPS.md`, `HANDOFF/PHASE4_TO_7_BRIEFS.md` (Phase 7 brief). Golden rules unchanged: the frontend is the source of truth for shapes/strings; claim only what you actually ran.

**State:** Phases 1-6 are implemented in code + unit tests. NOTHING has run against a real MongoDB, real Razorpay, Express (in the build sandbox) or a browser. If I paste failures from `npm test`, the smoke scripts (`backend/scripts/smoke-phase2..6.sh`) or the browser, **fix those first**.

**Task: Phase 7 - Cutover, hardening, deployment**
1. Cutover: `VITE_LIVE_MODULES=all`; delete `shared/mockData/*`, `utils/delay.js`, every mock `queryFn` + `hybrid()/hybridAll()`, the TRANSITIONAL user-mirror shim in `authApi.js`; re-enable Immer auto-freeze and RTK `immutableCheck` in `store.js`.
2. Backend: HTTP-level route tests for messages / notifications / admin / issues / search (copy `tests/phase4.routes.test.js`), integration tests with `mongodb-memory-server`, `npm audit`, tighten CORS/helmet, indexes, pagination on the admin lists (currently capped at 500), request logging, graceful shutdown.
3. Decide + build (or explicitly defer) refund initiation for a funded-but-unapproved milestone when a contract is cancelled/terminated.
4. Deployment: env matrix (`MONGODB_URI`, strong `JWT_SECRET`, Razorpay live keys + webhook secret, `CLIENT_URL`), Dockerfile(s), health check, README runbook.
If you run low on room: finish the current file, add a DONE / NOT DONE block to the top of the Phase 7 brief, and zip (`FreelanceFlow_Integration_Phase7.zip`, exclude `node_modules`).
