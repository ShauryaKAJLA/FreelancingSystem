#!/usr/bin/env bash
# Phase 3 acceptance smoke test against a RUNNING backend with a SEEDED database (needs MongoDB).
#   cd backend && npm run seed -- --reset && npm run dev        (terminal 1)
#   bash scripts/smoke-phase3.sh                                (terminal 2, from backend/)
# Requires: curl, node. Set BASE=http://host:port/api to override.
# Funding is Phase 4 (Razorpay), so the script flips `funded` directly in MongoDB via backend/.env (MONGODB_URI).
set -u
BASE="${BASE:-http://localhost:5000/api}"
PASS="Password@123"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
fails=0
json() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s);console.log($1)}catch(e){console.log('')}})"; }
login() { curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$1\",\"password\":\"$PASS\"}" | json 'j.data.token'; }
call() { # method path token [body] -> prints the HTTP status; body lands in /tmp/ff_body
  local m=$1 p=$2 t=$3 b=${4:-}
  if [ -n "$b" ]; then curl -s -o /tmp/ff_body -w '%{http_code}' -X "$m" "$BASE$p" -H "Authorization: Bearer $t" -H 'Content-Type: application/json' -d "$b"
  else curl -s -o /tmp/ff_body -w '%{http_code}' -X "$m" "$BASE$p" -H "Authorization: Bearer $t"; fi
}
check() { if [ "$2" = "$3" ]; then echo "  ok   $1"; else echo "  FAIL $1 (expected $2, got $3)"; fails=$((fails+1)); fi; }
body() { cat /tmp/ff_body | json "$1"; }
fund_in_db() { # milestoneId - stands in for Phase 4's Razorpay flow
  (cd "$HERE" && node -e "require('dotenv').config();const m=require('mongoose');const M=require('./src/models/Milestone');m.connect(process.env.MONGODB_URI).then(()=>M.updateOne({_id:'$1'},{\$set:{funded:true}})).then(()=>m.disconnect())")
}
uid() { curl -s "$BASE/auth/me" -H "Authorization: Bearer $1" | json 'j.data.userId || j.data.id || j.data.user?.userId'; }

CLIENT=$(login aisha.verma@technova.com); OTHER=$(login rohan.malhotra@brightideas.co)
FL=$(login meera.iyer@dev.com); FL2=$(login karan.shah@design.com); ADMIN=$(login admin@platform.com)
[ -n "$CLIENT" ] && [ -n "$FL" ] && [ -n "$FL2" ] && [ -n "$ADMIN" ] || { echo "login failed - is the backend running and seeded?"; exit 1; }
CID=$(uid $CLIENT); FID=$(uid $FL); FID2=$(uid $FL2)

echo "seed data"
call GET /freelancers/$FID/bids $FL >/dev/null
check "Meera has 2 seeded bids" 2 "$(body 'j.data.length')"
check "her accepted bid shows the Active contract" Active "$(body 'j.data.find(b=>b.status==="Accepted").contractStatus')"

echo "post a job (2 milestone tasks) and collect bids"
call POST /jobs $CLIENT '{"title":"Phase3 smoke","description":"d","budget":10001,"category":"Design","experienceLevel":"Entry","milestoneTasks":["first","second"],"status":"Published"}' >/dev/null
JOB=$(body 'j.data.jobId')
check "job is Published" Published "$(body 'j.data.status')"
check "freelancer bids" 201 "$(call POST /jobs/$JOB/bids $FL '{"bidAmount":9000,"proposal":"I can do it","freelancerId":"000000000000000000000000","status":"Accepted"}')"
BID=$(body 'j.data.bidId')
check "body freelancerId/status ignored" "Pending:$FID" "$(body 'j.data.status+":"+j.data.freelancerId')"
check "duplicate bid -> 409" 409 "$(call POST /jobs/$JOB/bids $FL '{"bidAmount":1,"proposal":"again"}')"
check "invalid amount -> 400" 400 "$(call POST /jobs/$JOB/bids $FL2 '{"bidAmount":-1,"proposal":"x"}')"
check "client cannot bid" 403 "$(call POST /jobs/$JOB/bids $CLIENT '{"bidAmount":1,"proposal":"x"}')"
check "second freelancer bids" 201 "$(call POST /jobs/$JOB/bids $FL2 '{"bidAmount":9500,"proposal":"me too"}')"; BID2=$(body 'j.data.bidId')
call GET /clients/$CID/jobs $CLIENT >/dev/null
check "client list: bidCount 2" 2 "$(body 'j.data.find(x=>x.jobId==="'$JOB'").bidCount')"
check "client list: pendingBids carry freelancerName" true "$(body 'j.data.find(x=>x.jobId==="'$JOB'").pendingBids.every(b=>!!b.freelancerName).toString()')"
call GET /jobs/$JOB $CLIENT >/dev/null
check "job details: bids[] with rate" 2 "$(body 'j.data.bids.filter(b=>b.freelancerRate!==undefined).length')"
call GET /jobs/open?search=Phase3 $FL >/dev/null
check "Browse Jobs bidCount is real" 2 "$(body 'j.data[0].bidCount')"
call GET /freelancers/$FID/jobs/$JOB $FL >/dev/null
check "freelancer job details: myBid" "$BID" "$(body 'j.data.myBid.bidId')"

echo "edit / withdraw rules"
check "other freelancer cannot edit my bid" 404 "$(call PUT /bids/$BID $FL2 '{"bidAmount":1,"proposal":"x"}')"
check "edit Pending -> Updated" Updated "$(call PUT /bids/$BID $FL '{"bidAmount":8800,"proposal":"better"}' >/dev/null; body 'j.data.status')"
check "edit an Updated bid -> 400" 400 "$(call PUT /bids/$BID $FL '{"bidAmount":8700,"proposal":"x"}')"
check "withdraw" 200 "$(call PATCH /bids/$BID2/withdraw $FL2)"
check "withdraw twice -> 400" 400 "$(call PATCH /bids/$BID2/withdraw $FL2)"
check "re-bid after withdrawing is allowed" 201 "$(call POST /jobs/$JOB/bids $FL2 '{"bidAmount":9400,"proposal":"back again"}')"; BID3=$(body 'j.data.bidId')

echo "hire: accept is atomic"
check "other client cannot accept" 404 "$(call POST /jobs/$JOB/bids/$BID/accept $OTHER)"
check "freelancer cannot accept" 403 "$(call POST /jobs/$JOB/bids/$BID/accept $FL)"
check "owner accepts the Updated bid" 200 "$(call POST /jobs/$JOB/bids/$BID/accept $CLIENT)"
CT=$(body 'j.data.contractId'); check "contract is Pending Start with null dates" "Pending Start:null" "$(body 'j.data.status+":"+j.data.startDate')"
call GET /freelancers/$FID2/bids $FL2 >/dev/null
check "sibling bid became Rejected" Rejected "$(body 'j.data.find(b=>b.bidId==="'$BID3'").status')"
check "withdrawn sibling stayed Withdrawn" Withdrawn "$(body 'j.data.find(b=>b.bidId==="'$BID2'").status')"
call GET /jobs/$JOB $CLIENT >/dev/null; check "job is In Progress" "In Progress" "$(body 'j.data.status')"
check "accepting again -> 400 (hiring closed)" 400 "$(call POST /jobs/$JOB/bids/$BID3/accept $CLIENT)"
check "bidding on it now -> 400" 400 "$(call POST /jobs/$JOB/bids $FL2 '{"bidAmount":1,"proposal":"late"}')"

echo "contract: access + start"
check "stranger gets 404" 404 "$(call GET /contracts/$CT $OTHER)"
check "admin is read-only here (403)" 403 "$(call GET /contracts/$CT $ADMIN)"
check "freelancer cannot start" 403 "$(call PATCH /contracts/$CT/start $FL)"
check "client starts" 200 "$(call PATCH /contracts/$CT/start $CLIENT)"
check "firstMilestone returned" "Milestone 1" "$(body 'j.data.firstMilestone.title')"
check "start twice -> 400" 400 "$(call PATCH /contracts/$CT/start $CLIENT)"
call GET /contracts/$CT $CLIENT >/dev/null
check "client details: 2 milestones, 5000 + 5001" "2:10001" "$(body 'j.data.milestones.length+":"+j.data.milestones.reduce((a,m)=>a+m.amount,0)')"
check "client details carry job, reviews[], names" "true" "$(body '(!!j.data.job && Array.isArray(j.data.reviews) && !!j.data.clientName && !!j.data.freelancerName).toString()')"
M1=$(body 'j.data.milestones[0].milestoneId')
call GET /contracts/$CT $FL >/dev/null
check "freelancer details: no reviews key" false "$(body '("reviews" in j.data).toString()')"
call GET /clients/$CID/contracts $CLIENT >/dev/null; check "client contract list" "true" "$(body 'j.data.some(c=>c.contractId==="'$CT'" && c.jobTitle==="Phase3 smoke")')"
call GET /freelancers/$FID/contracts $FL >/dev/null; check "freelancer contract list" "true" "$(body 'j.data.some(c=>c.contractId==="'$CT'" && !!c.clientName)')"

echo "milestones: edit rules, submit -> reject -> resubmit"
check "freelancer cannot add milestones" 403 "$(call POST /contracts/$CT/milestones $FL '{"title":"x","amount":1}')"
check "add milestone" 201 "$(call POST /contracts/$CT/milestones $CLIENT '{"title":"Extra","amount":500,"funded":true,"status":"Completed"}')"; MX=$(body 'j.data.milestoneId')
check "funded/status in body ignored" "false:Pending" "$(body 'j.data.funded+":"+j.data.status')"
check "bad milestone body -> mock text" "A title and a positive amount are required." "$(call POST /contracts/$CT/milestones $CLIENT '{"title":"","amount":0}' >/dev/null; body 'j.message')"
check "edit milestone" 200 "$(call PUT /milestones/$MX $CLIENT '{"title":"Extra 2","amount":600}')"
check "delete milestone" 200 "$(call DELETE /milestones/$MX $CLIENT)"
check "submit before funding -> 400" "The client has not funded this milestone yet." "$(call PATCH /milestones/$M1/submit $FL >/dev/null; body 'j.message')"
fund_in_db "$M1"
check "funded milestone cannot be edited" 400 "$(call PUT /milestones/$M1 $CLIENT '{"title":"x","amount":1}')"
check "funded milestone cannot be deleted" 400 "$(call DELETE /milestones/$M1 $CLIENT)"
check "client cannot submit" 403 "$(call PATCH /milestones/$M1/submit $CLIENT)"
check "freelancer submits" Submitted "$(call PATCH /milestones/$M1/submit $FL >/dev/null; body 'j.data.status')"
check "submit twice -> 400" 400 "$(call PATCH /milestones/$M1/submit $FL)"
check "freelancer cannot reject" 403 "$(call PATCH /milestones/$M1/reject $FL '{"reason":"x"}')"
check "client rejects with reason" "Pending:needs work" "$(call PATCH /milestones/$M1/reject $CLIENT '{"reason":"needs work"}' >/dev/null; body 'j.data.status+":"+j.data.rejectionReason')"
check "reject a Pending milestone -> 400" 400 "$(call PATCH /milestones/$M1/reject $CLIENT '{"reason":"x"}')"
check "resubmit" Submitted "$(call PATCH /milestones/$M1/submit $FL >/dev/null; body 'j.data.status')"
check "approve without a Held payment -> 400 (Phase 4 funds it for real)" "This milestone has not been paid to the platform yet." "$(call POST /milestones/$M1/release-payment $CLIENT >/dev/null; body 'j.message')"

echo "termination"
check "freelancer requests (role from token; body role ignored)" "Freelancer" "$(call POST /contracts/$CT/termination-request $FL '{"reason":"conflict","requestedByRole":"Client"}' >/dev/null; body 'j.data.terminationRequestedBy')"
check "second request -> 400" 400 "$(call POST /contracts/$CT/termination-request $CLIENT '{"reason":"x"}')"
check "requester cannot approve own request" 403 "$(call POST /contracts/$CT/termination-response $FL '{"approve":true}')"
check "approve must be a boolean" 400 "$(call POST /contracts/$CT/termination-response $CLIENT '{"approve":"true"}')"
check "requester can withdraw" "null" "$(call POST /contracts/$CT/termination-response $FL '{"approve":false}' >/dev/null; body 'String(j.data.terminationRequestedBy)')"
check "respond with nothing pending -> 400" 400 "$(call POST /contracts/$CT/termination-response $CLIENT '{"approve":true}')"
call POST /contracts/$CT/termination-request $FL '{"reason":"really"}' >/dev/null
check "other party approves -> Terminated" Terminated "$(call POST /contracts/$CT/termination-response $CLIENT '{"approve":true}' >/dev/null; body 'j.data.status')"
check "cannot complete a terminated contract" 400 "$(call PATCH /contracts/$CT/complete $CLIENT)"
check "cannot cancel a terminated contract" 400 "$(call PATCH /contracts/$CT/cancel $CLIENT '{"reason":"x"}')"
call GET /jobs/$JOB $CLIENT >/dev/null; check "job moved to Closed" Closed "$(body 'j.data.status')"

echo "cancelling a job rejects its pending bids"
call POST /jobs $CLIENT '{"title":"Phase3 cancel","description":"d","budget":100,"status":"Published"}' >/dev/null; J2=$(body 'j.data.jobId')
call POST /jobs/$J2/bids $FL '{"bidAmount":50,"proposal":"p"}' >/dev/null; B2=$(body 'j.data.bidId')
check "cancel job" 200 "$(call PATCH /jobs/$J2/cancel $CLIENT '{"reason":"smoke"}')"
call GET /freelancers/$FID/bids $FL >/dev/null
check "its pending bid is Rejected" Rejected "$(body 'j.data.find(b=>b.bidId==="'$B2'").status')"

echo "complete + cancel on a fresh hire (Pending Start can be cancelled)"
call POST /jobs $CLIENT '{"title":"Phase3 cancel contract","description":"d","budget":100,"milestoneTasks":["a"],"status":"Published"}' >/dev/null; J3=$(body 'j.data.jobId')
call POST /jobs/$J3/bids $FL '{"bidAmount":50,"proposal":"p"}' >/dev/null; B3=$(body 'j.data.bidId')
call POST /jobs/$J3/bids/$B3/accept $CLIENT >/dev/null; C3=$(body 'j.data.contractId')
check "complete a Pending Start contract -> 400" 400 "$(call PATCH /contracts/$C3/complete $CLIENT)"
check "cancel with a reason" "Cancelled:no longer needed" "$(call PATCH /contracts/$C3/cancel $CLIENT '{"reason":"no longer needed"}' >/dev/null; body 'j.data.status+":"+j.data.cancellationReason')"
check "cancel twice -> 400" 400 "$(call PATCH /contracts/$C3/cancel $CLIENT '{"reason":"x"}')"

echo
if [ $fails -eq 0 ]; then echo "ALL PHASE 3 CHECKS PASSED"; else echo "$fails CHECK(S) FAILED"; exit 1; fi
