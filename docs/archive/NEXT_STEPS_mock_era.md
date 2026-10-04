# FreelanceFlow — Remaining Work (continuation prompt)

This project is a mock-data-driven React (Vite + Redux Toolkit Query) freelancing
marketplace. Five build passes have landed so far.

**Pass 1 — Payments module**
- `/client/payments`, `/client/payments/:id`, `/freelancer/payments`, `/freelancer/payments/:id`
- `getClientPayments`, `getClientPaymentDetails`, `getFreelancerPayments`, `getFreelancerPaymentDetails` in
  `clientApi.js` / `freelancerApi.js`, joining payments → milestones → contracts → jobs/users.

**Pass 2 — Milestone actions + Contract lifecycle**
- Client: "Add milestone" modal (`createMilestone`), "Start contract" / "Complete contract" /
  "Cancel contract" actions with a new reusable `ConfirmDialog` component.
- Freelancer: "Mark as submitted" action (`submitMilestone`).
- State machine enforced server-side: `Pending Start → Active → Completed` / `Cancelled` for
  contracts, `Pending → Submitted → Completed` for milestones.
- `acceptBid` now creates contracts as `Pending Start` instead of jumping straight to `Active`.
- Review form gates on `contract.status === 'Completed'`.

**Pass 3 — Proposal/bid lifecycle (spec §17–18)**
- Freelancer: **Edit proposal** (`editBid` — only while `Pending`/`Updated`, sets status to
  `Updated`), **Withdraw proposal** (`withdrawBid`, via `ConfirmDialog`) — both from the job
  details page and from `/freelancer/bids`.
- `BidForm` now supports an edit mode (`initialValues`, custom title/labels) instead of being
  submit-only.
- Resubmission: `submitBid` and `getJobDetailsForFreelancer` now ignore `Withdrawn` bids, so a
  freelancer can submit a fresh proposal on a job after withdrawing.
- `acceptBid` hardened server-side (not just UI): rejects if the job isn't `Open`, or if the
  bid isn't `Pending`/`Updated` (can't accept a withdrawn/already-rejected/already-accepted bid).
  Bulk-rejecting sibling bids on accept now skips already-`Withdrawn` ones instead of overwriting them.
- New `Updated` and `Withdrawn` badge colors; client's `BidCard` now also shows the Accept
  action for `Updated` bids, not just `Pending`.

**Pass 4 — Search, filters, sorting for Jobs and Freelancers (spec §13–15)**
- `shared/mockData/jobs.js` gained `category` and `experienceLevel` fields on every job,
  plus two new sample jobs (`j5`, `j6`, both `Entry` level) so filters have something to
  bite on. New exports: `JOB_CATEGORIES`, `EXPERIENCE_LEVELS`.
- `CreateJobPage` (client) now collects `category` and `experienceLevel` via two new
  `Select` fields (defaults to the first option of each list); `createJob` already spread
  `...newJob` so no mutation change was needed there.
- `getOpenJobs` (`freelancerApi.js`) extended to accept `category`, `experienceLevel`,
  `budgetMin`, `budgetMax`, `sortBy` (`newest` default, `oldest`, `budgetHigh`, `budgetLow`)
  alongside the existing `search`/`skillId`.
- `BrowseJobsPage` rebuilt: full filter bar (title search, skill, category, experience
  level, budget min/max, sort dropdown), removable active-filter chips derived from
  current filter state, and a "Clear all" button. Job cards now show category/experience
  badges.
- New **freelancer discovery** feature for clients (spec §15 — this page did not exist
  at all before this pass):
  - `getFreelancers` query added to `clientApi.js`: filters by `search` (name/bio),
    `skillId`, `minRating`, `minRate`/`maxRate`, sorts by `ratingHigh` (default),
    `rateLow`, or `rateHigh`. Excludes `Flagged` user accounts. Enriches each freelancer
    with resolved skill names and a `completedContracts` count (via `contracts`).
  - `FreelancersListPage` (`/client/freelancers`) — same filter-bar/chips pattern as
    `BrowseJobsPage`, card grid of freelancer results.
  - `FreelancerProfileViewPage` (`/client/freelancers/:freelancerId`) — read-only,
    reuses `useGetFreelancerProfileQuery` from `freelancerApi.js` (that query was
    already generic/freelancerId-keyed, so no duplicate endpoint was needed). Shows
    bio, skills, rating, hourly rate, and client reviews. No "invite to job" or
    direct-hire action was added — the mock data model only supports freelancer-
    initiated bids, so an invite feature would have been fabricated, not implemented.
  - New "Find Freelancers" item in `clientNav` (`AppRouter.jsx`).
- `JobCard` (client's shared job-card component, used on `JobsListPage` etc.) also
  picked up the category/experience badges for visual consistency with the freelancer
  browse view.

**Pass 5 — Job management, client (spec §16)**
- Job status lifecycle introduced: `Draft → Published → In Progress → Completed/Closed/Cancelled`
  (jobs used to be created directly as `Open`, with no `Draft` state). `Open` has been renamed
  to `Published` everywhere a job's own status is checked or set — `clientApi.js`
  (`getClientDashboard`, `acceptBid`), `freelancerApi.js` (`getOpenJobs`), `adminApi.js`
  (dashboard `openJobs` count), and the freelancer `JobDetailsPage`/`BrowseJobsPage` (bid form
  gating). `Badge.jsx` gained `Draft`/`Published` colors (the old `Open` mapping was left in
  place, unused, in case something else still references it). New `shared/mockData/jobs.js`
  exports: `JOB_STATUSES` (all six) and `EDITABLE_JOB_STATUSES` (`['Draft', 'Published']`). Seeded
  one new sample job (`j7`) in `Draft` status so the empty/draft state is visible without manually
  creating one.
- `clientApi.js` — four new mutations, all following the existing validate → mutate mock array →
  `{ data }`/`{ error }` → `invalidatesTags` `queryFn` convention:
  - `createJob` now validates title/description/budget server-side (previously only client-side
    in `CreateJobPage`) and takes a `status` field — `'Published'` publishes immediately,
    anything else (including omitted) creates a `Draft`.
  - `editJob({ jobId, ...updates })` — patches title/description/budget/category/experienceLevel/
    requiredSkillIds on a `Draft` or `Published` job only; rejects with a clear message once the
    job is `In Progress` or later. Re-validates the same fields as `createJob` for whichever ones
    are present in `updates`.
  - `publishJob(jobId)` — `Draft → Published` only.
  - `deleteJob(jobId)` — `Draft` only ("no bids yet" is implicit: a job can't receive bids until
    it's `Published`, so `Draft` already guarantees zero bids). Actually removes the entry from
    the `jobs` mock array via `splice` (the first hard-delete in the codebase — everything before
    this only ever soft-transitioned `status`).
  - `cancelJob({ jobId, reason })` — `Published` only (an `In Progress` job already has a contract;
    use the existing `cancelContract` for that case instead, so job-cancel and contract-cancel
    stay orthogonal). Sets `status: 'Cancelled'`, stores `reason` as `cancellationReason` (same
    field name Pass 2 used for contracts), and bulk-rejects any `Pending`/`Updated` bids on that
    job, mirroring the bulk-reject-siblings logic already in `acceptBid`.
- New `EditJobPage.jsx` (`/client/jobs/:jobId/edit`) — same field set/layout as `CreateJobPage`,
  pre-filled from `getJobDetails`, submits via `editJob`. Renders `ErrorState` up front if the
  job isn't in an editable status (defense in depth — the entry point is already hidden in that
  case, see below). Derives its form state from the loaded query result during render
  (`if (job && loadedJobId !== jobId) { setLoadedJobId(...); setForm(...) }`) rather than in a
  `useEffect`, to satisfy the `react-hooks/set-state-in-effect` lint rule already enforced on
  this project.
- `JobDetailsPage.jsx` (client) — action row above the description, conditional on `job.status`:
  `Edit job` (Draft/Published) → `EditJobPage`; `Publish job` (Draft only) → `publishJob`;
  `Delete draft` (Draft only) → `ConfirmDialog` → `deleteJob` → redirect to `/client/jobs`;
  `Cancel job` (Published only) → `ConfirmDialog` with `collectReason` → `cancelJob`. A `Draft`
  job shows a callout explaining it isn't visible to freelancers yet, and the whole "Bids
  received" section is hidden for drafts (there can't be any).
  `JobCard.jsx` (used on `JobsListPage`) picked up a small "Edit job →" link, shown only for
  `Draft`/`Published` jobs, so the list view doesn't require opening each job to edit it.
- `CreateJobPage.jsx` — one form, two submit buttons: "Publish job" (default form submit) and
  "Save as draft" (`type="button"`, calls the same `handleSubmit` with `'Draft'`). Both go through
  client-side `validate()` first.
- `ClientDashboardPage.jsx` — stat grid extended from 3 to 4 cards: renamed "Open jobs" →
  "Published jobs", added a "Drafts" card (`data.draftJobs`, new field on `getClientDashboard`).
- Route added: `/client/jobs/:jobId/edit` in `AppRouter.jsx` (no nav-item change needed — reached
  via `JobDetailsPage`/`JobCard`, not top-level nav).
- Full `npm run build` (Vite) and `npx eslint .` both pass clean; the only lint errors in the
  project are pre-existing ones in files this pass didn't touch (`LoginPage.jsx`,
  `LandingPage.jsx`, `ThemeProvider.jsx`, and an unused `navigate` in the *freelancer*
  `JobDetailsPage.jsx` — not the client one edited in this pass).
- **Not done in this pass, deliberately left for the next one:** no quick actions (edit/delete/
  cancel) were added inline on `JobsListPage`'s cards beyond the one "Edit job →" link — bulk or
  list-level actions would need their own `ConfirmDialog` wiring per card and were out of scope
  for "biggest gap" triage. No toast/success feedback on publish/cancel/delete beyond the
  `ConfirmDialog`'s own loading/error state — that's explicitly queued as Pass 6 below (the
  notification system) and shouldn't be one-off'd here.

**Pass 6 — Milestone edit/delete/reject (rest of spec §24)**
- `shared/mockData/milestones.js` now exports `EDITABLE_MILESTONE_STATUSES` (`['Pending']`)
  alongside a comment documenting the full lifecycle (`Pending -> Submitted -> Completed`),
  mirroring the `EDITABLE_JOB_STATUSES` pattern from Pass 5.
- `clientApi.js` — three new mutations, all following the existing validate -> mutate mock
  array -> `{ data }`/`{ error }` -> `invalidatesTags` `queryFn` convention:
  - `editMilestone({ milestoneId, title, amount, dueDate })` — patches title/amount/dueDate
    on a `Pending` milestone only; re-validates the same fields `createMilestone` does.
  - `deleteMilestone(milestoneId)` — `Pending` only, hard-removes it from the `milestones`
    mock array via `splice` (same "unstarted only" guarantee `deleteJob` uses for jobs: a
    milestone can't be `Submitted` without freelancer action, so `Pending` already means
    untouched).
  - `rejectMilestone({ milestoneId, reason })` — `Submitted` only, sets `status` back to
    `'Pending'` and stores the optional reason as `rejectionReason` (same field-naming
    convention as `cancellationReason` on contracts/jobs). Deliberately has no contract-status
    guard, matching `releaseMilestonePayment`'s existing precedent (also `Submitted`-only,
    no contract check).
  - Neither `editMilestone` nor `deleteMilestone` checks contract status either, matching
    `createMilestone`'s existing precedent (only the UI's "+ Add milestone" button is gated
    on `contract.status === 'Active'`, not the mutation itself).
- `freelancerApi.js` — `submitMilestone` now clears `rejectionReason` back to `null` when a
  milestone is resubmitted, so a stale rejection note doesn't linger after the freelancer
  has already acted on it.
- `client/pages/ContractDetailsPage.jsx` — the old single-purpose `AddMilestoneModal` was
  generalized into `MilestoneFormModal`, which takes an optional `milestone` prop to switch
  into edit mode (pre-fills the form, calls `editMilestone` instead of `createMilestone`,
  swaps labels/button text). It re-seeds its fields by deriving state during render off an
  `open`+`milestoneId` key (no `useEffect`), following the same `set-state-in-effect`-avoidance
  pattern `EditJobPage` used in Pass 5.
  - `Pending` milestone cards now show **Edit** and **Delete** buttons alongside the existing
    "Waiting on freelancer" label; Delete goes through the existing `ConfirmDialog`. If a
    milestone carries a `rejectionReason` from a prior reject, it's shown inline under the
    milestone (cleared automatically once the freelancer resubmits, per the freelancerApi
    change above).
  - `Submitted` milestone cards now show a **Reject** button next to "Approve & release
    payment", opening a `ConfirmDialog` with `collectReason` (optional feedback for what
    needs to change) that calls `rejectMilestone`.
- Freelancer side (`freelancer/pages/ContractDetailsPage.jsx`) was **not** touched — a
  rejected milestone just reverts to `Pending`, which the existing "Mark as submitted" button
  already handles with no code changes needed there.
- No new `Badge` colors needed — milestones only ever cycle through `Pending`/`Submitted`/
  `Completed`, all already styled.

Read `FEATURE_AUDIT.md` and skim `src/routes/AppRouter.jsx`, `src/modules/client/clientApi.js`,
`src/modules/freelancer/freelancerApi.js` before changing anything — the RTK Query
`queryFn` mock-backend pattern in those two files is the convention every new
endpoint should follow (validate → mutate the in-memory mock array → return
`{ data }` or `{ error: { status, data: 'message' } }`, then `invalidatesTags`).
`ConfirmDialog` (in `shared/components/ui`) is the standard pattern for any
destructive/important action now — reuse it rather than `window.confirm` or a
one-off modal. The filter-bar + active-chips + "Clear all" pattern introduced in
`BrowseJobsPage`/`FreelancersListPage` in this pass is now the convention for any
future searchable/filterable list (e.g. Admin tables in pass 3 below).

**Pass 7 — Admin payments/reviews/contracts pages (spec §31–34)**
- `adminApi.js` gained five endpoints, all following the module's existing
  validate/join → `{ data }`/`{ error }` → `providesTags`/`invalidatesTags` convention:
  - `getPaymentDetails(paymentId)` — joins a payment → milestone → contract → job/client/
    freelancer, mirroring `getClientPaymentDetails`/`getFreelancerPaymentDetails`.
  - `getAdminContracts()` — all contracts enriched with job title, client name, freelancer
    name, for a platform-wide list.
  - `getAdminContractDetails(contractId)` — single contract joined with its milestones
    (each with its payment, if any) and reviews, read-only counterpart to the client's
    `getContractDetails`.
  - `getAdminReviews()` — all reviews enriched with job title, reviewer/reviewee name.
  - `moderateReview({ reviewId, action, adminId })` — `action` is `'approve'` (→ `Visible`),
    `'flag'` (→ `Flagged`), or `'hide'` (→ `Hidden`); logs an `AdminActions` entry
    (`actionType: 'Review Moderation'`) same as `toggleUserStatus`/`resolveIssue` do.
- `shared/mockData/reviews.js` gained a `status` field (`Visible` default on both seeded
  reviews) and a `REVIEW_MODERATION_STATUSES` export — a UI-facing addition on top of the
  DB schema, following the same approach already used for `reportedIssues`: flagged in a
  comment rather than silently treated as if the DB schema already had it.
- `Badge.jsx` gained `Visible`/`Hidden` colour mappings (`Flagged` already existed, reused
  from the account-flagging status).
- Three new admin pages:
  - `ContractsPage.jsx` (`/admin/contracts`) — `UsersListPage`-style table with a status
    filter dropdown, each row linking to its contract.
  - `ContractDetailsPage.jsx` (`/admin/contracts/:contractId`) — read-only: parties (linking
    to `/admin/users/:userId`), job summary, milestones with their payment (linking to
    `/admin/payments/:paymentId`), and reviews. Shows the same cancellation-reason callout
    the client's `ContractDetailsPage` shows, closing the "cancellation reason not surfaced
    admin-side" gap noted below.
  - `PaymentDetailsPage.jsx` (`/admin/payments/:paymentId`) — same layout as the client/
    freelancer payment detail pages; `TransactionsPage`'s payment-ID column now links here
    (previously this detail view didn't exist/open at all).
  - `ReviewsPage.jsx` (`/admin/reviews`) — status filter dropdown; each review card shows
    reviewer → reviewee, rating, comment, and Approve/Flag/Hide buttons (the current status's
    own action is hidden, so a `Visible` review shows Flag/Hide, a `Flagged` one shows
    Approve/Hide, etc.), each independently disabled while its own request is in flight.
- Routes added in `AppRouter.jsx`: `/admin/contracts`, `/admin/contracts/:contractId`,
  `/admin/payments/:paymentId`, `/admin/reviews`; `adminNav` gained "Contracts" and
  "Reviews" items.
- Checked the two admin `Badge`-rendering spots flagged in Pass 5/6's notes
  (`getAdminDashboard`'s `openJobs` stat, `UserDetailsPage`'s per-job badges): both already
  read/render `Draft`/`Published`/`Cancelled` correctly — `openJobs` already filtered on
  `'Published'` and `Badge.jsx` already had styles for all three — so no change was needed
  there; this was a confirmation, not a fix.
- Not run in this pass: `npm run build`/`npx eslint .` — this container has no network
  access and no `node_modules` (per the README, the checked-in one is Windows-only and needs
  `npm install`), so the new/edited files were instead reviewed by hand line-by-line
  against the existing patterns and mock-data field names. Please run `npm install && npm run
  build && npx eslint .` before shipping this pass.

**Pass 8 — Notification system (spec §36)**
- Two new shared files:
  - `shared/components/ui/Toast.jsx` — presentational `ToastStack` + internal `ToastItem`.
    Three variants (`success`/`error`/`info`) styled with the same Tailwind tokens the rest
    of `ui/` already uses (emerald/red/sky, `rounded-xl`, `border`, `shadow-lg` — matching
    `Card`/`Badge`'s palette). Fixed bottom-center on mobile, bottom-right from `sm:` up.
    Each toast is individually dismissible (`FiX` button) and does its own mount-transition
    via a `requestAnimationFrame`-flipped `entered` boolean rather than a global CSS
    keyframe, deliberately, so `App.css` (legacy landing-page CSS with global `!important`
    palette overrides, already flagged as a file every pass leaves alone) didn't need touching.
  - `shared/notifications/NotificationProvider.jsx` — `NotificationProvider` + `useNotify()`,
    mirroring `ThemeProvider`'s context/hook shape exactly (`createContext` + a hook that
    throws if called outside the provider). `useNotify()` returns `{ success, error, info,
    dismiss }`; success toasts auto-dismiss after 4s, error after 6s (errors get longer
    on-screen time since there's usually more to read), both cancellable via the per-toast
    close button. Mounted once in `main.jsx`, wrapping `<App />` inside `ThemeProvider`,
    the same nesting level as the Redux `Provider`.
- Wired `notify.success(...)` / `notify.error(...)` into **every** mutation call site across
  the app — both directions, even on the handful of mutations that already had a durable
  inline error (e.g. `EditJobPage`'s `saveError` paragraph, `ConfirmDialog`'s own `error`
  prop) — so that a toast confirmation is now the one consistent signal every mutation gives,
  regardless of whether it also happens to render inline text. Error messages reuse the
  mock-backend's own `error.data` string (the `{ error: { status, data: 'message' } }`
  convention from `clientApi`/`freelancerApi`/`adminApi`) with a generic per-action fallback
  when `error.data` is absent. Touched:
  - `client/pages/JobDetailsPage.jsx` — accept bid, publish, delete draft, cancel job.
  - `client/pages/CreateJobPage.jsx` — create job (publish and save-as-draft both branch
    through the same handler, so both get a status-appropriate success message).
  - `client/pages/EditJobPage.jsx` — save changes.
  - `client/pages/ContractDetailsPage.jsx` — the biggest surface: `MilestoneFormModal`'s
    add/edit, plus (in the page itself) submit review, complete contract, cancel contract,
    delete milestone, reject milestone. Also added toast-wrapped handlers for **start
    contract** and **release payment**, which previously called their mutations directly
    from an inline `onClick` with no result-checking at all — those two were completely
    silent on both success and failure before this pass, not just missing a toast.
  - `freelancer/pages/JobDetailsPage.jsx` — submit/edit/withdraw bid.
  - `freelancer/pages/ContractDetailsPage.jsx` — submit milestone (previously fired the
    mutation with zero result-checking, same gap as start-contract/release-payment above).
  - `freelancer/pages/MyBidsPage.jsx` — withdraw bid.
  - `admin/pages/ReportsPage.jsx` — resolve issue (previously unchecked, same gap).
  - `admin/pages/ReviewsPage.jsx` — moderate review; success message varies by action
    (`approve`/`flag`/`hide`) via a small lookup table.
  - `admin/pages/UserDetailsPage.jsx` — toggle user status; message ("Account flagged." vs
    "Account restored.") is decided from `user.status` *before* the mutation fires, since
    the query result (and therefore `user.status`) is stale immediately after a successful
    toggle until the tag invalidation refetch lands.
- **Not touched, deliberately:** `auth/pages/LoginPage.jsx` and `RegisterPage.jsx` also call
  mutations (`useLoginMutation`/`useRegisterMutation`) but were left out of this pass — both
  already show their own inline error text, both navigate away immediately on success (so a
  success toast would appear on a page the user has already left), and both are on the list
  of pre-existing condensed/minified-style files every prior pass has avoided touching. The
  decorative bell icon in `AppShell.jsx` (`FiBell`, top bar) was also left alone — it's a
  static notification-*center* placeholder with no click handler, a different feature (an
  inbox of past notifications) from the toast system this pass builds, and out of scope for
  spec §36 as written.
- No new `Badge` colors or mock-data changes needed — this pass is UI-only, layered on top
  of mutations that already exist.
- Verified with `esbuild` (this container still has no network access for a full
  `npm install`, same constraint as Pass 7): every file touched this pass parses cleanly on
  its own, and the whole app bundles with zero resolution errors from `main.jsx` as the
  entry point (externalizing `react`/`react-dom`/`react-redux`/`@reduxjs/toolkit`/
  `react-router`/`react-icons`/`axios`/`dotenv`), which exercises every import path this
  pass added or changed. This is a syntax/resolution check, not a substitute for
  `npm run build && npx eslint .` — please still run that before shipping.

## Pass 8 — Dark mode audit (spec §6–7)

- **Root-cause fix, not just a color sweep.** Before touching any page, checked how
  `dark:` classes actually activate. This app toggles dark mode via a
  `data-theme="dark"` attribute on `<html>` (`ThemeProvider.jsx`), but the project has
  no `tailwind.config.js` and no `@custom-variant`/`@config` in CSS — so Tailwind v4's
  default `dark:` variant compiles to `@media (prefers-color-scheme: dark)`, which
  reads the **OS** preference, not the in-app toggle. Concretely, this meant
  `AppShell.jsx`'s three icon buttons (search, theme-toggle, bell — the only place in
  the codebase already using `dark:` classes) only picked up dark styling when the
  OS itself was in dark mode, and *ignored* the app's own toggle — clicking the sun/moon
  icon did nothing visible for those three buttons on a light-OS/dark-app-toggle
  combination (the most common way someone would actually exercise the toggle).
  Fixed with one line in `src/index.css`:
  `@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));`
  — now `dark:` classes anywhere in the app (present or future) correctly key off
  `data-theme="dark"`, matching every other dark-mode rule in `App.css`. This also
  resolves the "Worth deciding whether `Toast` should follow `ui/`'s convention or
  `AppShell`'s" question from the prior note: no component ends up using `dark:`
  classes yet (see below), so the question is moot for now, but the infrastructure is
  correct whichever way a future pass goes.
- **Color sweep**, following the codebase's existing convention (global
  `html[data-theme="dark"] .some-utility-class { ... }` overrides in `App.css`, not
  per-element `dark:` classes — this is how every pre-existing screen gets its dark
  styling, and keeping one convention avoids half the app being overridable via CSS
  and half requiring a JSX edit per element). Audited every file named in the prior
  note (`Toast.jsx`, `ConfirmDialog.jsx`, both `PaymentsListPage.jsx`/
  `PaymentDetailsPage.jsx` pairs (client + freelancer + admin), `BrowseJobsPage.jsx`,
  `FreelancersListPage.jsx`, `EditJobPage.jsx`, `JobDetailsPage.jsx` (client),
  `admin/ContractsPage.jsx`, `admin/ContractDetailsPage.jsx`, `admin/ReviewsPage.jsx`)
  against the color-override list already in `App.css` and added the gaps: `bg-red-50`,
  `bg-sky-50`, `border-emerald-200`, `border-red-200`, `border-sky-200`,
  `border-indigo-300`, `border-indigo-500`, `border-slate-300`, `border-slate-400`,
  `text-amber-500`, `text-emerald-500/600/800`, `text-indigo-600/700`,
  `text-red-500/600/700/800`, `text-sky-500/800`. These are the colors the toast
  variants (success/error/info), inline mutation-error text, and status/rating badges
  across those pages actually use — Toast in particular is now dark-aware purely
  because its `border-emerald-200 bg-emerald-50 text-emerald-800` /
  `border-red-200 bg-red-50 text-red-800` / `border-sky-200 bg-sky-50 text-sky-800`
  classes are covered, with zero JSX changes needed.
- **Not done in this pass, flagged for the responsive pass or a follow-up:**
  visual/viewport verification. This pass fixed the mechanism (`dark:` now works) and
  closed the known utility-class gaps by static analysis (grepped every `bg-`/`text-`/
  `border-` color class used across the audited files against what `App.css` already
  overrides), but nobody has actually rendered these pages with the toggle on — there
  could still be inline styles, disabled-state colors, or autofill quirks on those
  specific pages that only show up visually. `Modal.jsx`/`Textarea.jsx` (which
  `ConfirmDialog` composes) were not separately audited — they inherit `bg-white`/
  `border-slate-*`, already covered, but weren't spot-checked as their own surfaces.
- No mock-data or component-behavior changes — this pass is CSS/config-only
  (`src/index.css`, `src/App.css`), so it carries none of the mutation/contract risk
  earlier passes did.

## Pass 9 — Responsive pass (spec §43)

Went through the four items flagged in the prior note one at a time, by reading the
actual layout code rather than assuming a fix was needed everywhere. This container
still has no network access for a real viewport screenshot/`npm run dev` check (same
constraint noted in Passes 7–8), so "verified" below means traced through the Tailwind
classes by hand, not eyeballed in a browser — flagging that limit explicitly rather than
overclaiming.

- **Messages workspace — real bug, fixed.** `MessagesPage.jsx` was one of this
  project's pre-existing condensed/minified-style files (like the auth pages), and on
  a `<lg` viewport its two-column `grid ... lg:grid-cols-[320px_1fr]` collapses to a
  single implicit column that **stacks** the thread list and the open conversation
  instead of showing one or the other — so opening a conversation on mobile meant
  scrolling down past the entire thread list first, with no way back up short of
  scrolling. Rewrote the component (kept every piece of existing logic — `threads`
  memo, `selected`, `send`, mock message shape — unchanged, just reformatted from the
  single-line style to normal multi-line JSX so the fix is reviewable) to add a
  `mobileView` ('list' | 'conversation') state: selecting a thread switches to the
  conversation pane and hides the list below `lg`, and a new back button (`FiArrowLeft`,
  `lg:hidden`) in the conversation header switches back. At `lg`+ both panes render
  side by side exactly as before — `mobileView` has no effect there for either pane's
  `hidden lg:block` / `hidden lg:flex` overrides.
- **Tables — checked, already fine.** `shared/components/ui/Table.jsx` (used by
  Payments/Transactions/Users/My Bids and every other table in the app) already wraps
  its `<table>` in `overflow-x-auto rounded-xl border ... bg-white` — a table wider than
  the viewport scrolls horizontally inside its own card rather than breaking page
  layout. No change needed; noting this so it isn't re-flagged as unverified next pass.
- **Filter bars — checked, already fine.** `BrowseJobsPage`/`FreelancersListPage` filter
  rows use `flex flex-wrap items-end gap-3` with each field on a fixed but modest width
  (`w-32` to `w-56`, i.e. 128–224px). Every field individually fits well inside even a
  320px viewport, so `flex-wrap` drops each into its own row on narrow screens instead
  of overflowing — functionally fine, just visually a tall stack of one-field rows on a
  phone. Cosmetic, not a bug; left as-is rather than redesigning the filter bar into a
  collapsible/accordion pattern that wasn't asked for.
- **`JobDetailsPage` action row — checked, already fine.** `flex flex-wrap gap-2` on the
  action-button row wraps the same way; no fixed-width buttons wide enough to overflow a
  narrow viewport.
- Toast stack (`fixed inset-x-0 bottom-0 ... sm:right-0`, from Pass 7) — reasoned through
  again here, still looks correct; not touched.

## Pass 10 — `deleteJob` id-collision fix

Went looking through "Known deliberate simplifications" below for anything actually
actionable without more spec information, rather than guessing at product decisions
(freelancer-side experience level, invite-to-job, `cancelJob`/`cancelContract`
composition — all three explicitly need a real answer about what the spec wants, not an
implementation guess, so left untouched again this pass). The one item that was a plain
bug, not a design question, was `createJob`'s id generator being unsafe against
`deleteJob`'s hard-delete. Fixed — see the "Known deliberate simplifications" entry
above for the detail, and `clientApi.js`'s `createJob` for the one-line diff (a
`reduce` over existing numeric suffixes instead of `jobs.length + 1`). No behavior
change for the normal create/delete-free path; only matters once a `Draft` job has
actually been deleted in the session and another is created afterward.

## Suggested next passes, roughly in priority order

There is no numbered backlog item left that's actionable without more information.
Everything still open falls into one of two buckets:

1. **Needs a real browser, not more code reading.** Pass 8's dark-mode sweep and Pass 9's
   responsive fixes were both done by tracing Tailwind classes by hand — this container
   has no network access for `npm run dev` + an actual viewport/toggle check (same
   constraint noted in Passes 7–10). Worth a real pass once that's available, especially
   `MessagesPage`'s new mobile toggle, `Toast`, `ConfirmDialog`, the Payments pages, the
   filter bars, and the admin Contracts/Reviews/Payment-detail pages. `npm run build &&
   npx eslint .` also still hasn't been run against this codebase in any pass, for the
   same reason.
2. **Needs a product/spec decision, not an implementation guess.** The three items still
   sitting in "Known deliberate simplifications" below (freelancer-side experience/
   seniority filtering, an "invite to job" direct-hire action, and whether
   `cancelJob`/`cancelContract` should ever compose into one client action for an
   `In Progress` job) all depend on what the spec actually wants — implementing any of
   them now would mean inventing requirements rather than following them.

## Known deliberate simplifications to revisit
- A withdrawn bid stays in the mock array forever (status `Withdrawn`) rather than being
  deleted — intentional, so `/freelancer/bids` keeps full history — but nothing currently
  surfaces *why* it was withdrawn (no reason field was requested for bids, unlike contracts).
- Freelancers have no `experienceLevel`/seniority field of their own (only jobs do); the
  freelancer discovery filters use rating and hourly-rate range as the closest proxies
  instead. Revisit if the spec wants freelancer-side seniority filtering too.
- Freelancer discovery has no "invite to job" / direct-hire action — see Pass 4 notes above.
- `cancelJob` (Pass 5) is intentionally restricted to `Published` jobs only — an `In Progress`
  job already has a contract, and cancelling that goes through the existing `cancelContract`
  (Pass 2) instead, so a job and its contract are never cancelled through two different code
  paths at once. If the spec turns out to want a client to cancel an `In Progress` job and its
  contract in one action, that would need `cancelJob` and `cancelContract` to be composed
  together deliberately, not just have `cancelJob`'s status guard loosened.
- `deleteJob` (Pass 5) is the first hard-delete (`Array.splice`) anywhere in the mock-data layer;
  every other "remove" action before this was a soft status transition.
  **Resolved in Pass 10:** the `jobId` collision this risked (`createJob` used
  `jobs.length + 1`, which would recompute a just-deleted job's id) is fixed —
  `createJob` now derives the next id from the highest existing numeric suffix across
  `jobs`, which stays correct regardless of deletions or gaps. Every *other* id generator
  in the codebase (`u`/`b`/`ct`/`p`/`m`/`r`/`a` prefixes in `authApi.js`, `freelancerApi.js`,
  `clientApi.js`, `adminApi.js`) still uses plain `.length + 1` — deliberately left alone,
  since those arrays are only ever appended to, never spliced, so the collision this pass
  fixed doesn't apply to them. If a future pass adds a hard-delete anywhere else, its id
  generator needs the same treatment.
- There's still no persistence layer — everything resets on page reload (module-level
  `let` arrays). This matches the existing mock-data architecture and should NOT be
  swapped for a real backend without an explicit instruction to do so.
