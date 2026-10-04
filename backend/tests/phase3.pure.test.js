// Phase 3 (pure logic): state-machine transition tables, validators, budget split, DTO mappers. No database.
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test_secret_test_secret_test_secret_123'

const test = require('node:test')
const assert = require('node:assert/strict')
const bid = require('../src/services/bidService')
const contract = require('../src/services/contractService')
const milestone = require('../src/services/milestoneService')
const bv = require('../src/validators/bidValidators')
const cv = require('../src/validators/contractValidators')
const mv = require('../src/validators/milestoneValidators')
const dto = require('../src/utils/dto')
const C = require('../src/models/constants')

const S1 = 'a'.repeat(24)
const S2 = 'b'.repeat(24)
const run = (validator, req) => {
  try { validator(req, {}, () => {}); return { req } } catch (error) { return { error } }
}
const body = (b) => ({ body: b })

// ── Bid state machine ───────────────────────────────────────────────────────────────────────
test('bid.submit: only a Published job accepts bids', () => {
  assert.equal(bid.rules.submit('Published'), null)
  for (const s of ['Draft', 'In Progress', 'Completed', 'Closed', 'Cancelled']) assert.equal(bid.rules.submit(s), 'This job is no longer open for bidding.')
})

test('bid.edit: only Pending (an already-Updated bid cannot be edited again — mock behaviour)', () => {
  assert.equal(bid.rules.edit('Pending'), null)
  for (const s of ['Updated', 'Withdrawn', 'Accepted', 'Rejected']) assert.equal(bid.rules.edit(s), 'Only a pending proposal can be edited.')
})

test('bid.withdraw: Pending/Updated only; other states use the lower-cased status in the message', () => {
  assert.equal(bid.rules.withdraw('Pending'), null)
  assert.equal(bid.rules.withdraw('Updated'), null)
  for (const s of ['Accepted', 'Rejected', 'Withdrawn']) assert.equal(bid.rules.withdraw(s), `A ${s.toLowerCase()} proposal cannot be withdrawn.`)
})

test('bid.accept transition table: job is checked first, then the bid', () => {
  const jobStates = ['Draft', 'Published', 'In Progress', 'Completed', 'Closed', 'Cancelled']
  const bidStates = C.BID_STATUSES
  for (const j of jobStates) {
    for (const b of bidStates) {
      const out = bid.rules.accept(j, b)
      if (j !== 'Published') assert.equal(out, 'This job is no longer open for hiring.', `${j}/${b}`)
      else if (b === 'Pending' || b === 'Updated') assert.equal(out, null, `${j}/${b}`)
      else assert.equal(out, `This proposal is ${b.toLowerCase()} and can no longer be accepted.`, `${j}/${b}`)
    }
  }
})

// ── Contract state machine ──────────────────────────────────────────────────────────────────
test('contract.start / complete: exactly one legal source state each', () => {
  for (const s of C.CONTRACT_STATUSES) {
    assert.equal(contract.rules.start(s), s === 'Pending Start' ? null : 'Only a contract pending start can be started.')
    assert.equal(contract.rules.complete(s), s === 'Active' ? null : 'Only an active contract can be completed.')
  }
})

test('contract.cancel: Pending Start and Active only; every final state is refused with the mock text', () => {
  assert.equal(contract.rules.cancel('Pending Start'), null)
  assert.equal(contract.rules.cancel('Active'), null)
  for (const s of ['Completed', 'Cancelled', 'Terminated']) assert.equal(contract.rules.cancel(s), 'A completed or already-cancelled contract cannot be cancelled.')
})

test('contract.requestTermination: Active only, and only one request at a time', () => {
  assert.equal(contract.rules.requestTermination('Active', null), null)
  for (const s of ['Pending Start', 'Completed', 'Cancelled', 'Terminated']) assert.equal(contract.rules.requestTermination(s, null), 'Only an active contract can be terminated.')
  assert.equal(contract.rules.requestTermination('Active', 'Client'), 'A termination request is already pending on this contract.')
})

test('contract.respond: needs a pending request; only the OTHER party may approve, either may decline/withdraw', () => {
  assert.equal(contract.rules.hasPendingRequest(null), 'There is no pending termination request on this contract.')
  assert.equal(contract.rules.hasPendingRequest('Client'), null)
  assert.equal(contract.canRespond('Client', 'Freelancer', true), true)
  assert.equal(contract.canRespond('Client', 'Client', true), false) // cannot approve your own request
  assert.equal(contract.canRespond('Client', 'Client', false), true) // the UI's "Withdraw termination request"
  assert.equal(contract.canRespond('Client', 'Freelancer', false), true)
})

test('contract.splitBudget: floor(budget/n) each, the last one takes the remainder (mock rule)', () => {
  assert.deepEqual(contract.splitBudget(45000, 2), [22500, 22500])
  assert.deepEqual(contract.splitBudget(10000, 3), [3333, 3333, 3334])
  assert.deepEqual(contract.splitBudget(9000, 1), [9000])
  assert.deepEqual(contract.splitBudget(9000, 0), [])
  assert.equal(contract.splitBudget(100, 4).reduce((a, b) => a + b, 0), 100)
})

// ── Milestone state machine ─────────────────────────────────────────────────────────────────
test('milestone.edit / remove: only Pending AND unfunded', () => {
  assert.equal(milestone.rules.edit('Pending', false), null)
  assert.equal(milestone.rules.remove('Pending', false), null)
  assert.equal(milestone.rules.edit('Submitted', false), 'A milestone that is submitted can no longer be edited.')
  assert.equal(milestone.rules.edit('Completed', true), 'A milestone that is completed can no longer be edited.')
  assert.equal(milestone.rules.remove('Submitted', false), 'A milestone that is submitted can no longer be deleted.')
  assert.equal(milestone.rules.remove('Completed', true), 'A milestone that is completed can no longer be deleted.')
  assert.equal(milestone.rules.edit('Pending', true), 'A funded milestone can no longer be edited.')
  assert.equal(milestone.rules.remove('Pending', true), 'A funded milestone can no longer be deleted.')
})

test('milestone.submit: not-funded is reported before status; contract must be Active', () => {
  assert.equal(milestone.rules.submit('Pending', true, 'Active'), null)
  assert.equal(milestone.rules.submit('Pending', false, 'Active'), 'The client has not funded this milestone yet.')
  assert.equal(milestone.rules.submit('Submitted', false, 'Active'), 'The client has not funded this milestone yet.')
  assert.equal(milestone.rules.submit('Submitted', true, 'Active'), 'This milestone has already been submitted.')
  assert.equal(milestone.rules.submit('Completed', true, 'Active'), 'This milestone has already been submitted.')
  assert.equal(milestone.rules.submit('Pending', true, 'Terminated'), 'Only a milestone on an active contract can be submitted.')
})

test('milestone.reject / approve: Submitted only; approve also needs a Held payment', () => {
  for (const s of C.MILESTONE_STATUSES) {
    assert.equal(milestone.rules.reject(s), s === 'Submitted' ? null : 'Only a submitted milestone can be rejected.')
    assert.equal(milestone.rules.approve(s), s === 'Submitted' ? null : 'This milestone must be submitted by the freelancer before it can be approved.')
  }
  assert.equal(milestone.rules.approvePaid(true), null)
  assert.equal(milestone.rules.approvePaid(false), 'This milestone has not been paid to the platform yet.')
})

test('milestone.create: no new work on a finished contract; Pending Start and Active are fine', () => {
  assert.equal(milestone.rules.create('Pending Start'), null)
  assert.equal(milestone.rules.create('Active'), null)
  for (const s of ['Completed', 'Cancelled', 'Terminated']) assert.match(milestone.rules.create(s), /cannot be added/)
})

// ── Validators ──────────────────────────────────────────────────────────────────────────────
test('validateBid: whitelists bidAmount + proposal only, coerces the amount', () => {
  const { req } = run(bv.validateBid, body({ bidAmount: '4200', proposal: '  <b>Hi</b> there ', freelancerId: S1, status: 'Accepted', jobId: S2, bidDate: 'x' }))
  assert.deepEqual(req.body, { bidAmount: 4200, proposal: 'Hi there' })
})

test('validateBid: bad amount / empty proposal give the plain message (no "Validation failed" prefix)', () => {
  for (const amount of [0, -5, 'abc', '', null, undefined, true]) {
    assert.equal(run(bv.validateBid, body({ bidAmount: amount, proposal: 'x' })).error.message, 'Enter a valid bid amount.')
  }
  assert.equal(run(bv.validateBid, body({ bidAmount: 10, proposal: '   ' })).error.message, 'Write a proposal before submitting.')
  assert.equal(run(bv.validateBid, body({ bidAmount: 10, proposal: 'x'.repeat(5001) })).error.statusCode, 400)
})

test('validateMilestoneBody: exact mock message; whitelist; optional dueDate', () => {
  for (const b of [{}, { title: '', amount: 5 }, { title: 'A', amount: 0 }, { title: 'A', amount: 'x' }, { title: 'A' }]) {
    const { error } = run(mv.validateMilestoneBody, body(b))
    assert.equal(error.statusCode, 400)
    assert.equal(error.message, 'A title and a positive amount are required.')
  }
  const ok = run(mv.validateMilestoneBody, body({ title: ' Design ', amount: '1500', dueDate: '2026-12-01', funded: true, status: 'Completed', contractId: S1 })).req
  assert.deepEqual(ok.body, { title: 'Design', amount: 1500, dueDate: '2026-12-01' })
  assert.equal(run(mv.validateMilestoneBody, body({ title: 'A', amount: 1 })).req.body.dueDate, null)
  assert.equal(run(mv.validateMilestoneBody, body({ title: 'A', amount: 1, dueDate: 'nope' })).error.message, 'Enter a valid due date.')
})

test('reason validators: optional text, trimmed, `requestedByRole` and other keys dropped', () => {
  const r = run(cv.validateTerminationRequest, body({ reason: '  scope changed ', requestedByRole: 'Client', status: 'Terminated' })).req
  assert.deepEqual(r.body, { reason: 'scope changed' })
  assert.deepEqual(run(cv.validateCancelContract, body({})).req.body, { reason: null })
  assert.equal(run(cv.validateCancelContract, body({ reason: 'x'.repeat(501) })).error.statusCode, 400)
  assert.equal(run(mv.validateRejectMilestone, body({ reason: 5 })).error.statusCode, 400)
})

test('validateTerminationResponse: approve must be a real boolean', () => {
  assert.deepEqual(run(cv.validateTerminationResponse, body({ approve: true, extra: 1 })).req.body, { approve: true })
  assert.deepEqual(run(cv.validateTerminationResponse, body({ approve: false })).req.body, { approve: false })
  for (const a of ['false', 'true', 0, 1, null, undefined]) assert.equal(run(cv.validateTerminationResponse, body({ approve: a })).error.statusCode, 400)
})

// ── DTOs ────────────────────────────────────────────────────────────────────────────────────
test('toBidDTO: the frontend bid shape (bidId, ISO bidDate), no leaked _id/isActive', () => {
  const out = dto.toBidDTO({ _id: S1, jobId: S2, freelancerId: S2, bidAmount: 42000, status: 'Pending', bidDate: new Date('2025-08-03T09:00:00Z'), proposal: 'p', isActive: true, __v: 0 })
  assert.deepEqual(out, { bidId: S1, jobId: S2, freelancerId: S2, bidAmount: 42000, status: 'Pending', bidDate: '2025-08-03T09:00:00.000Z', proposal: 'p' })
})

test('toContractDTO: null dates while Pending Start; termination fields always present; cancellationReason only when set', () => {
  const pending = dto.toContractDTO({ _id: S1, jobId: S2, clientId: S1, freelancerId: S2, status: 'Pending Start' })
  assert.deepEqual(pending, { contractId: S1, jobId: S2, clientId: S1, freelancerId: S2, startDate: null, endDate: null, status: 'Pending Start', terminationRequestedBy: null, terminationReason: null })
  const cancelled = dto.toContractDTO({ _id: S1, jobId: S2, clientId: S1, freelancerId: S2, status: 'Cancelled', cancellationReason: 'x', endDate: new Date('2025-01-01T00:00:00Z') })
  assert.equal(cancelled.cancellationReason, 'x')
  assert.equal(cancelled.endDate, '2025-01-01T00:00:00.000Z')
})

test('toMilestoneDTO / toPaymentDTO: frontend field names', () => {
  const m = dto.toMilestoneDTO({ _id: S1, contractId: S2, title: 'M', amount: 5, status: 'Pending' })
  assert.deepEqual(m, { milestoneId: S1, contractId: S2, title: 'M', taskSpec: null, amount: 5, status: 'Pending', dueDate: null, funded: false, rejectionReason: null })
  const p = dto.toPaymentDTO({ _id: S1, milestoneId: S2, amount: 9, status: 'Held', providerPaymentId: 'pay_1', paidAt: new Date('2025-02-02T00:00:00Z') })
  assert.deepEqual(p, { paymentId: S1, milestoneId: S2, contractId: null, amount: 9, paymentDate: '2025-02-02T00:00:00.000Z', paymentStatus: 'Held', razorpayPaymentId: 'pay_1', adminVerified: false, adminVerifiedAt: null, approvedAt: null, payoutTo: null, payoutId: null })
})

// ── Constants stay in sync with the frontend ────────────────────────────────────────────────
test('constants: statuses match the frontend lists', () => {
  assert.deepEqual(C.CONTRACT_STATUSES, ['Pending Start', 'Active', 'Completed', 'Cancelled', 'Terminated'])
  assert.deepEqual(C.BID_STATUSES, ['Pending', 'Updated', 'Withdrawn', 'Accepted', 'Rejected'])
  assert.deepEqual(C.EDITABLE_MILESTONE_STATUSES, ['Pending'])
})
