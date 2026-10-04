#!/usr/bin/env bash
# Phase 1 integration check: real Express app (in-memory user store, no MongoDB needed)
# <-> the frontend's real live API layer (axios + RTK Query + Redux store).
# Usage:  bash integration-tests/phase1/run.sh
set -euo pipefail
cd "$(dirname "$0")"
[ -d ../../backend/node_modules ]  || (cd ../../backend  && npm install --silent)
[ -d ../../frontend/node_modules ] || (cd ../../frontend && npm install --silent)
mkdir -p .build
bundle() { # $1=entry  $2=out  $3=VITE env json
  (cd ../../frontend && npx --yes esbuild "../integration-tests/phase1/$1" --bundle --platform=node --format=cjs \
    --outfile="../integration-tests/phase1/.build/$2" --log-level=error --loader:.jsx=jsx --jsx=automatic \
    --define:import.meta.env="$3")
}
bundle live.e2e.mjs live.cjs '{"VITE_API_BASE_URL":"http://127.0.0.1:5055/api"}'
node stub-server.cjs >/dev/null 2>&1 & PID=$!
trap 'kill $PID 2>/dev/null || true' EXIT
sleep 2
echo "── live auth ──"; node .build/live.cjs
