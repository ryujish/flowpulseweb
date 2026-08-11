#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  exec sudo bash "$0" "$@"
fi

if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

apt-get update
apt-get install -y docker.io docker-compose-v2
systemctl enable --now docker
docker --version
docker compose version
