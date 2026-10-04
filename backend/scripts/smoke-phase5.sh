#!/usr/bin/env bash
# Phase 5 acceptance smoke test (reviews, dashboards, messaging, notifications) against a RUNNING backend with a
# FRESHLY SEEDED database.
#   cd backend && npm run seed -- --reset && npm run dev     (terminal 1)
#   bash scripts/smoke-phase5.sh                             (terminal 2, from backend/)
# Requires: curl, node. Set BASE=http://host:port/api to override. Re-running needs a re-seed (reviews are one-per-party).
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
AID=$(uid $AISHA); RID=$(uid $ROHAN); MID=$(uid $MEERA); KID=$(uid $KARAN); ADID=$(uid $ADMIN)

echo "reviews (Completed contract only, one per party)"
call GET /clients/$RID/contracts $ROHAN >/dev/null
DONE=$(body 'j.data.find(c=>c.status==="Completed")?.contractId')
call GET /clients/$AID/contracts $AISHA >/dev/null
ACTIVE=$(body 'j.data.find(c=>c.status==="Active")?.contractId')
check "seed has a Completed and an Active contract" true "$([ -n "$DONE" ] && [ -n "$ACTIVE" ] && echo true || echo false)"
check "review on an Active contract is refused" 409 "$(call POST /contracts/$ACTIVE/reviews $AISHA '{"rating":5,"comment":"early"}')"
check "rating must be 1-5" 400 "$(call POST /contracts/$DONE/reviews $ROHAN '{"rating":9}')"
check "stranger gets 404" 404 "$(call POST /contracts/$DONE/reviews $AISHA '{"rating":5}')"
check "client reviews the freelancer" 201 "$(call POST /contracts/$DONE/reviews $ROHAN "{\"rating\":5,\"comment\":\"Great\",\"revieweeId\":\"$RID\"}")"
check "reviewee derived from the contract (forged body id ignored)" "$KID" "$(body 'j.data.revieweeId')"
check "second review by the same party" 409 "$(call POST /contracts/$DONE/reviews $ROHAN '{"rating":4}')"
check "freelancer reviews the client" 201 "$(call POST /contracts/$DONE/reviews $KARAN '{"rating":4,"comment":"Clear briefs"}')"
call GET /users/$KID/reviews $ROHAN >/dev/null
check "reviews list has a summary count >= 1" true "$(body '(j.data.summary?.count ?? 0) >= 1')"

echo "dashboards (owner/admin only, mock field names)"
check "client dashboard" 200 "$(call GET /clients/$AID/dashboard $AISHA)"
check "client dashboard keys" true "$(body '["openJobs","draftJobs","activeContracts","pendingBids","recentJobs"].every(k=>k in j.data)')"
check "other client cannot read it" 403 "$(call GET /clients/$AID/dashboard $ROHAN)"
check "freelancer dashboard" 200 "$(call GET /freelancers/$MID/dashboard $MEERA)"
check "freelancer dashboard keys" true "$(body '["pendingBids","activeContracts","totalEarned","rating","recentBids"].every(k=>k in j.data)')"
check "other freelancer cannot read it" 403 "$(call GET /freelancers/$MID/dashboard $KARAN)"

echo "messaging (shared contract required, mailboxes private)"
check "send to a contract partner" 201 "$(call POST /messages $AISHA "{\"receiverId\":\"$MID\",\"messageText\":\"Hi Meera, smoke test\",\"senderId\":\"$KID\"}")"
check "DTO keys, sender from the token (forged senderId ignored)" "$AID:$MID" "$(body 'j.data.senderId+":"+j.data.receiverId')"
check "message to someone with no shared contract" 403 "$(call POST /messages $AISHA "{\"receiverId\":\"$KID\",\"messageText\":\"hello\"}")"
check "cannot message yourself" 400 "$(call POST /messages $AISHA "{\"receiverId\":\"$AID\",\"messageText\":\"me\"}")"
check "empty text" 400 "$(call POST /messages $AISHA "{\"receiverId\":\"$MID\",\"messageText\":\"  \"}")"
check "inbox conversation list" 200 "$(call GET "/messages/$MID?view=conversations" $MEERA)"
check "shows Aisha with 1+ unread" true "$(body 'j.data.items.some(c=>c.userId==="'$AID'"&&c.unreadCount>=1&&c.lastMessage.sentAt)')"
check "another user cannot read Meera's mailbox" 403 "$(call GET "/messages/$MID?view=conversations" $ADMIN)"
check "open the conversation" 200 "$(call GET /messages/conversation/$AID $MEERA)"
check "thread items use messageId/messageText/sentAt" true "$(body 'j.data.items.length>=1&&j.data.items.every(m=>m.messageId&&m.messageText&&m.sentAt)')"
call GET "/messages/$MID?view=conversations" $MEERA >/dev/null
check "opening the thread marked it read" 0 "$(body 'j.data.items.find(c=>c.userId==="'$AID'")?.unreadCount')"
check "stranger's conversation view is empty (participant filter)" 0 "$(call GET /messages/conversation/$AID $KARAN >/dev/null; body 'j.data.items.length')"

echo "notifications (role-specific links, owner-only)"
call GET /notifications/$MID $MEERA >/dev/null
check "Meera has an unread 'message' notification linking to /freelancer/messages" true "$(body 'j.data.items.some(n=>n.type==="message"&&n.read===false&&n.link==="/freelancer/messages")')"
check "DTO keys" true "$(body 'j.data.items.every(n=>n.notificationId&&n.userId&&"link" in n&&typeof n.read==="boolean"&&n.createdAt)')"
check "unreadCount present" true "$(body 'typeof j.data.unreadCount==="number"&&j.data.unreadCount>=1')"
NID=$(body 'j.data.items.find(n=>n.read===false).notificationId')
check "another user cannot read Meera's notifications" 403 "$(call GET /notifications/$MID $AISHA)"
check "admin cannot read them either" 403 "$(call GET /notifications/$MID $ADMIN)"
check "someone else cannot mark it read (looks missing)" 404 "$(call PATCH /notifications/$NID/read $AISHA)"
check "owner marks it read" 200 "$(call PATCH /notifications/$NID/read $MEERA)"
check "  ...DTO says read" true "$(body 'j.data.read===true')"
check "read-all is not shadowed by /:notificationId/read" 200 "$(call PATCH /notifications/read-all $MEERA)"
call GET "/notifications/$MID?unreadOnly=true" $MEERA >/dev/null
check "no unread left" 0 "$(body 'j.data.unreadCount')"
call GET /notifications/$KID $KARAN >/dev/null
check "review notification links to the freelancer's contract page or profile route" true "$(body 'j.data.items.some(n=>n.type==="review"&&/^\/freelancer\/contracts\//.test(n.link||""))')"

echo
[ "$fails" -eq 0 ] && echo "PHASE 5 SMOKE: ALL PASSED" || { echo "PHASE 5 SMOKE: $fails FAILED"; exit 1; }
