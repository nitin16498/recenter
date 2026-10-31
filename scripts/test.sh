#!/usr/bin/env bash
# Recenter regression suite: everything that must pass before code is pushed.
#
#   scripts/test.sh          backend + frontend unit + build + browser tests
#   scripts/test.sh --quick  skip the browser tests (~2s instead of ~45s)
#
# Runs against throwaway databases; your backend/recenter.db is never touched.
# The browser tests start their own servers on ports 8011/5181, so your dev
# servers on 8000/5173 can keep running.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PYTHON="${RECENTER_PYTHON:-$ROOT/backend/.venv/bin/python}"
QUICK=0
[[ "${1:-}" == "--quick" ]] && QUICK=1

step() { printf '\n\033[1m▶ %s\033[0m\n' "$1"; }

step "Backend tests (pytest)"
(cd "$ROOT/backend" && "$PYTHON" -m pytest)

step "Frontend unit tests (vitest)"
(cd "$ROOT/frontend" && npx vitest run)

step "Frontend build"
(cd "$ROOT/frontend" && npm run build --silent)

if [[ $QUICK == 0 ]]; then
  step "Browser tests (playwright)"
  (cd "$ROOT/frontend" && RECENTER_PYTHON="$PYTHON" npx playwright test)
fi

printf '\n\033[32m✔ Regression suite passed\033[0m\n'
