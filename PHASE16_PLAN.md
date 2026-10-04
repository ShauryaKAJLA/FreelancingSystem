# FreelanceFlow — Phase 16

**Rule (unchanged):** frontend is the source of truth for field names/statuses/error strings. Claim only what you ran.

## Phase 16 session: DONE / NOT DONE
This sandbox could `npm install` (backend + frontend) for the first time since Phase 3, so part of Step 0 was actually run.

**RAN (this session)**
- Backend `npm install`; `npm test`: **206/206 pass** (201 existing + 5 new in `tests/phase16.test.js`). `npm run audit:api`: 80/80 PDF endpoints, 4/4 frontend-only additions.
- Frontend `npm install`, `vite build` (OK; only the >500 kB chunk warning), `eslint .`: was 7 errors / 3 warnings, now **0 errors / 3 warnings** (unused imports/vars removed; `react-refresh` rule disabled on the two context-hook exports). The 3 remaining warnings (`SKILLS` in two `useMemo` dep arrays, an unused eslint-disable in Pagination) were left alone.

**Features added**
1. Per-user rate limiting — `src/middleware/rateLimit.js`, wired in `app.js`. Valid bearer token => counted by user id (`RATE_LIMIT_USER_MAX`, default 600); otherwise by IP (`RATE_LIMIT_IP_MAX`, default 300); window `RATE_LIMIT_WINDOW_MS`. Forged/expired tokens fall back to the IP bucket. Tested through the real Express + express-rate-limit stack (3 tests). `docs/DEPLOY.md` and `.env.example` updated. In-memory store: per instance.
2. Skills usage counts — `GET /api/skills?usage=true` (Admin only; others get the normal list) adds `freelancerCount`, `jobCount`, `usageCount`. Admin Skills page shows Freelancers and Jobs columns (`useGetSkillsWithUsageQuery`). Service tested with stubbed models (2 tests); the `$unwind/$group` aggregations themselves were NOT run against real Mongo.

**NOT DONE / UNVERIFIED**
- `npm run test:integration`: still 11 skipped (mongod binary download is blocked here). The concurrency tests have never executed.
- `explain:lists`, browser click-through per role, Docker, live Razorpay webhook/payment, backup drill, preflight against real env.
- The new Skills columns were built and linted, not viewed in a browser.
- Not started from the Next list: RazorpayX payouts, Socket.IO messaging, "start conversation" picker, freelancer experience level, invite-to-job, automatic refund policy, CSV export, text/Atlas search.

## Run on your machine
Same Step 0 block as `NEXT_PHASE_15.md`; the shim suites are no longer needed (`npm test` now runs with real express/bcrypt).
Extra check: sign in as Admin -> Skills page -> counts match the skill's real usage; as Client call `GET /api/skills?usage=true` -> no count fields.

## Next
1. Fix Step 0 findings (esp. `test:integration` — read assertion messages before changing services).
2. Remaining feature list from Phase 15 (priority order is yours): RazorpayX automated payouts, Socket.IO messaging, start-conversation picker, freelancer experience level, invite-to-job, automatic refund policy, CSV export, text/Atlas search.

## Prompt for the next session
> Continue FreelanceFlow. Attached: the latest zip (Phase 16) and `FreelanceFlow_Revised_API_Endpoint_Reference.pdf`. Read `PHASE16_PLAN.md`, `PHASE15_PLAN.md`, `INTEGRATION_PLAN.md`, `docs/DEPLOY.md`, `HANDOFF/SANDBOX_TIPS.md`. My Step 0 results: *(paste failures / "all green")*. Fix those first, then follow the Next list. Frontend is the source of truth; claim only what you ran.
