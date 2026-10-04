# Phase 3 — STATUS: DONE (code + unit tests). Live run pending.

## DONE
- Models `Bid` (new), `Contract`, `Milestone` (rewritten); constants; DTOs (`toBidDTO, toContractDTO, toMilestoneDTO, toPaymentDTO, toReviewDTO`).
- Services `bidService`, `contractService`, `milestoneService`; `jobService` placeholders (bidCount / pendingBids / bids[] / myBid / cancel-rejects-bids) replaced.
- Routes, controllers, validators for every endpoint in the spec below (+ `POST /milestones/:id/release-payment` = approve).
- Seed: bids b1..b6, milestones m3/m4 with Paid payments.
- Tests: 110 backend tests pass (55 new). Frontend: all 19 `liveXxx` wired with `hybrid()`, `vite build` + eslint OK.
- `backend/scripts/smoke-phase3.sh` written (`bash -n` only — never executed, needs MongoDB).
- `INTEGRATION_PLAN.md` Phase 3 section: verified / not-verified list + the deliberate deviations from the mocks.

## NOT DONE / NOT VERIFIED
- Never run against real MongoDB (partial unique index, `insertMany`, aggregation, concurrent accept) or in a browser. First thing to do: `npm run seed -- --reset && npm run dev && bash scripts/smoke-phase3.sh`.
- Frontend `fundMilestone`, `releaseMilestonePayment` and all payment queries are still MOCK (Phase 4). The backend approve route exists but nothing calls it yet.
- `toPaymentDTO` / `toReviewDTO` are minimal placeholders (Phase 4 / 5 finalise them).
- Client/freelancer dashboards and workspace search are still mock (Phase 5 / 6): a live contract does not appear in the mock dashboards.
- Refund/dispute handling for a *funded but unapproved* milestone when a contract is cancelled/terminated is undecided (needs Phase 4 refunds + Phase 6 admin).

---

(Original spec, kept for reference)

# Phase 3 spec — Bids, Contracts, Milestones, Termination

Extracted from the frontend mocks (`clientApi.js`, `freelancerApi.js`, `shared/mockData/{bids,contracts,milestones}.js`). READ the mock `queryFn` bodies again before coding — copy their output shapes and error strings exactly.

## Models to add / change (current backend has only stand-ins)
- **Bid** (new): `jobId, freelancerId, bidAmount, proposal, status ∈ Pending|Updated|Withdrawn|Accepted|Rejected, bidDate (Date; refreshed on edit)`. Unique on `(jobId, freelancerId)` among non-Withdrawn bids (partial unique index) — resubmitting after withdrawing must be allowed. DTO: `{ bidId, jobId, freelancerId, bidAmount, status, bidDate, proposal }`.
- **Contract** (rewrite `models/Contract.js` + `CONTRACT_STATUSES`): `Pending Start | Active | Completed | Cancelled | Terminated`; **`startDate` must become optional** (null while Pending Start — the model currently marks it required); add `endDate, cancellationReason, terminationRequestedBy ('Client'|'Freelancer'|null), terminationReason`. Keep unique `(jobId, freelancerId)`.
- **Milestone** (rewrite): status `Pending|Submitted|Completed`; **`dueDate` must become optional** (mock allows null; currently required); add `taskSpec, rejectionReason, funded`. `funded` is flipped ONLY by `paymentService` (Phase 4). Keep `amount` in rupees.
- Update the seed: bids b1..b6, contracts ct1/ct2, milestones m1..m4 per `shared/mockData`.

## Bids (`services/bidService.js`)
| Op | Rules / exact errors |
|---|---|
| `submitBid({jobId,freelancerId,bidAmount,proposal})` | job must be `Published` (else 400 "This job is no longer open for bidding."); 409 `You have already submitted a bid on this job.` if a non-Withdrawn bid exists; amount > 0; proposal required; caller = freelancer (ignore body freelancerId); flagged accounts already blocked by `authenticate` |
| `editBid({bidId,bidAmount,proposal})` | only `Pending` -> 400 `Only a pending proposal can be edited.`; sets status `Updated`, refreshes `bidDate`; owner only |
| `withdrawBid(bidId)` | 400 `A ${status.toLowerCase()} proposal cannot be withdrawn.` for Accepted/Rejected/Withdrawn; owner only |
| `getMyBids(freelancerId)` | each bid + `jobTitle, jobBudget, contractId, contractStatus, terminationRequestedBy` |
| `acceptBid({jobId,bidId})` | **atomic** (Mongo transaction or ordered conditional updates): job must be `Published` (400 `This job is no longer open for hiring.`); bid `Pending|Updated` (400 `This proposal is ${status.toLowerCase()} and can no longer be accepted.`); accepted bid -> `Accepted`, all other non-Withdrawn bids on the job -> `Rejected`; job -> `In Progress`; create Contract `Pending Start` (`startDate/endDate` null); return the contract; only the job's owner client |
- Job cancel (Phase 2 hook in `jobService.cancel`): Pending/Updated bids -> `Rejected`.
- Fill the Phase 2 placeholders: `listForClient` -> `bidCount, pendingBidCount, pendingBids[{...bid, freelancerName, freelancerRating}]`; `getForClient` -> `bids[{...bid, freelancerName, freelancerRating, freelancerRate}]`; `listOpen` -> real `bidCount`; `getForFreelancer` -> `myBid` (non-Withdrawn bid of the caller, else null).
- Routes: `POST /jobs/:jobId/bids`, `PUT /bids/:bidId`, `PATCH /bids/:bidId/withdraw`, `GET /freelancers/:id/bids`, `POST /jobs/:jobId/bids/:bidId/accept`.

## Contracts (`services/contractService.js`)
- `start`: only `Pending Start` -> 400 `Only a contract pending start can be started.`; sets `Active`, `startDate=now`; **creates one milestone per `job.milestoneTasks[i]`** (title `Milestone ${i+1}`, `taskSpec`, amount = floor(budget/n), last gets the remainder, `status Pending`, `dueDate null`, `funded false`) if none exist; returns `{...contract, firstMilestone}` (first unfunded milestone or null). Who may start: the client.
- `complete`: only `Active` -> 400 `Only an active contract can be completed.`; sets `endDate`. (Also set job -> `Completed`.)
- `cancel({contractId, reason})`: 400 `A completed or already-cancelled contract cannot be cancelled.`; sets `Cancelled`, `endDate`, `cancellationReason`; invalidates Jobs on the frontend (consider job status).
- `requestTermination({contractId, requestedByRole, reason})`: only `Active` -> 400 `Only an active contract can be terminated.`; **derive the role from the authenticated user, not the body**; stores `terminationRequestedBy/Reason`.
- `respondToTermination({contractId, approve})`: 400 `There is no pending termination request on this contract.`; the OTHER party must answer; approve -> `Terminated` + `endDate`; reject -> clear both fields.
- Lists/details (must return the same joined objects the pages destructure):
  - `getClientContracts` -> contract + `jobTitle, freelancerName`
  - `getFreelancerContracts` -> contract + `jobTitle, clientName` (company name, else account name)
  - `getContractDetails` (client) -> contract + `job` (full job DTO incl. `milestoneTasks`), `freelancerName`, `clientName`, `milestones[{...m, payment|null}]`, `reviews[]`
  - `getFreelancerContractDetails` -> contract + `job`, `clientName`, `freelancerName`, `milestones[{...m, payment|null}]` (no reviews key)
  - `payment` rows come from the existing `Payment` model via a DTO (Phase 4 finalises payment DTO names; for now map `paymentId, milestoneId, amount, paymentDate, paymentStatus, razorpayPaymentId, adminVerified`).
- Routes: `GET /clients/:id/contracts`, `GET /freelancers/:id/contracts`, `GET /contracts/:id`, `PATCH /contracts/:id/start|complete|cancel`, `POST /contracts/:id/termination-request|termination-response`. Parties only (admins read-only via Phase 6 routes). Non-parties get 404.

## Milestones (`services/milestoneService.js`)
- `create({contractId,title,amount,dueDate})`: 400 `A title and a positive amount are required.`; contract must be non-terminal; client only; `dueDate` optional -> ISO or null.
- `edit` / `delete`: only status `Pending` **and not funded**: 400 `A milestone that is ${status.toLowerCase()} can no longer be edited.` / `... deleted.`; also block funded ones with an equivalent message. (Note the mock's `Pending` set is `EDITABLE_MILESTONE_STATUSES`.)
- `submit(milestoneId)` (freelancer): 400 `The client has not funded this milestone yet.` if not funded; 400 `This milestone has already been submitted.` unless `Pending`; sets `Submitted`, clears `rejectionReason`; notify client.
- `reject({milestoneId, reason})` (client): only `Submitted` -> 400 `Only a submitted milestone can be rejected.`; back to `Pending`, stores `rejectionReason`.
- `approve` = the existing route `POST /milestones/:id/release-payment` (`releaseMilestonePayment`): 400 `This milestone must be submitted by the freelancer before it can be approved.` / 400 `This milestone has not been paid to the platform yet.`; then `Completed` and `paymentService.markMilestoneApproved(milestoneId)` (hook exists; payment `Held -> Awaiting Payout`); returns `{...payment, nextMilestone}`. Coordinate with Phase 4 — implement the state change here, DTO polish there.
- Notifications: call `notificationService` for bid received/accepted, contract started, milestone submitted/approved.

## Frontend (`hybrid('bids'|'contracts'|'milestones', mock, live)`)
`submitBid, editBid, withdrawBid, getMyBids, acceptBid, startContract, completeContract, cancelContract, getClientContracts, getFreelancerContracts, getContractDetails, getFreelancerContractDetails, createMilestone, editMilestone, deleteMilestone, submitMilestone, rejectMilestone, requestContractTermination, respondToTerminationRequest`. Keep `fundMilestone`/`releaseMilestonePayment`/payments for Phase 4 (they stay mock; but flag that `releaseMilestonePayment` needs both modules live).
Mirror hazard: while payments are still mock, a live contract's milestones won't have `funded`/payments — say so in the plan; don't silently fake them.

## Acceptance
Happy path bid -> accept -> start -> add milestone -> (fund is Phase 4; for the smoke test set `funded` directly in the DB) -> submit -> reject -> resubmit. Illegal transitions return the same strings as the mocks. Accepting a bid rejects siblings and moves the job to In Progress; a cancelled job rejects its pending bids; non-parties get 404/403.
