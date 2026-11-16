# Deploying FreelanceFlow

## 1. Environment matrix
| Variable | Where | Dev | Production |
|---|---|---|---|
| `NODE_ENV` | api | development | `production` (enables strict validation, HSTS, trust proxy) |
| `PORT` | api | 5000 | 5000 (or platform port) |
| `MONGODB_URI` | api | local mongo | managed cluster URI; must NOT be localhost |
| `JWT_SECRET` | api | any | 32+ random chars: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_EXPIRES_IN` | api | 7d | 7d (or shorter) |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | api | test keys | live keys (`rzp_live_…`) |
| `RAZORPAY_WEBHOOK_SECRET` | api | any | same value you enter in the Razorpay dashboard |
| `CLIENT_URL` | api | `http://localhost:5173` | exact https origin(s) of the web app, comma-separated, never `*` |
| `SHUTDOWN_TIMEOUT_MS` | api | 10000 | 10000 |
| `VITE_API_BASE_URL` | web **build arg** | `http://localhost:5000/api` | `https://api.example.com/api` |
| `VITE_RAZORPAY_KEY_ID` | web **build arg** | test key id | live key id (public). The checkout flow actually reads the key id from the server's create-order response |
| `VITE_DEMO_PASSWORD` | web build arg | seed password | **leave unset** (hides nothing, but there are no demo accounts in prod) |

Vite bakes `VITE_*` in at build time: changing them means rebuilding the web image.

## 2. First deploy
1. Provision MongoDB (replica set recommended; enable backups/PITR). Create an app user limited to the `freelanceflow` DB.
2. Build + start: `docker compose up --build` locally, or build `backend/` and `frontend/` images in CI. Put HTTPS in front of both (the API sets HSTS only in production and trusts one proxy hop).
3. With the production env loaded: `cd backend && NODE_ENV=production npm run preflight` — must exit 0 (env valid, DB reachable, indexes present, an Admin exists). Start the API once first so Mongoose builds the indexes.
4. Create the first admin: `npm run create-admin` (never run `npm run seed` in production; it creates demo accounts).
5. Razorpay dashboard → Webhooks → URL `https://<api>/api/payments/webhook`, secret = `RAZORPAY_WEBHOOK_SECRET`, events: `payment.captured`, `order.paid`, `payment.failed`, `refund.processed`.
6. Health: `GET /api/health` (liveness) and `/api/health/ready` (DB connected) — wire the second to the load balancer.

### Deploying the frontend on Vercel

The root `vercel.json` installs and builds the Vite app in `frontend/` and serves its SPA routes. Create a Vercel project for this repository using the repository root as the project root. Set `VITE_API_BASE_URL` in the Vercel project environment to the deployed API URL ending in `/api` (for example, `https://api.example.com/api`). Deploy the Express backend separately and set its `CLIENT_URL` to the Vercel site origin. Set frontend `VITE_RAZORPAY_KEY_ID` as needed; do not put backend secrets in Vercel frontend variables.

## 3. Smoke test with one small real payment (live keys, ₹1–10 milestone)
1. Register a client + a freelancer (real emails); freelancer adds payout UPI/bank in Profile.
2. Client posts + publishes a job; freelancer bids; client accepts; client starts the contract.
3. Client creates a ₹1+ milestone and funds it via Razorpay Checkout. Expect: payment `Held`, milestone funded, both parties notified; the webhook delivery shows 200 in the dashboard.
4. Freelancer submits; client approves → payment `Awaiting Payout`. Admin dispatches (records the payout; money movement itself needs RazorpayX, see roadmap).
5. Separately fund a second ₹1 milestone and **refund** it as admin; confirm `refund.processed` flips it to `Refunded`.
6. Check API logs for `DUPLICATE FUNDING` (must be absent).

## 4. Backup + restore drill (do this before launch, repeat quarterly)
```bash
# backup
mongodump --uri "$MONGODB_URI" --gzip --archive=ff-$(date +%F).archive.gz
# restore into a SCRATCH database, never over production
mongorestore --uri "$SCRATCH_URI" --gzip --archive=ff-YYYY-MM-DD.archive.gz --nsFrom 'freelanceflow.*' --nsTo 'ff_restore_test.*'
# verify: counts match, then point a staging API at ff_restore_test and log in as the admin
mongosh "$SCRATCH_URI/ff_restore_test" --eval 'db.getCollectionNames().forEach(c=>print(c, db[c].countDocuments()))'
```
Record the restore time; that is your real RTO.

## 5. Operational notes
- API rate limit (Phase 16): signed-in users are counted per **user id** (`RATE_LIMIT_USER_MAX`, default 600 / 15 min); anonymous callers per IP (`RATE_LIMIT_IP_MAX`, default 300). Login/register keep their own 20 / 15 min per-IP limiter. Window: `RATE_LIMIT_WINDOW_MS`. The counter is in-process memory: with more than one API instance each keeps its own count (use a shared store such as Redis if you scale out).
- Rollbacks: redeploy the previous images; the schema only gained indexes (additive) in Phases 9–15.
- Payments safety nets: `fundedLock` (one funded payment per milestone), `providerPaymentId` unique, atomic status transitions; a `DUPLICATE FUNDING` log line means money was taken twice and needs a manual refund.
