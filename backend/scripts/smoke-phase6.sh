#!/usr/bin/env bash
# Phase 6 acceptance smoke test (admin, issues, search) against a RUNNING backend with a FRESHLY SEEDED database.
#   cd backend && npm run seed -- --reset && npm run dev     (terminal 1)
#   bash scripts/smoke-phase6.sh                             (terminal 2, from backend/)
# Requires: curl, node. Set BASE=http://host:port/api to override. Re-running needs a re-seed (it flags a user and resolves an issue).
set -u
BASE="${BASE:-http://localhost:5000/api}"
PASS="Password@123"
fails=0
json() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s);console.log($1)}catch(e){console.log('')}})"; }
login() { curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$1\",\"password\":\"$PASS\"}" | json 'j.data.token'; }
call() { local m=$1 p=$2 t=$3 b=${4:-}
  if [ -n "$b" ]; then curl -s -o /tmp/ff_body -w '%{http_code}' -X "$m" "$BASE$p" -H "Authorization: Bearer $t" -H 'Content-Type: application/json' -d "$b"
  else curl -s -o /tmp/ff_body -w '%{http_code}' -X "$m" "$BASE$p" -H "Authorization: Bearer $t"; fi; }
check() { if [ "$2" = "$3" ]; then echo "  ok   $1"; else echo "  FAIL $1 (expected $2, got $3)"; fails=$((fails+1)); fi; }
body() { cat /tmp/ff_body | json "$1"; }
uid() { curl -s "$BASE/auth/me" -H "Authorization: Bearer $1" | json 'j.data.userId || j.data.id || j.data.user?.userId'; }

AISHA=$(login aisha.verma@technova.com); ROHAN=$(login rohan.malhotra@brightideas.co)
MEERA=$(login meera.iyer@dev.com); KARAN=$(login karan.shah@design.com); ADMIN=$(login admin@platform.com)
[ -n "$AISHA" ] && [ -n "$MEERA" ] && [ -n "$ROHAN" ] && [ -n "$KARAN" ] && [ -n "$ADMIN" ] || { echo "login failed - is the backend running and seeded?"; exit 1; }
AID=$(uid $AISHA); MID=$(uid $MEERA); KID=$(uid $KARAN); ADID=$(uid $ADMIN)

echo "admin gate (every /admin route is Admin-only)"
for p in /admin/dashboard /admin/users /admin/transactions /admin/contracts /admin/reviews /admin/issues /admin/actions /admin/jobs/open; do
  check "client blocked from $p" 403 "$(call GET $p $AISHA)"; done
check "no token" 401 "$(curl -s -o /dev/null -w '%{http_code}' $BASE/admin/dashboard)"

echo "dashboard + lists (mock shapes)"
check "dashboard" 200 "$(call GET /admin/dashboard $ADMIN)"
check "dashboard keys" true "$(body '["totalUsers","totalClients","totalFreelancers","openJobs","activeContracts","flaggedUsers","openIssues","totalPlatformPayments","awaitingPayoutCount","awaitingPayoutAmount"].every(k=>typeof j.data[k]==="number")')"
check "users is a plain array of DTOs" true "$(call GET /admin/users $ADMIN >/dev/null; body 'Array.isArray(j.data)&&j.data.every(u=>u.userId&&u.email&&u.role&&u.status&&!u.passwordHash)')"
check "users filter by role" true "$(call GET '/admin/users?role=Freelancer' $ADMIN >/dev/null; body 'j.data.length>0&&j.data.every(u=>u.role==="Freelancer")')"
check "user details (freelancer) has profile.contracts" true "$(call GET /admin/users/$MID $ADMIN >/dev/null; body 'Array.isArray(j.data.profile.contracts)')"
check "user details (client) has profile.jobsPosted" true "$(call GET /admin/users/$AID $ADMIN >/dev/null; body 'Array.isArray(j.data.profile.jobsPosted)')"
check "unknown user" 404 "$(call GET /admin/users/aaaaaaaaaaaaaaaaaaaaaaaa $ADMIN)"
check "transactions rows are joined" true "$(call GET /admin/transactions $ADMIN >/dev/null; body 'j.data.length>0&&j.data.every(p=>p.paymentId&&p.clientName&&p.freelancerName&&"milestoneTitle" in p)')"
PAY=$(body 'j.data[0].paymentId')
check "payment details + freelancerAccount key" true "$(call GET /admin/payments/$PAY $ADMIN >/dev/null; body '"freelancerAccount" in j.data&&j.data.milestone&&j.data.contract')"
check "contracts list joined" true "$(call GET /admin/contracts $ADMIN >/dev/null; body 'j.data.length>0&&j.data.every(c=>c.jobTitle&&c.clientName&&c.freelancerName)')"
CT=$(body 'j.data[0].contractId')
check "contract details has milestones + reviews" true "$(call GET /admin/contracts/$CT $ADMIN >/dev/null; body 'Array.isArray(j.data.milestones)&&Array.isArray(j.data.reviews)&&j.data.job')"
check "open jobs only Published, with bidCount" true "$(call GET /admin/jobs/open $ADMIN >/dev/null; body 'j.data.length>0&&j.data.every(x=>x.status==="Published"&&typeof x.bidCount==="number")')"

echo "user flag / restore (takes effect on the very next request)"
check "cannot flag yourself" 400 "$(call PATCH /admin/users/$ADID/status $ADMIN)"
check "flag Karan" 200 "$(call PATCH /admin/users/$KID/status $ADMIN)"
check "  ...status Flagged" Flagged "$(body 'j.data.status')"
check "flagged user is locked out immediately" 403 "$(call GET /notifications/$KID $KARAN)"
check "restore Karan" 200 "$(call PATCH /admin/users/$KID/status $ADMIN)"
check "  ...status Active" Active "$(body 'j.data.status')"
check "restored user can act again" 200 "$(call GET /notifications/$KID $KARAN)"

echo "issues (raise -> admin list -> resolve -> audit log)"
call GET /clients/$AID/contracts $AISHA >/dev/null
ACTIVE=$(body 'j.data.find(c=>c.status==="Active")?.contractId')
check "empty subject uses the mock message" "Describe the issue before submitting." "$(call POST /issues $AISHA "{\"contractId\":\"$ACTIVE\",\"subject\":\"  \"}" >/dev/null; body 'j.message')"
check "stranger cannot report on the contract" 404 "$(call POST /issues $ROHAN "{\"contractId\":\"$ACTIVE\",\"subject\":\"x\"}")"
check "admin cannot raise issues" 403 "$(call POST /issues $ADMIN "{\"contractId\":\"$ACTIVE\",\"subject\":\"x\"}")"
check "party raises an issue" 201 "$(call POST /issues $AISHA "{\"contractId\":\"$ACTIVE\",\"subject\":\"Smoke: delayed delivery\",\"raisedBy\":\"$KID\"}")"
ISS=$(body 'j.data.issueId')
check "  ...reporter comes from the token" "$AID:Open" "$(body 'j.data.raisedBy+":"+j.data.status')"
call GET /notifications/$ADID $ADMIN >/dev/null
check "admin notified with a /admin/reports link" true "$(body 'j.data.items.some(n=>n.type==="issue"&&n.link==="/admin/reports")')"
check "admin issue list is joined" true "$(call GET /admin/issues $ADMIN >/dev/null; body 'j.data.some(i=>i.issueId==="'$ISS'"&&i.jobTitle&&i.raisedByName&&i.clientName&&i.freelancerName&&i.contractStatus)')"
check "a party sees only their own issues" true "$(call GET /issues $AISHA >/dev/null; body 'j.data.every(i=>i.raisedBy==="'$AID'")')"
check "non-admin cannot resolve" 403 "$(call PATCH /issues/$ISS/resolve $AISHA)"
check "admin resolves (API group 18 route)" 200 "$(call PATCH /issues/$ISS/resolve $ADMIN '{"resolution":"Talked to both sides"}')"
check "  ...Resolved" Resolved "$(body 'j.data.status')"
check "resolving twice is refused" 400 "$(call PATCH /admin/issues/$ISS/resolve $ADMIN)"
call GET /notifications/$AID $AISHA >/dev/null
check "raiser notified, link goes to their contract" true "$(body 'j.data.items.some(n=>n.type==="issue"&&/^\/client\/contracts\//.test(n.link||""))')"

echo "review moderation"
call GET /admin/reviews $ADMIN >/dev/null
RV=$(body 'j.data[0]?.reviewId')
check "reviews list carries status + names" true "$(body 'j.data.length>0&&j.data.every(r=>r.status&&r.reviewerName&&r.revieweeName)')"
check "unknown action" 400 "$(call PATCH /admin/reviews/$RV $ADMIN '{"action":"delete"}')"
check "hide" 200 "$(call PATCH /admin/reviews/$RV $ADMIN '{"action":"hide"}')"
check "  ...Hidden" Hidden "$(body 'j.data.status')"
check "approve again" 200 "$(call PATCH /admin/reviews/$RV $ADMIN '{"action":"approve"}')"

echo "audit log (every admin write appears)"
call GET /admin/actions $ADMIN >/dev/null
for t in "Account Flag" "Account Restored" "Dispute Resolution" "Review Moderation"; do
  check "log has '$t'" true "$(body 'j.data.some(a=>a.actionType==="'"$t"'"&&a.adminName&&a.actionDate)')"; done

echo "admin profile"
check "read own" 200 "$(call GET /admin/profile/$ADID $ADMIN)"
check "cannot read another admin's" 403 "$(call GET /admin/profile/$AID $ADMIN)"
check "empty name (mock message)" "Name is required." "$(call PUT /admin/profile/$ADID $ADMIN '{"name":" "}' >/dev/null; body 'j.message')"
check "duplicate email" 409 "$(call PUT /admin/profile/$ADID $ADMIN '{"email":"aisha.verma@technova.com"}')"
check "edit name" 200 "$(call PUT /admin/profile/$ADID $ADMIN '{"name":"System Admin"}')"

echo "workspace search (own workspace only)"
check "client search" 200 "$(call GET '/search/client?query=a' $AISHA)"
check "client search result shape" true "$(body 'Array.isArray(j.data)&&j.data.length<=8&&j.data.every(r=>r.id&&r.label&&r.sublabel&&/^\/client\//.test(r.to))')"
check "blank query -> []" 0 "$(call GET '/search/client?query=' $AISHA >/dev/null; body 'j.data.length')"
check "someone else's clientId refused" 403 "$(call GET "/search/client?clientId=$MID&query=a" $AISHA)"
check "freelancer route blocked for clients" 403 "$(call GET '/search/freelancer?query=a' $AISHA)"
check "freelancer search" 200 "$(call GET '/search/freelancer?query=a' $MEERA)"
check "admin search finds users by email" true "$(call GET '/search/admin?query=meera' $ADMIN >/dev/null; body 'j.data.some(r=>r.to==="/admin/users/'$MID'")')"
check "regex characters are inert" 200 "$(call GET '/search/admin?query=(.*' $ADMIN)"

echo
[ "$fails" -eq 0 ] && echo "PHASE 6 SMOKE: ALL PASSED" || { echo "PHASE 6 SMOKE: $fails FAILED"; exit 1; }
