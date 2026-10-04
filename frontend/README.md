# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.
You can also try [the experimental native React Compiler support in plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md#rust-react-compiler) by using `compiler: true` in the plugin options instead of using the Babel plugin.

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

---

## Freelancing Platform — Dummy Frontend Prototype

Phase 13: the in-memory mock layer has been removed. The app talks to the Express API in `../backend` (default `VITE_API_BASE_URL=http://localhost:5000/api`; run `npm run seed` in the backend for demo accounts).

### Run it
```
npm install   # re-resolves native bindings for your OS/arch (the checked-in
              # node_modules was built on Windows; this step is required on
              # any other platform, including this sandbox where it was built)
npm run dev
```

### Demo accounts (any password)
| Role | Email |
|---|---|
| Client | aisha.verma@technova.com |
| Freelancer | meera.iyer@dev.com |
| Admin | admin@platform.com |

### Architecture
- `src/modules/<feature>/` — one folder per feature area (`auth`, `client`, `freelancer`, `admin`), plus `app` (store) and `shared` (UI kit, layout, constants, utils).
- **State/data:** Redux Toolkit + RTK Query. One central `baseApi` (`modules/app/store/baseApi.js`) using `fakeBaseQuery()`; every module injects its own endpoints via `injectEndpoints` (`clientApi.js`, `freelancerApi.js`, `adminApi.js`, `authApi.js`).
- **API layer:** each module's `*Api.js` injects RTK Query endpoints (`queryFn` + `request`/`livePaged` from `shared/api`).

### Known gap vs. the source documents
The Admin "Reported issues / dispute handling" screen is backed by the backend `issues` collection, which has **no corresponding table in the supplied database design** — the SRS mentions dispute handling narratively but the DB doc only provides `AdminActions` (a log), not an issues/disputes entity. Flagged in-code; confirm with stakeholders whether a real `Issues`/`Disputes` table should be added to the schema.

## React 18 + Data Router

This version targets React 18.3.1 and uses React Router DOM 6.30.1 with the data-router APIs:

- `createBrowserRouter`
- `RouterProvider`
- route objects and nested protected route trees
- `Navigate`, `NavLink`, `useNavigate`, `useLocation`, and `useParams`

It also includes a persistent light/dark theme switch powered by a small React context and `localStorage`.

## Modern Routing Stack

This project uses the current React Router data-router architecture:

- React 19.3
- React Router 8.3.1
- `createBrowserRouter` from `react-router`
- `RouterProvider` from `react-router/dom`
- No `react-router-dom` dependency (removed in React Router v8)

React Router v8 requires React 19.2.7+, Node 22.22+, and Vite 7+.

## Razorpay (payments) — platform-collected, admin-dispatched
1. Copy `.env.example` to `.env` and set `VITE_RAZORPAY_KEY_ID` to your Razorpay **test** key id, then restart `npm run dev`.
2. **Client → platform:** when the client starts a contract (and again for each next milestone) they pay that milestone's amount to the *platform's* Razorpay account via Checkout. The freelancer cannot start a milestone until it is paid. Payment status: `Held`.
3. **Approval:** the client approves the submitted milestone → milestone `Completed`, payment `Awaiting Payout` (money is NOT sent to the freelancer yet). The admin is notified.
4. **Admin → freelancer:** Admin → Transactions (or the dashboard's "Awaiting payout" card) → open the payment → **Dispatch to freelancer**. Status becomes `Paid`, a payout reference is stored, the action is logged, and both freelancer and client are notified. The freelancer must have a bank/UPI payout account on their profile.

**Production note:** there is no backend, so Checkout runs in test mode without an `order_id` and the admin dispatch is simulated (`dispatchPayment` in `admin/adminApi.js`). For live money, create Razorpay orders and verify the payment signature on a server, and send the payout with RazorpayX Payouts from that server (needs the secret key, which must never be in frontend code).
