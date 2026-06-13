#!/usr/bin/env bash
# Smoke test DJOSSI API — flux complet contre un serveur lancé (pnpm start:dev)
# sur une base seedée (pnpm prisma db seed). Nécessite curl + jq.
#
#   ./scripts/smoke.sh [base_url]
#
# ⚠️  Mutations réelles : à lancer sur la base de dev uniquement.
set -euo pipefail

B="${1:-http://localhost:3000/v1}"
PASS=0

step() { PASS=$((PASS + 1)); printf '%2d. %s\n' "$PASS" "$1"; }
fail() { echo "❌ ÉCHEC : $1" >&2; exit 1; }

step "Health"
curl -sf "$B/health" | jq -e '.status == "ok" and .database == "up"' >/dev/null || fail "health"

step "OTP send (compte test 0707070707)"
curl -sf -X POST "$B/auth/otp/send" -H 'Content-Type: application/json' \
  -d '{"phone":"0707070707"}' | jq -e '.expires_in == 300' >/dev/null || fail "otp send"

step "OTP verify (code dev 123456) → session"
LOGIN=$(curl -sf -X POST "$B/auth/otp/verify" -H 'Content-Type: application/json' \
  -d '{"phone":"0707070707","code":"123456"}')
echo "$LOGIN" | jq -e '.user.full_name == "Kouame Aya"' >/dev/null || fail "verify user"
AT=$(echo "$LOGIN" | jq -r '.access_token')
RT=$(echo "$LOGIN" | jq -r '.refresh_token')
AUTH="Authorization: Bearer $AT"

step "GET /users/me"
curl -sf "$B/users/me" -H "$AUTH" | jq -e '.phone == "0707070707"' >/dev/null || fail "me"

step "12 catégories"
curl -sf "$B/services/categories" | jq -e 'length == 12' >/dev/null || fail "categories"

step "Recherche « soud » → p1 (4.8★, ~200 m, snake_case)"
curl -sf "$B/search/providers?query=soud" -H "$AUTH" \
  | jq -e '.items[0] | .id == "p1" and .full_name == "Kouame Yao" and .rating == 4.8 and (.distance_meters < 250)' \
  >/dev/null || fail "search"

step "Fiche p1 : 5 avis, 89 missions, portfolio/services"
curl -sf "$B/providers/p1" -H "$AUTH" \
  | jq -e '.reviews_count == 5 and .missions_done == 89 and (.services | length > 0)' \
  >/dev/null || fail "provider detail"

step "Création réservation p1"
BOOKING=$(curl -sf -X POST "$B/bookings" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"provider_id":"p1","scheduled_at":"2027-06-01T09:00:00.000Z","notes":"Smoke test","amount_fcfa":6000}')
echo "$BOOKING" | jq -e '.status == "pending"' >/dev/null || fail "booking create"
BID=$(echo "$BOOKING" | jq -r '.id')

step "Connexion prestataire p1 (0701000001)"
PAT=$(curl -sf -X POST "$B/auth/otp/verify" -H 'Content-Type: application/json' \
  -d '{"phone":"0701000001","code":"123456"}' | jq -r '.access_token')
PAUTH="Authorization: Bearer $PAT"

step "Cycle : confirmed → in_progress → completed"
for S in confirmed in_progress completed; do
  curl -sf -X PATCH "$B/bookings/$BID/status" -H "$PAUTH" -H 'Content-Type: application/json' \
    -d "{\"status\":\"$S\"}" | jq -e ".status == \"$S\"" >/dev/null || fail "transition $S"
done
curl -sf "$B/providers/p1" -H "$AUTH" | jq -e '.missions_done == 90' >/dev/null || fail "missions_done"

step "Transition illégale → 409"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH "$B/bookings/$BID/status" \
  -H "$PAUTH" -H 'Content-Type: application/json' -d '{"status":"confirmed"}')
[ "$CODE" = "409" ] || fail "expected 409, got $CODE"

step "Avis 5★ → moyenne recalculée 4.8 (6 avis)"
curl -sf -X POST "$B/reviews" -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"booking_id\":\"$BID\",\"rating\":5,\"tags\":[\"Ponctuel\",\"Pro\"],\"comment\":\"Smoke test\"}" >/dev/null || fail "review"
curl -sf "$B/providers/p1/reviews" -H "$AUTH" \
  | jq -e '.average_rating == 4.8 and .total == 6' >/dev/null || fail "rating recalc"

step "Paiement wave → pending puis completed (webhook mock ~3 s)"
PAYMENT=$(curl -sf -X POST "$B/payments/init" -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"booking_id\":\"$BID\",\"method\":\"wave\",\"phone_number\":\"0707070707\"}")
PREF=$(echo "$PAYMENT" | jq -r '.reference')
sleep 4
curl -sf "$B/payments" -H "$AUTH" \
  | jq -e --arg ref "$PREF" '.items[] | select(.reference == $ref) | .status == "completed"' \
  >/dev/null || fail "payment completed"

step "Webhook : mauvais secret → 401"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$B/payments/callback" \
  -H 'Content-Type: application/json' -H 'x-webhook-secret: wrong' \
  -d "{\"reference\":\"$PREF\",\"status\":\"completed\"}")
[ "$CODE" = "401" ] || fail "expected 401, got $CODE"

step "Messagerie : conversation seed + envoi"
curl -sf -X POST "$B/messages/conversations" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"provider_id":"p1"}' | jq -e '.id == "conv-demo-1"' >/dev/null || fail "conversation upsert"
curl -sf -X POST "$B/messages/conversations/conv-demo-1/messages" -H "$AUTH" \
  -H 'Content-Type: application/json' -d '{"text":"Message du smoke test"}' >/dev/null || fail "send message"
curl -sf "$B/messages/conversations" -H "$PAUTH" \
  | jq -e '.[] | select(.id == "conv-demo-1") | .last_message == "Message du smoke test"' \
  >/dev/null || fail "conversation provider side"

step "Notifications prestataire (booking + review + payment + message)"
curl -sf "$B/notifications" -H "$PAUTH" \
  | jq -e '([.items[].type] | unique) as $t | (["booking","message","payment","review"] - $t) == []' \
  >/dev/null || fail "notification fan-out"

step "Refresh rotation + réutilisation → 401"
NEW=$(curl -sf -X POST "$B/auth/refresh" -H 'Content-Type: application/json' \
  -d "{\"refresh_token\":\"$RT\"}")
echo "$NEW" | jq -e '.access_token' >/dev/null || fail "refresh"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$B/auth/refresh" \
  -H 'Content-Type: application/json' -d "{\"refresh_token\":\"$RT\"}")
[ "$CODE" = "401" ] || fail "expected 401 on reuse, got $CODE"

echo
echo "✅ Smoke test OK ($PASS étapes) — $B"