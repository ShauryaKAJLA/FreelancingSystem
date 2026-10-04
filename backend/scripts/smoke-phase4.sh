#!/usr/bin/env bash
# Phase 4 acceptance smoke test (payments + payment methods) against a RUNNING backend with a FRESHLY SEEDED database.
#   cd backend && cp .env.example .env    # set MONGODB_URI, JWT_SECRET, RAZORPAY_KEY_ID/SECRET, RAZORPAY_WEBHOOK_SECRET
#   npm run seed -- --reset && npm run dev                 (terminal 1)
#   bash scripts/smoke-phase4.sh                           (terminal 2, from backend/)
# Requires: curl, node. Set BASE=http://host:port/api to override.
#
# What this script CANNOT do: open Razorpay Checkout or call api.razorpay.com. It therefore
#   * inserts the Pending order row itself (what POST /payments/create-order would store), and
#   * signs the Checkout response with RAZORPAY_KEY_SECRET the way Razorpay does.
# The real create-order -> Checkout -> verify round trip with TEST keys is a MANUAL step (see INTEGRATION_PLAN.md, Phase 4).
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
uid() { curl -s "$BASE/auth/me" -H "Authorization: Bearer $1" | json 'j.data.userId || j.data.id || j.data.user?.userId'; }
envv() { (cd "$HERE" && node -e "require('dotenv').config();process.stdout.write(process.env.$1||'')"); }
hmac() { node -e "process.stdout.write(require('crypto').createHmac('sha256',process.argv[1]).update(process.argv[2]).digest('hex'))" "$1" "$2"; }

CLIENT=$(login aisha.verma@technova.com); OTHER=$(login rohan.malhotra@brightideas.co)
FL=$(login meera.iyer@dev.com); FL2=$(login karan.shah@design.com); ADMIN=$(login admin@platform.com)
[ -n "$CLIENT" ] && [ -n "$FL" ] && [ -n "$FL2" ] && [ -n "$ADMIN" ] || { echo "login failed - is the backend running and seeded?"; exit 1; }
CID=$(uid $CLIENT); FID=$(uid $FL); FID2=$(uid $FL2)
KEY_SECRET=$(envv RAZORPAY_KEY_SECRET); HOOK_SECRET=$(envv RAZORPAY_WEBHOOK_SECRET)

echo "payment methods (no raw card data ever reaches the API)"
check "raw card number is refused" 400 "$(call POST /clients/$CID/payment-methods $CLIENT '{"type":"Card","cardNumber":"4242424242424242","brand":"Visa","last4":"4242","expiry":"09/30","holderName":"Aisha"}')"
check "add card (brand/last4 only)" 201 "$(call POST /clients/$CID/payment-methods $CLIENT '{"type":"Card","brand":"Mastercard","last4":"4444","expiry":"09/30","holderName":"Aisha Verma"}')"
PM=$(body 'j.data.paymentMethodId')
check "DTO uses paymentMethodId/last4/isDefault" "Mastercard:4444:false" "$(body 'j.data.brand+":"+j.data.last4+":"+j.data.isDefault')"
call GET /clients/$CID/payment-methods $CLIENT >/dev/null
check "list is a plain array with the new card" true "$(body 'Array.isArray(j.data)&&j.data.some(m=>m.paymentMethodId==="'$PM'")')"
check "other client cannot list mine" 403 "$(call GET /clients/$CID/payment-methods $OTHER)"
check "freelancer cannot add a method" 403 "$(call POST /clients/$FID/payment-methods $FL '{"type":"Card","brand":"Visa","last4":"4242","expiry":"09/30","holderName":"x"}')"
check "other client cannot remove it (looks missing)" 404 "$(call DELETE /payment-methods/$PM $OTHER)"
check "make default" true "$(call PATCH /payment-methods/$PM/default $CLIENT >/dev/null; body 'j.data.isDefault')"
check "remove" 200 "$(call DELETE /payment-methods/$PM $CLIENT)"
check "remove returns paymentMethodId" "$PM" "$(body 'j.data.paymentMethodId')"

echo "seeded payments: shapes and privacy"
call GET /clients/$CID/payments $CLIENT >/dev/null
check "client list: plain array, >=1 row" true "$(body 'Array.isArray(j.data)&&j.data.length>=1')"
check "client row has paymentStatus + joined names" true "$(body 'j.data[0].paymentStatus==="Paid"&&!!j.data[0].freelancerName&&!!j.data[0].jobTitle&&!!j.data[0].milestoneTitle')"
PAY_SEED=$(body 'j.data[0].paymentId')
check "no Razorpay order id leaks" true "$(body '!("providerOrderId" in j.data[0])')"
call GET /freelancers/$FID/payments $FL >/dev/null
check "freelancer row has clientName" true "$(body '!!j.data[0].clientName&&j.data[0].payoutId!==undefined')"
check "client sees own payment details" 200 "$(call GET /payments/$PAY_SEED $CLIENT)"
check "details carry milestone/contract/names" true "$(body '!!j.data.milestone&&!!j.data.contract&&!!j.data.jobTitle&&!!j.data.freelancerName&&!!j.data.clientName')"
check "freelancer sees it too" 200 "$(call GET /payments/$PAY_SEED $FL)"
check "unrelated client -> 404" 404 "$(call GET /payments/$PAY_SEED $OTHER)"
check "unrelated freelancer -> 404" 404 "$(call GET /payments/$PAY_SEED $FL2)"
check "client cannot read another client's list" 403 "$(call GET /clients/$CID/payments $OTHER)"

echo "create-order guards"
check "milestoneId required" 400 "$(call POST /payments/create-order $CLIENT '{}')"
check "amount in body is not accepted (still validated by milestoneId only)" 400 "$(call POST /payments/create-order $CLIENT '{"amount":1}')"
check "freelancer cannot create an order" 403 "$(call POST /payments/create-order $FL '{"milestoneId":"000000000000000000000000"}')"

if [ -z "$KEY_SECRET" ] || [ -z "$HOOK_SECRET" ]; then
  echo "SKIP funding/webhook checks: set RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET in backend/.env"
else
  echo "funding (simulated Razorpay side): verify -> Held, replay-safe"
  call GET /clients/$CID/contracts $CLIENT >/dev/null
  CT=$(body 'j.data.find(c=>c.status==="Active").contractId')
  call GET /contracts/$CT $CLIENT >/dev/null
  MS=$(body 'j.data.milestones.find(m=>m.status==="Pending"&&!m.funded).milestoneId')
  MS_AMT=$(body 'j.data.milestones.find(m=>m.status==="Pending"&&!m.funded).amount')
  [ -n "$MS" ] || { echo "no unfunded Pending milestone on the seeded Active contract - re-seed with --reset"; exit 1; }
  check "unfunded milestone cannot be submitted yet" 400 "$(call PATCH /milestones/$MS/submit $FL)"
  ORDER="order_smoke$(date +%s)"; PAYID="pay_smoke$(date +%s)"
  (cd "$HERE" && node -e "require('dotenv').config();const m=require('mongoose');const P=require('./src/models/Payment');m.connect(process.env.MONGODB_URI).then(()=>P.create({milestoneId:'$MS',contractId:'$CT',clientId:'$CID',freelancerId:'$FID',amount:$MS_AMT,providerOrderId:'$ORDER',status:'Pending'})).then(()=>m.disconnect())")
  SIG=$(hmac "$KEY_SECRET" "$ORDER|$PAYID")
  V="{\"razorpay_order_id\":\"$ORDER\",\"razorpay_payment_id\":\"$PAYID\",\"razorpay_signature\":\"$SIG\"}"
  check "forged signature -> 400" 400 "$(call POST /payments/verify $CLIENT "{\"razorpay_order_id\":\"$ORDER\",\"razorpay_payment_id\":\"$PAYID\",\"razorpay_signature\":\"$(printf 'a%.0s' $(seq 64))\"}")"
  check "another client cannot verify my order" 404 "$(call POST /payments/verify $OTHER "$V")"
  check "verify -> 200" 200 "$(call POST /payments/verify $CLIENT "$V")"
  check "payment is Held with razorpayPaymentId" "Held:$PAYID" "$(body 'j.data.paymentStatus+":"+j.data.razorpayPaymentId')"
  PAY=$(body 'j.data.paymentId')
  check "REPLAY of verify -> 200, still one Held payment" 200 "$(call POST /payments/verify $CLIENT "$V")"
  check "replay did not create a second funded payment" 1 "$(call GET /clients/$CID/payments $CLIENT >/dev/null; body 'j.data.filter(p=>p.milestoneId==="'$MS'").length')"
  SIG2=$(hmac "$KEY_SECRET" "$ORDER|pay_other$(date +%s)")
  check "same order, different payment id -> 409" 409 "$(call POST /payments/verify $CLIENT "{\"razorpay_order_id\":\"$ORDER\",\"razorpay_payment_id\":\"pay_other$(date +%s)\",\"razorpay_signature\":\"$SIG2\"}")"
  call GET /contracts/$CT $CLIENT >/dev/null
  check "milestone.funded flipped by the payment (contract details join the Held payment)" "true:Held" "$(body 'var m=j.data.milestones.find(x=>x.milestoneId==="'$MS'");m.funded+":"+m.payment.paymentStatus')"
  check "client cannot delete a funded milestone" 400 "$(call DELETE /milestones/$MS $CLIENT)"

  echo "Held -> Awaiting Payout -> Paid"
  check "client cannot approve before submission" 400 "$(call POST /milestones/$MS/release-payment $CLIENT)"
  check "freelancer submits (now funded)" 200 "$(call PATCH /milestones/$MS/submit $FL)"
  check "release-payment (approve) -> 200" 200 "$(call POST /milestones/$MS/release-payment $CLIENT)"
  check "payment is Awaiting Payout with approvedAt" "Awaiting Payout:true" "$(body 'j.data.paymentStatus+":"+!!j.data.approvedAt')"
  check "approve twice -> 400" 400 "$(call POST /milestones/$MS/release-payment $CLIENT)"
  check "client cannot dispatch" 403 "$(call POST /payments/$PAY/payout $CLIENT '{}')"
  check "admin dispatch -> 200" 200 "$(call POST /payments/$PAY/payout $ADMIN '{}')"
  check "Paid with payoutTo + payoutId + adminVerified" "Paid:meera@upi:true:true" "$(body 'j.data.paymentStatus+":"+j.data.payoutTo+":"+!!j.data.payoutId+":"+j.data.adminVerified')"
  check "dispatch again -> 400 already dispatched" "This payment has already been dispatched." "$(call POST /payments/$PAY/payout $ADMIN '{}' >/dev/null; body 'j.message')"
  call GET /payments/$PAY $FL >/dev/null
  check "freelancer sees Paid + payoutId" true "$(body 'j.data.paymentStatus==="Paid"&&!!j.data.payoutId')"
  check "admin verify-admin (idempotent)" 200 "$(call POST /payments/$PAY/verify-admin $ADMIN)"
  check "non-admin cannot verify-admin" 403 "$(call POST /payments/$PAY/verify-admin $CLIENT)"

  echo "payout account guard"
  # Karan (FL2) has no paymentAccount in the seed: a payment awaiting payout for him must not be dispatchable.
  # Covered in unit tests (dispatchRules.account); exercising it live needs a second funded contract - see plan notes.

  echo "webhook (signature over the RAW body)"
  RAW='{"event":"payment.failed","payload":{"payment":{"entity":{"id":"pay_hook1","order_id":"order_unknown_smoke","error_description":"smoke"}}}}'
  WSIG=$(hmac "$HOOK_SECRET" "$RAW")
  wh() { curl -s -o /tmp/ff_body -w '%{http_code}' -X POST "$BASE/payments/webhook" -H 'Content-Type: application/json' -H "x-razorpay-signature: $1" -H "x-razorpay-event-id: $2" --data-binary "$RAW"; }
  check "bad webhook signature -> 400" 400 "$(wh $(printf 'b%.0s' $(seq 64)) evt_smoke_bad)"
  check "good signature -> 200" 200 "$(wh $WSIG evt_smoke_$(date +%s))"
  EV="evt_smoke_dup_$(date +%s)"
  check "first delivery -> 200" 200 "$(wh $WSIG $EV)"
  check "duplicate delivery -> 200 (idempotent)" 200 "$(wh $WSIG $EV)"
  check "re-serialised body fails the signature" 400 "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/payments/webhook" -H 'Content-Type: application/json' -H "x-razorpay-signature: $WSIG" -d '{ "event": "payment.failed" }')"
fi

echo
if [ "$fails" -eq 0 ]; then echo "ALL CHECKS PASSED"; else echo "$fails CHECK(S) FAILED"; exit 1; fi
