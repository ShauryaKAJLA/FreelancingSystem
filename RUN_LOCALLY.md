# Run FreelanceFlow (frontend + backend)

Prereqs: Node 18+, MongoDB running locally (or set MONGODB_URI in backend/.env to Atlas).

```bash
npm run setup     # installs both apps, creates backend/.env with a random JWT secret
npm run seed      # demo data (password Password@123, matches frontend/.env VITE_DEMO_PASSWORD)
npm run dev       # API http://localhost:5000/api  +  Web http://localhost:5173
```
Or: `docker compose up --build` (web :8080, api :5000).

How they connect: frontend `VITE_API_BASE_URL` (default http://localhost:5000/api) -> backend; backend `CLIENT_URL`
(default http://localhost:5173) is the CORS origin. If you change the web port/origin, update CLIENT_URL.

Checked in the build sandbox: backend `npm test` 206/206, `npm run audit` 80/80 + 4/4, frontend `vite build` OK.
NOT run (no MongoDB/browser there): seed, integration tests, click-through, Razorpay live flow. Run those on your machine.
