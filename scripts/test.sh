#!/bin/bash
# ============================================
# GameAlert - Exhaustive Test Suite
# Run after EVERY code change
#
# Layers:
#   1. Static (TypeScript)
#   2. Unit (Jest - pure functions)
#   3. Server boot
#   4. Integration (Jest - live API)
#   5. Smoke (pages + design system)
#   6. Data integrity (games are free, valid)
# ============================================

cd "/Users/angelneriaacal/Documents/Default Project/gamealert"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0
FAIL=0
SKIP=0

pass() { echo -e "  ${GREEN}✅ $1${NC}"; PASS=$((PASS + 1)); }
fail() { echo -e "  ${RED}❌ $1${NC}"; FAIL=$((FAIL + 1)); }
skip() { echo -e "  ${YELLOW}⏭️  $1${NC}"; SKIP=$((SKIP + 1)); }
info() { echo -e "  ${BLUE}ℹ️  $1${NC}"; }

echo ""
echo -e "${YELLOW}🧪 GameAlert Exhaustive Test Suite${NC}"
echo "========================================"
echo ""

# ============================================
# PHASE 1: Static Analysis
# ============================================
echo -e "${BLUE}📋 Phase 1: Static Analysis${NC}"
echo "----------------------------------------"

if npx tsc --noEmit 2>&1 | grep -q "error TS"; then
  fail "TypeScript has errors"
  npx tsc --noEmit 2>&1 | head -10
else
  pass "TypeScript compiles clean"
fi

# ============================================
# PHASE 2: Unit Tests (Jest)
# ============================================
echo ""
echo -e "${BLUE}🔬 Phase 2: Unit Tests${NC}"
echo "----------------------------------------"

UNIT_OUTPUT=$(npx jest tests/unit --silent 2>&1)
UNIT_EXIT=$?

if [ $UNIT_EXIT -eq 0 ]; then
  UNIT_COUNT=$(echo "$UNIT_OUTPUT" | grep -oE '[0-9]+ passed' | tail -1 | awk '{print $1}')
  pass "Unit tests: ${UNIT_COUNT:-?} passed"
else
  fail "Unit tests failed"
  echo "$UNIT_OUTPUT" | tail -20
fi

# ============================================
# PHASE 3: Server Boot
# ============================================
echo ""
echo -e "${BLUE}🖥️  Phase 3: Server Boot${NC}"
echo "----------------------------------------"

kill $(lsof -t -i:3000) 2>/dev/null
sleep 1
rm -rf .next
node node_modules/.bin/next dev > /tmp/gamealert-test.log 2>&1 &
SERVER_PID=$!

HTTP_CODE="000"
for i in 1 2 3 4 5 6; do
  sleep 5
  HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 'http://127.0.0.1:3000/' 2>/dev/null)
  if [ "$HTTP_CODE" = "200" ]; then break; fi
  info "Waiting for server... (attempt $i)"
done

if [ "$HTTP_CODE" = "200" ]; then
  pass "Server responds on port 3000 (HTTP $HTTP_CODE)"
else
  fail "Server not responding (HTTP $HTTP_CODE)"
  echo "  Last log lines:"
  tail -5 /tmp/gamealert-test.log | sed 's/^/    /'
fi

# Warm-up: compilar las rutas en vivo FUERA de Jest — la primera petición
# incluye el compile de Next dev + scraping real y reventaría el timeout.
if [ "$HTTP_CODE" = "200" ]; then
  curl -s -o /dev/null --max-time 60 'http://127.0.0.1:3000/api/games' 2>/dev/null
  curl -s -o /dev/null --max-time 60 'http://127.0.0.1:3000/api/deals' 2>/dev/null
fi

# ============================================
# PHASE 4: Integration Tests (Jest)
# ============================================
echo ""
echo -e "${BLUE}🔌 Phase 4: Integration Tests${NC}"
echo "----------------------------------------"

if [ "$HTTP_CODE" = "200" ]; then
  INTEG_OUTPUT=$(GAMEALERT_BASE_URL=http://127.0.0.1:3000 npx jest tests/integration --silent 2>&1)
  INTEG_EXIT=$?
  if [ $INTEG_EXIT -eq 0 ]; then
    INTEG_COUNT=$(echo "$INTEG_OUTPUT" | grep -oE '[0-9]+ passed' | tail -1 | awk '{print $1}')
    pass "Integration tests: ${INTEG_COUNT:-?} passed"
  else
    fail "Integration tests failed"
    echo "$INTEG_OUTPUT" | tail -20
  fi
else
  skip "Integration tests (server not running)"
fi

# ============================================
# PHASE 5: Smoke Tests (Pages + Design)
# ============================================
echo ""
echo -e "${BLUE}📄 Phase 5: Smoke Tests (Pages + Design)${NC}"
echo "----------------------------------------"

if [ "$HTTP_CODE" != "200" ]; then
  skip "Smoke tests (server not running)"
else
  # Public pages
  for page in "/" "/register" "/login"; do
    CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "http://127.0.0.1:3000${page}" 2>/dev/null)
    if [ "$CODE" = "200" ]; then
      pass "GET $page → 200"
    else
      fail "GET $page → HTTP $CODE"
    fi
  done

  # Protected pages without session must redirect to /login
  for page in "/dashboard" "/dashboard/games" "/dashboard/settings"; do
    CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "http://127.0.0.1:3000${page}" 2>/dev/null)
    if [ "$CODE" = "307" ] || [ "$CODE" = "302" ]; then
      pass "GET $page sin sesión → redirect a login"
    else
      fail "GET $page sin sesión → HTTP $CODE (esperaba redirect)"
    fi
  done

  # Create a smoke session for the protected pages
  SMOKE_EMAIL="smoke-$(date +%s)-$RANDOM@test.dev"
  SMOKE_JAR=$(mktemp)
  curl -s -c "$SMOKE_JAR" -X POST 'http://127.0.0.1:3000/api/auth' \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$SMOKE_EMAIL\",\"password\":\"SmokeTest123!\",\"platforms\":[\"steam\"]}" \
    --max-time 15 >/dev/null
  AUTH_COOKIE=$(awk '/ga_session/{print $6"="$7}' "$SMOKE_JAR" | tail -1)
  rm -f "$SMOKE_JAR"

  if [ -n "$AUTH_COOKIE" ]; then
    pass "Smoke session created (registro con contraseña)"
  else
    fail "Smoke session creation failed"
  fi

  # Protected pages with session → 200
  for page in "/dashboard" "/dashboard/games" "/dashboard/settings"; do
    CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -H "Cookie: $AUTH_COOKIE" "http://127.0.0.1:3000${page}" 2>/dev/null)
    if [ "$CODE" = "200" ]; then
      pass "GET $page con sesión → 200"
    else
      fail "GET $page con sesión → HTTP $CODE"
    fi
  done

  # Spanish language
  HOME_HTML=$(curl -s --max-time 10 'http://127.0.0.1:3000/' 2>/dev/null)
  if echo "$HOME_HTML" | grep -q 'lang="es"'; then
    pass "Home page lang=\"es\""
  else
    fail "Home page missing lang=\"es\""
  fi

  # Design system classes
  if echo "$HOME_HTML" | grep -q "panel"; then
    pass "Design system: panel present"
  else
    fail "Design system: panel missing"
  fi

  if echo "$HOME_HTML" | grep -q "text-outline"; then
    pass "Design system: text-outline present"
  else
    fail "Design system: text-outline missing"
  fi

  # Epic countdown
  if echo "$HOME_HTML" | grep -q "Próximo drop de Epic"; then
    pass "Epic countdown present"
  else
    fail "Epic countdown missing"
  fi

  # No emojis in UI (pictographs/emoticons only; typographic ornaments like ✦ allowed)
  HAS_EMOJI=$(echo "$HOME_HTML" | python3 -c "import sys,re; print('1' if re.search(r'[\U0001F000-\U0001FAFF]', sys.stdin.read()) else '0')" 2>/dev/null || echo "0")
  if [ "$HAS_EMOJI" = "1" ]; then
    fail "Emojis found in UI (should be removed)"
  else
    pass "No emojis in UI"
  fi

  # Spanish content
  if echo "$HOME_HTML" | grep -q "Juegos"; then
    pass "Content: Spanish text present"
  else
    fail "Content: Spanish text missing"
  fi

  # Home CTAs are session-aware (guest version rendered for SEO)
  if echo "$HOME_HTML" | grep -q 'data-home-auth="nav"'; then
    pass "Home: session-aware nav present"
  else
    fail "Home: session-aware nav missing"
  fi

  if echo "$HOME_HTML" | grep -q 'data-home-auth="hero"'; then
    pass "Home: session-aware hero CTA present"
  else
    fail "Home: session-aware hero CTA missing"
  fi

  # SEO: FAQ with matching JSON-LD, OG card, deals keywords in metadata
  if echo "$HOME_HTML" | grep -q "Dudas razonables"; then
    pass "SEO: FAQ section present"
  else
    fail "SEO: FAQ section missing"
  fi

  if echo "$HOME_HTML" | grep -q "FAQPage"; then
    pass "SEO: FAQPage JSON-LD present"
  else
    fail "SEO: FAQPage JSON-LD missing"
  fi

  if echo "$HOME_HTML" | grep -q "opengraph-image"; then
    pass "SEO: OG image present"
  else
    fail "SEO: OG image missing"
  fi

  if echo "$HOME_HTML" | grep -qi "rebajados"; then
    pass "SEO: deals keywords present"
  else
    fail "SEO: deals keywords missing"
  fi

  # Games page has Metacritic slider (con sesión)
  GAMES_HTML=$(curl -s --max-time 10 -H "Cookie: $AUTH_COOKIE" 'http://127.0.0.1:3000/dashboard/games' 2>/dev/null)
  if echo "$GAMES_HTML" | grep -q "Metacritic"; then
    pass "Games page: Metacritic filter present"
  else
    fail "Games page: Metacritic filter missing"
  fi

  # Games page has the Chollos tab (deals with price cap)
  if echo "$GAMES_HTML" | grep -q "Chollos"; then
    pass "Games page: Chollos tab present"
  else
    fail "Games page: Chollos tab missing"
  fi

  # Games page has search + sort controls
  if echo "$GAMES_HTML" | grep -q "Buscar por nombre"; then
    pass "Games page: search box present"
  else
    fail "Games page: search box missing"
  fi

  if echo "$GAMES_HTML" | grep -q "Relevancia"; then
    pass "Games page: sort selector present"
  else
    fail "Games page: sort selector missing"
  fi

  # Settings page has toggles (con sesión)
  SETTINGS_HTML=$(curl -s --max-time 10 -H "Cookie: $AUTH_COOKIE" 'http://127.0.0.1:3000/dashboard/settings' 2>/dev/null)
  if echo "$SETTINGS_HTML" | grep -q "toggle"; then
    pass "Settings page: toggle switches present"
  else
    fail "Settings page: toggle switches missing"
  fi

  # Settings page explains the chollos controls
  if echo "$SETTINGS_HTML" | grep -q "Precio máximo a pagar"; then
    pass "Settings page: chollos section present"
  else
    fail "Settings page: chollos section missing"
  fi

  # Settings copy stays concise (no long explanatory paragraphs)
  if echo "$SETTINGS_HTML" | grep -q "Además de los juegos gratis"; then
    fail "Settings page: verbose copy returned"
  else
    pass "Settings page: copy stays concise"
  fi
fi

# ============================================
# PHASE 6: Data Integrity
# ============================================
echo ""
echo -e "${BLUE}🔍 Phase 6: Data Integrity${NC}"
echo "----------------------------------------"

if [ "$HTTP_CODE" != "200" ]; then
  skip "Data integrity (server not running)"
else
  API_JSON=$(curl -s --max-time 60 'http://127.0.0.1:3000/api/games' 2>/dev/null)

  # Valid JSON with games array
  if echo "$API_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); assert isinstance(d.get('games'), list)" 2>/dev/null; then
    pass "API returns valid JSON with games array"
  else
    fail "API JSON invalid or missing games array"
  fi

  # All games are free
  NOT_FREE=$(echo "$API_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len([g for g in d.get('games',[]) if not g.get('isFree')]))" 2>/dev/null || echo "0")
  if [ "$NOT_FREE" = "0" ]; then
    pass "All games are free (isFree=true)"
  else
    fail "$NOT_FREE games are not free"
  fi

  # All games have valid store URLs
  BAD_URLS=$(echo "$API_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len([g for g in d.get('games',[]) if not g.get('storeUrl','').startswith('http')]))" 2>/dev/null || echo "0")
  if [ "$BAD_URLS" = "0" ]; then
    pass "All games have valid store URLs"
  else
    fail "$BAD_URLS games have invalid store URLs"
  fi

  # Only PC platforms
  BAD_PLATFORMS=$(echo "$API_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len([g for g in d.get('games',[]) if g.get('platform') not in ('steam','epic','gog')]))" 2>/dev/null || echo "0")
  if [ "$BAD_PLATFORMS" = "0" ]; then
    pass "Only PC platforms (steam/epic/gog)"
  else
    fail "$BAD_PLATFORMS games on non-PC platforms"
  fi

  # Metacritic scores in valid range
  BAD_SCORES=$(echo "$API_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len([g for g in d.get('games',[]) if g.get('metacriticScore') is not None and (g['metacriticScore'] < 0 or g['metacriticScore'] > 100)]))" 2>/dev/null || echo "0")
  if [ "$BAD_SCORES" = "0" ]; then
    pass "Metacritic scores in range 0-100"
  else
    fail "$BAD_SCORES games have out-of-range Metacritic"
  fi

  # Quality filter works
  FILTERED=$(curl -s --max-time 60 'http://127.0.0.1:3000/api/games?minMetacritic=90' 2>/dev/null)
  FILTER_BAD=$(echo "$FILTERED" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len([g for g in d.get('games',[]) if max(g.get('importanceScore',0), g.get('metacriticScore') or 0) < 90]))" 2>/dev/null || echo "0")
  if [ "$FILTER_BAD" = "0" ]; then
    pass "Quality filter (minMetacritic=90) works"
  else
    fail "$FILTER_BAD games below threshold passed filter"
  fi

  # totalScraped field present
  if echo "$API_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'totalScraped' in d" 2>/dev/null; then
    pass "API returns totalScraped field"
  else
    fail "API missing totalScraped field"
  fi

  # Chollos endpoint: valid JSON with deals array
  DEALS_JSON=$(curl -s --max-time 60 'http://127.0.0.1:3000/api/deals' 2>/dev/null)
  if echo "$DEALS_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); assert isinstance(d.get('deals'), list)" 2>/dev/null; then
    pass "Deals API returns valid JSON with deals array"
  else
    fail "Deals API JSON invalid or missing deals array"
  fi

  # Every deal: non-free, priced within the default cap, deep enough discount
  BAD_DEALS=$(echo "$DEALS_JSON" | python3 -c "
import sys,json
d=json.load(sys.stdin)
cap=d.get('maxPrice',10); mind=d.get('minDiscount',75)
bad=[g for g in d.get('deals',[]) if g.get('isFree') or not (0 < g.get('salePrice',0) <= cap) or g.get('discountPct',-1) < mind or g.get('platform') not in ('steam','epic','gog') or g.get('storeUrl','')[:8] != 'https://' or g.get('metacriticScore') is not None and not (0 <= g['metacriticScore'] <= 100)]
print(len(bad))" 2>/dev/null || echo "PARSE_ERROR")
  if [ "$BAD_DEALS" = "0" ]; then
    pass "All deals are non-free, within price cap and deep enough discount"
  else
    fail "Deals failing integrity checks: $BAD_DEALS"
  fi

  # Deals quality filter works
  DEALS_FILTERED=$(curl -s --max-time 60 'http://127.0.0.1:3000/api/deals?minDiscount=90' 2>/dev/null)
  DEALS_FILTER_BAD=$(echo "$DEALS_FILTERED" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len([g for g in d.get('deals',[]) if g.get('discountPct',0) < 90]))" 2>/dev/null || echo "0")
  if [ "$DEALS_FILTER_BAD" = "0" ]; then
    pass "Deals discount filter (minDiscount=90) works"
  else
    fail "$DEALS_FILTER_BAD deals below discount threshold passed filter"
  fi

  # Deals endpoint rejects invalid params
  BAD_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 'http://127.0.0.1:3000/api/deals?maxPrice=999' 2>/dev/null)
  if [ "$BAD_CODE" = "400" ]; then
    pass "Deals API rejects out-of-range maxPrice (400)"
  else
    fail "Deals API accepted maxPrice=999 (HTTP $BAD_CODE)"
  fi
fi

# ============================================
# Summary
# ============================================
echo ""
echo "========================================"
TOTAL=$((PASS + FAIL))
echo -e "Results: ${GREEN}$PASS passed${NC} / ${RED}$FAIL failed${NC} / ${YELLOW}$SKIP skipped${NC} / $TOTAL total"

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}🎉 All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}⚠️  Some tests failed${NC}"
  exit 1
fi
