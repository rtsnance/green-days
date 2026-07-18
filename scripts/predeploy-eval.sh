#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# build so wrangler dev serves the code that's about to ship
npm run build

# start the worker locally on the new code, with a throwaway persistence dir
# so a stale cached recipe from a previous run/session can't mask a real
# regression (Miniflare's Cache API persists to disk across restarts)
PERSIST_DIR="$(mktemp -d)"
trap 'rm -rf "$PERSIST_DIR"' EXIT
npx wrangler dev --port 8787 --local --persist-to "$PERSIST_DIR" >/tmp/gd-dev.log 2>&1 &
DEV_PID=$!
trap 'kill $DEV_PID 2>/dev/null || true; rm -rf "$PERSIST_DIR"' EXIT

# wait for it to answer
for i in $(seq 1 30); do
  curl -sf http://localhost:8787/greendays >/dev/null && break
  sleep 1
done

# run the deterministic gate against the local worker
GREENDAYS_RECIPE_URL="http://localhost:8787/greendays/api/recipe" \
  python3 eval/grade.py --no-judge --out "eval/runs/predeploy-$(date +%F-%H%M).json"
