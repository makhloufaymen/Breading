#!/usr/bin/env bash
# pet-photos bucket and pet_photos table, through the real API (Storage + PostgREST):
# folder ownership, JPEG only, 6 photos max, reorder, cross-user reads/writes/deletes.
# Needs the full local stack (supabase start). Run: supabase/tests/run.sh
set -uo pipefail

U=${SUPABASE_API_URL:-http://127.0.0.1:54321}
if [ -z "${PUBLISHABLE_KEY:-}" ] || [ -z "${SECRET_KEY:-}" ]; then
  eval "$(supabase status -o env | grep -E '^(PUBLISHABLE_KEY|SECRET_KEY)=')"
fi
K=$PUBLISHABLE_KEY
SR=$SECRET_KEY
WORK=$(mktemp -d)
cd "$WORK"

pass=0; fail=0
check() { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "ok   $1"; else fail=$((fail+1)); echo "FAIL $1 (got $2, want $3)"; fi; }
uuid() { cat /proc/sys/kernel/random/uuid 2>/dev/null || powershell -NoProfile -Command "[guid]::NewGuid().ToString()" | tr -d '\r'; }
json_field() { sed -E "s/.*\"$1\":\"([^\"]+)\".*/\\1/"; }

# Email confirmation is on: create confirmed users through the admin API, then sign in.
user() {
  curl -s -o /dev/null "$U/auth/v1/admin/users" -H "apikey: $SR" -H "Authorization: Bearer $SR" \
    -H "Content-Type: application/json" -d "{\"email\":\"$1\",\"password\":\"password123\",\"email_confirm\":true}"
  curl -s "$U/auth/v1/token?grant_type=password" -H "apikey: $K" -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"password123\"}"
}
A=$(user "photo-a-$(uuid)@test.fr"); TA=$(echo "$A" | json_field access_token); UA=$(echo "$A" | sed -E 's/.*"user":\{"id":"([^"]+)".*/\1/')
B=$(user "photo-b-$(uuid)@test.fr"); TB=$(echo "$B" | json_field access_token); UB=$(echo "$B" | sed -E 's/.*"user":\{"id":"([^"]+)".*/\1/')

printf '%s' '{"species_id":1,"name":"Rex","sex":"male","breed_other":"Croise","birth_date":"2022-01-01","postal_code":"75001","city":"Paris","location":"SRID=4326;POINT(2.34 48.86)"}' > pet.json
PET=$(curl -s "$U/rest/v1/pets?select=id" -H "apikey: $K" -H "Authorization: Bearer $TA" -H "Content-Type: application/json" \
  -H "Prefer: return=representation" --data-binary @pet.json | json_field id)
printf '\xff\xd8\xff\xe0fakejpeg' > photo.jpg

upload() { # token path content-type
  echo "$2" >> uploaded.txt
  curl -s -o /dev/null -w "%{http_code}" -X POST "$U/storage/v1/object/pet-photos/$2" -H "apikey: $K" -H "Authorization: Bearer $1" \
    -H "Content-Type: $3" --data-binary @photo.jpg
}
row() { # token path position
  curl -s -o /dev/null -w "%{http_code}" "$U/rest/v1/pet_photos" -H "apikey: $K" -H "Authorization: Bearer $1" \
    -H "Content-Type: application/json" -d "{\"pet_id\":\"$PET\",\"path\":\"$2\",\"position\":$3}"
}

P1="$UA/$PET/$(uuid).jpg"
check "alice uploads to her pet folder" "$(upload "$TA" "$P1" image/jpeg)" 200
check "alice inserts the photo row" "$(row "$TA" "$P1" 0)" 201
check "png content type refused" "$(upload "$TA" "$UA/$PET/$(uuid).jpg" image/png)" 400
check "public URL readable without auth" "$(curl -s -o /dev/null -w '%{http_code}' "$U/storage/v1/object/public/pet-photos/$P1")" 200

check "bob cannot upload into alice folder" "$(upload "$TB" "$UA/$PET/$(uuid).jpg" image/jpeg)" 400
check "bob cannot upload for alice pet in his folder" "$(upload "$TB" "$UB/$PET/$(uuid).jpg" image/jpeg)" 400
check "bob cannot insert a row for alice pet (valid path)" "$(row "$TB" "$UA/$PET/$(uuid).jpg" 1)" 403
check "alice row path must match pet folder" "$(row "$TA" "$UB/$PET/$(uuid).jpg" 1)" 400
check "bob reads alice photo row" "$(curl -s "$U/rest/v1/pet_photos?select=path&pet_id=eq.$PET" -H "apikey: $K" -H "Authorization: Bearer $TB" | grep -c "$P1")" 1
curl -s -o /dev/null -X DELETE "$U/storage/v1/object/pet-photos/$P1" -H "apikey: $K" -H "Authorization: Bearer $TB"
check "bob's delete leaves alice file" "$(curl -s -o /dev/null -w '%{http_code}' "$U/storage/v1/object/public/pet-photos/$P1")" 200
check "bob cannot delete alice row" "$(curl -s "$U/rest/v1/pet_photos?pet_id=eq.$PET" -X DELETE -H "apikey: $K" -H "Authorization: Bearer $TB" -H "Prefer: return=representation")" "[]"

# Limit: 6 photos per pet (1 already).
for i in 1 2 3 4 5; do P="$UA/$PET/$(uuid).jpg"; upload "$TA" "$P" image/jpeg > /dev/null; row "$TA" "$P" "$i" > /dev/null; done
P7="$UA/$PET/$(uuid).jpg"; upload "$TA" "$P7" image/jpeg > /dev/null
check "7th photo row refused" "$(row "$TA" "$P7" 5)" 400

IDS=$(curl -s "$U/rest/v1/pet_photos?select=id&pet_id=eq.$PET&order=position" -H "apikey: $K" -H "Authorization: Bearer $TA" \
  | grep -oE '"id":"[^"]+"' | sed -E 's/"id":"([^"]+)"/"\1"/' | tac | paste -sd, -)
check "alice reorders (reversed)" "$(curl -s -o /dev/null -w '%{http_code}' "$U/rest/v1/rpc/reorder_pet_photos" -H "apikey: $K" -H "Authorization: Bearer $TA" -H "Content-Type: application/json" -d "{\"p_pet_id\":\"$PET\",\"p_photo_ids\":[$IDS]}")" 204
check "bob cannot reorder" "$(curl -s -o /dev/null -w '%{http_code}' "$U/rest/v1/rpc/reorder_pet_photos" -H "apikey: $K" -H "Authorization: Bearer $TB" -H "Content-Type: application/json" -d "{\"p_pet_id\":\"$PET\",\"p_photo_ids\":[$IDS]}")" 403
check "first photo is now P1 last" "$(curl -s "$U/rest/v1/pet_photos?select=path&pet_id=eq.$PET&order=position.desc&limit=1" -H "apikey: $K" -H "Authorization: Bearer $TA" | grep -c "$P1")" 1

check "alice lists her pet folder (7 files)" "$(curl -s "$U/storage/v1/object/list/pet-photos" -H "apikey: $K" -H "Authorization: Bearer $TA" -H "Content-Type: application/json" -d "{\"prefix\":\"$UA/$PET\"}" | grep -o '"name"' | wc -l | tr -d ' ')" 7
check "alice deletes her file" "$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$U/storage/v1/object/pet-photos/$P7" -H "apikey: $K" -H "Authorization: Bearer $TA")" 200

# Clean up: the uploaded files (Storage is not cleaned by SQL cascades), then the two users.
PREFIXES=$(sed 's/.*/"&"/' uploaded.txt | paste -sd, -)
curl -s -o /dev/null -X DELETE "$U/storage/v1/object/pet-photos" -H "apikey: $SR" -H "Authorization: Bearer $SR" \
  -H "Content-Type: application/json" -d "{\"prefixes\":[$PREFIXES]}"
for id in "$UA" "$UB"; do
  curl -s -o /dev/null -X DELETE "$U/auth/v1/admin/users/$id" -H "apikey: $SR" -H "Authorization: Bearer $SR"
done
cd / && rm -rf "$WORK"

echo "storage: passed=$pass failed=$fail"
[ "$fail" -eq 0 ]
