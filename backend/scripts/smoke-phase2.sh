#!/usr/bin/env bash
# Phase 2 acceptance smoke test against a RUNNING backend with a SEEDED database.
#   cd backend && npm run seed -- --reset && npm run dev        (terminal 1; needs MongoDB)
#   bash scripts/smoke-phase2.sh                                (terminal 2)
# Requires: curl, node. Set BASE=http://host:port/api to override.
set -u
BASE="${BASE:-http://localhost:5000/api}"
PASS="Password@123"
fails=0
json() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s);console.log($1)}catch(e){console.log('')}})"; }
login() { curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$1\",\"password\":\"$PASS\"}" | json 'j.data.token'; }
call() { # method path token [body] -> prints "<status> <body>"
  local m=$1 p=$2 t=$3 b=${4:-}
  if [ -n "$b" ]; then curl -s -o /tmp/ff_body -w '%{http_code}' -X "$m" "$BASE$p" -H "Authorization: Bearer $t" -H 'Content-Type: application/json' -d "$b"
  else curl -s -o /tmp/ff_body -w '%{http_code}' -X "$m" "$BASE$p" -H "Authorization: Bearer $t"; fi
}
check() { # name expected actual
  if [ "$2" = "$3" ]; then echo "  ok   $1"; else echo "  FAIL $1 (expected $2, got $3)"; fails=$((fails+1)); fi
}
body() { cat /tmp/ff_body | json "$1"; }

CLIENT=$(login aisha.verma@technova.com); OTHER=$(login rohan.malhotra@brightideas.co)
FL=$(login meera.iyer@dev.com); ADMIN=$(login admin@platform.com)
[ -n "$CLIENT" ] && [ -n "$FL" ] && [ -n "$ADMIN" ] || { echo "login failed - is the backend running and seeded?"; exit 1; }
CID=$(curl -s "$BASE/auth/me" -H "Authorization: Bearer $CLIENT" | json 'j.data.userId || j.data.id || j.data.user?.userId')
FID=$(curl -s "$BASE/auth/me" -H "Authorization: Bearer $FL" | json 'j.data.userId || j.data.id || j.data.user?.userId')

echo "skills"
check "list (8 seeded)" 8 "$(call GET /skills $CLIENT >/dev/null; body 'j.data.length')"
S1=$(body 'j.data[0].skillId'); check "first skill is React" React "$(body 'j.data[0].skillName')"
check "non-admin cannot create" 403 "$(call POST /skills $CLIENT '{"skillName":"Go"}')"
check "admin creates" 201 "$(call POST /skills $ADMIN '{"skillName":"Go"}')"; NEW=$(body 'j.data.skillId')
check "duplicate rejected" 409 "$(call POST /skills $ADMIN '{"skillName":"go"}')"
check "admin deletes unused" 200 "$(call DELETE /skills/$NEW $ADMIN)"
check "used skill cannot be deleted" 409 "$(call DELETE /skills/$S1 $ADMIN)"

echo "jobs: create -> edit -> publish -> browse -> cancel"
check "create (draft)" 201 "$(call POST /jobs $CLIENT "{\"title\":\"Smoke job\",\"description\":\"d\",\"budget\":5000,\"category\":\"Design\",\"experienceLevel\":\"Entry\",\"requiredSkillIds\":[\"$S1\"],\"milestoneTasks\":[\"one\"]}")"
JOB=$(body 'j.data.jobId'); check "starts as Draft" Draft "$(body 'j.data.status')"
check "freelancer cannot create" 403 "$(call POST /jobs $FL '{"title":"x","description":"d","budget":1}')"
check "draft invisible to freelancers" 404 "$(call GET /jobs/$JOB $FL)"
check "other client cannot edit" 403 "$(call PUT /jobs/$JOB $OTHER '{"title":"hack"}')"
check "owner edits" 200 "$(call PUT /jobs/$JOB $CLIENT '{"budget":6000}')"
check "invalid budget" 400 "$(call PUT /jobs/$JOB $CLIENT '{"budget":-1}')"
check "publish" 200 "$(call PATCH /jobs/$JOB/publish $CLIENT)"
check "publish twice rejected" 400 "$(call PATCH /jobs/$JOB/publish $CLIENT)"
call GET "/jobs/open?search=Smoke&skillId=$S1&category=Design&experienceLevel=Entry&budgetMin=5000&budgetMax=7000&sortBy=budgetHigh" $FL >/dev/null
check "browse finds it with every filter" 1 "$(body 'j.data.filter(x=>x.jobId==="'$JOB'").length')"
call GET "/jobs/open?experienceLevel=Expert&search=Smoke" $FL >/dev/null
check "filter excludes it" 0 "$(body 'j.data.length')"
check "freelancer job details" 200 "$(call GET /freelancers/$FID/jobs/$JOB $FL)"
check "cannot delete a published job" 400 "$(call DELETE /jobs/$JOB $CLIENT)"
check "cancel" 200 "$(call PATCH /jobs/$JOB/cancel $CLIENT '{"reason":"smoke"}')"
call GET /jobs/open?search=Smoke $FL >/dev/null
check "cancelled job leaves Browse Jobs" 0 "$(body 'j.data.length')"
check "cancelled job cannot be edited" 400 "$(call PUT /jobs/$JOB $CLIENT '{"title":"x"}')"
check "client job list" 200 "$(call GET /clients/$CID/jobs $CLIENT)"
check "cannot read another client's list" 403 "$(call GET /clients/$CID/jobs $OTHER)"
check "draft delete" 200 "$(call POST /jobs $CLIENT '{"title":"tmp","description":"d","budget":1}' >/dev/null; call DELETE /jobs/$(body 'j.data.jobId') $CLIENT)"

echo "discovery"
check "clients can search" 200 "$(call GET '/freelancers?sortBy=rateLow&minRating=4' $CLIENT)"
check "flagged freelancer (Neha) is hidden" 0 "$(call GET '/freelancers?search=Neha' $CLIENT >/dev/null; body 'j.data.length')"
check "freelancers cannot search freelancers" 403 "$(call GET /freelancers $FL)"

echo "profiles"
check "freelancer profile (as client)" 200 "$(call GET /freelancers/$FID/profile $CLIENT)"
check "payout account hidden from others" null "$(body 'j.data.paymentAccount')"
check "owner edits profile" 200 "$(call PUT /freelancers/$FID/profile $FL '{"bio":"Smoke bio","hourlyRate":1900}')"
check "hourlyRate 0 rejected" 400 "$(call PUT /freelancers/$FID/profile $FL '{"hourlyRate":0}')"
check "cannot edit someone else's profile" 403 "$(call PUT /freelancers/$FID/profile $CLIENT '{"bio":"x"}')"
check "save payout account" 200 "$(call PUT /freelancers/$FID/extras $FL '{"paymentAccount":{"holderName":"Meera Iyer","bankName":"HDFC","accountNumber":"123456789012","ifsc":"HDFC0001234"}}')"
check "owner sees payout account" 123456789012 "$(call GET /freelancers/$FID/profile $FL >/dev/null; body 'j.data.paymentAccount.accountNumber')"
check "save past projects" 200 "$(call PUT /freelancers/$FID/extras $FL '{"pastProjects":[{"title":"Shop","description":"","year":"2024","link":""}]}')"
check "client profile edit (name)" 200 "$(call PUT /clients/$CID/profile $CLIENT '{"name":"Aisha Verma","companyName":"TechNova Solutions"}')"

echo; [ $fails -eq 0 ] && echo "ALL PASSED" || { echo "$fails FAILED"; exit 1; }
