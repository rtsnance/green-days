#!/usr/bin/env bash
# Run the recipe eval against the REAL model on the local worker.
#
# Unlike predeploy-eval.sh (which runs the full 40+ set and, with MOCK_RECIPES=1,
# grades the mock engine), this builds, boots wrangler dev, and runs only the
# five main-course baskets through the actual Anthropic API.
#
# Needs a real ANTHROPIC_API_KEY and MOCK_RECIPES=0 in .dev.vars.
#
#   bash scripts/eval-mains.sh            # deterministic gates only
#   bash scripts/eval-mains.sh --judge    # also run the LLM judge (costs more)
set -euo pipefail
cd "$(dirname "$0")/.."

JUDGE="--no-judge"
[ "${1:-}" = "--judge" ] && JUDGE=""

# Read the key out of .dev.vars so it lives in exactly one place. grade.py needs
# it in its own environment for the judge pass; wrangler reads .dev.vars itself.
KEY="$(grep -E '^ANTHROPIC_API_KEY=' .dev.vars | cut -d= -f2- | tr -d '[:space:]' || true)"
if [ -z "$KEY" ]; then
  echo "ERROR: ANTHROPIC_API_KEY is empty in .dev.vars. Add a real key and set MOCK_RECIPES=0." >&2
  exit 1
fi
if grep -qE '^MOCK_RECIPES=1' .dev.vars; then
  echo "ERROR: MOCK_RECIPES=1 in .dev.vars. Set it to 0 or you will grade the mock engine again." >&2
  exit 1
fi

npm run build

# Throwaway persistence dir so a cached recipe from a previous run cannot mask
# a real change (Miniflare's Cache API persists to disk across restarts).
PERSIST_DIR="$(mktemp -d)"
npx wrangler dev --port 8787 --local --persist-to "$PERSIST_DIR" >/tmp/gd-dev.log 2>&1 &
DEV_PID=$!
trap 'kill $DEV_PID 2>/dev/null || true; rm -rf "$PERSIST_DIR"' EXIT

for i in $(seq 1 30); do
  curl -sf http://localhost:8787/ >/dev/null && break
  sleep 1
done

OUT="eval/runs/mains-$(date +%F-%H%M).json"
# --sleep 8 stays under the worker's 8-per-60s per-IP rate limit, which is
# skipped for the mock engine but active as soon as MOCK_RECIPES is off.
ANTHROPIC_API_KEY="$KEY" GREENDAYS_RECIPE_URL="http://localhost:8787/api/recipe" \
  python3 eval/grade.py $JUDGE \
    --baskets eval/main_course_baskets.json \
    --sleep 8 \
    --label "main-course change" \
    --out "$OUT"

echo
echo "Report: $OUT"
echo "Worker log if anything looked wrong: /tmp/gd-dev.log"
