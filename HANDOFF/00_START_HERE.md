# FreelanceFlow - hand-off pack (Phases 1-6 done in code + unit tests; Phase 7 = cutover/hardening/deployment)

## Steps
1. **Run everything on your machine first** (the build sandbox had no MongoDB, no Razorpay route, and `npm install` was blocked - 403):
   `cd backend && npm install && npm test` (expect ~169 passing; the 4 Express-based suites `auth.contract`, `phase4.routes`, `phase5.dashboards`, `phase5.reviews` have not run since Phase 5 was built).
   Put Razorpay TEST keys + webhook secret in `backend/.env` -> `npm run seed -- --reset && npm run dev` -> `bash scripts/smoke-phase2.sh ... smoke-phase6.sh` (re-seed between scripts that mutate data: 3, 5, 6).
   Frontend: `npm install && npm run build && npx eslint .` then `VITE_LIVE_MODULES=all npm run dev` and walk each role (manual Razorpay TEST payment described in INTEGRATION_PLAN.md, Phase 4).
2. Open a **new Claude chat**, attach the latest project zip and `FreelanceFlow_All_APIs.pdf`.
3. Paste `NEXT_SESSION_PROMPT_PHASE7.md` as the first message. **Fix whatever the runs in step 1 uncover first** - nothing in Phases 2-6 has ever touched a real database.

## Files here
| File | Purpose |
|---|---|
| `NEXT_SESSION_PROMPT_PHASE7.md` | Copy-paste prompt for the next chat |
| `PHASE4_TO_7_BRIEFS.md` | STATUS block + the Phase 7 brief |
| `PHASE3_SPEC.md` | Behaviour reference for bids/contracts/milestones |
| `SANDBOX_TIPS.md` | How to test without MongoDB (mongoose + dotenv shim recipe) |
