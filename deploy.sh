#!/bin/sh
set -eu

cd "$(git rev-parse --show-toplevel)"

branch=$(git branch --show-current)
if [ "$branch" != "master" ]; then
  printf '배포 브랜치가 아닙니다: %s (master에서 실행하세요)\n' "$branch" >&2
  exit 1
fi

git status --short
printf '커밋 메시지: '
IFS= read -r message
if [ -z "$message" ]; then
  printf '커밋 메시지가 비어 있어 중단합니다.\n' >&2
  exit 1
fi

git add -A
if git diff --cached --quiet; then
  printf '커밋할 변경사항이 없습니다.\n' >&2
  exit 1
fi

git commit -m "$message"
git pull --rebase origin "$branch"
git push origin "$branch"

printf '푸시 완료. GitHub Actions가 Oracle 배포를 시작했습니다.\n'
