#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
API_URL=http://127.0.0.1:8789/api/health
WEB_URL=http://127.0.0.1:4173
LOG_FILE="$ROOT_DIR/.cache/local-preview.log"
FORCE_RESTART=${1:-}

healthy() { curl -fsS --max-time 2 "$API_URL" >/dev/null; }
stop_port() {
  local port=$1 pids
  pids=$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
  [ -z "$pids" ] || kill $pids
}

cd "$ROOT_DIR"
if [ "$FORCE_RESTART" != "--restart" ] && healthy && curl -fsS --max-time 2 "$WEB_URL" >/dev/null; then
  printf '로컬 서버가 정상입니다: %s\n' "$WEB_URL"
else
  printf '로컬 서버가 응답하지 않아 재시작합니다.\n'
  stop_port 4173
  stop_port 8789
  command -v brew >/dev/null && brew services start postgresql@17 >/dev/null 2>&1 || true
  mkdir -p .cache
  nohup npm run dev >"$LOG_FILE" 2>&1 &
  for _ in {1..30}; do
    healthy && curl -fsS --max-time 2 "$WEB_URL" >/dev/null && break
    sleep 1
  done
  healthy && curl -fsS --max-time 2 "$WEB_URL" >/dev/null || { tail -n 80 "$LOG_FILE"; exit 1; }
  printf '로컬 서버를 재시작했습니다: %s\n' "$WEB_URL"
fi

open "$WEB_URL" 2>/dev/null || true
