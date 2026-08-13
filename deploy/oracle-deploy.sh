#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
SSH_KEY=${ORACLE_SSH_KEY:-/private/tmp/flowpulse-oracle}
SSH_HOST=${ORACLE_SSH_HOST:-ubuntu@138.2.10.193}
REMOTE_DIR=${ORACLE_REMOTE_DIR:-/opt/flowpulse}

[[ -f "$SSH_KEY" ]] || { echo "SSH key not found: $SSH_KEY" >&2; exit 1; }

cd "$ROOT_DIR"
npm test
npm run build

SSH=(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new -o PubkeyAcceptedAlgorithms=+ssh-ed25519)
SCP=(scp -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new -o PubkeyAcceptedAlgorithms=+ssh-ed25519)

"${SSH[@]}" "$SSH_HOST" "sudo mkdir -p '$REMOTE_DIR'"
tar -czf - \
  --exclude=.env \
  --exclude=.cache \
  --exclude=node_modules \
  --exclude=dist \
  --exclude=.git \
  --exclude=.DS_Store \
  . | "${SSH[@]}" "$SSH_HOST" "sudo tar -xzf - -C '$REMOTE_DIR'"

"${SSH[@]}" "$SSH_HOST" "cd '$REMOTE_DIR' && sudo docker compose build api && sudo docker tag flowpulse-api flowpulse-collector && sudo docker compose build web && sudo docker compose up -d --no-build && sudo docker compose ps && curl -fsS http://127.0.0.1/api/health"

echo "Deploy complete: https://flowpulse.ai.kr/"
