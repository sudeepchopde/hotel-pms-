#!/usr/bin/env bash
# Quick checks for Pi-hole + NPM + host app. Run from infra/ or any path.
set -euo pipefail

RED='\033[0;31m'
GRN='\033[0;32m'
NC='\033[0m'

ok() { echo -e "${GRN}OK${NC} $*"; }
fail() { echo -e "${RED}FAIL${NC} $*"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== Docker containers (infra) ==="
if docker compose ps 2>/dev/null | grep -q .; then
  docker compose ps
else
  fail "docker compose ps failed — are you in infra/ and is Docker running?"
  exit 1
fi

echo ""
echo "=== Published ports ==="
for c in pihole nginx-proxy-manager; do
  if docker ps -q -f name="^${c}$" | grep -q .; then
    echo "--- $c ---"
    docker port "$c" 2>/dev/null || true
  else
    fail "container $c not running"
  fi
done

echo ""
echo "=== Host listeners (53, 80, 443, 8080, 8000) ==="
if command -v ss >/dev/null 2>&1; then
  ss -ltnp 2>/dev/null | grep -E ':53 |:80 |:443 |:8080 |:8000 ' || true
  ss -lunp 2>/dev/null | grep ':53 ' || true
else
  echo "(ss not found)"
fi

echo ""
echo "=== Local HTTP checks ==="
code_8080=$(curl -sS -o /dev/null -w "%{http_code}" --connect-timeout 3 "http://127.0.0.1:8080/admin/" 2>/dev/null || echo "000")
code_81=$(curl -sS -o /dev/null -w "%{http_code}" --connect-timeout 3 "http://127.0.0.1:81/" 2>/dev/null || echo "000")
code_8000=$(curl -sS -o /dev/null -w "%{http_code}" --connect-timeout 3 "http://127.0.0.1:8000/docs" 2>/dev/null || echo "000")

[[ "$code_8080" =~ ^(200|301|302|401)$ ]] && ok "Pi-hole admin (8080) HTTP $code_8080" || fail "Pi-hole admin (8080) got $code_8080 (expect 200/302/401)"
[[ "$code_81" =~ ^(200|301|302)$ ]] && ok "NPM (81) HTTP $code_81" || fail "NPM (81) got $code_81"
[[ "$code_8000" =~ ^(200|301|302)$ ]] && ok "FastAPI /docs (8000) HTTP $code_8000" || fail "Nothing on 8000 /docs (code $code_8000) — start the PMS backend"

echo ""
echo "Done. For the full LAN + tunnel guide see: infra/COMPLETE_RUNBOOK.md"
