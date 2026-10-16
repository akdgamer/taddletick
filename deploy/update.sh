#!/bin/sh
# One-command update of Taddletick on the Pi. From your Mac:
#
#   ssh -t zuneek@taddletick-pi taddletick/deploy/update.sh
#
# Backs up the database, pulls the latest code, rebuilds, restarts and checks the app is
# healthy. If the new version doesn't come up, it puts back the previous code and image,
# restores the database if the update had migrated it, and starts the old version again.
#
#   --force          rebuild and restart even if there are no new commits
#   SIMULATE_FAILURE=1 ./deploy/update.sh --force   rehearse the rollback (changes nothing in the end)
set -eu
cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker-compose.prod.yml"
say() { printf '\n==> %s\n' "$*"; }
fail() { printf '\n!! %s\n' "$*" >&2; exit 1; }
db() { $COMPOSE exec -T db psql -U tracker -d tracker -Atc "$1"; }

[ -f .env ] || fail "No .env here: run this from the taddletick folder on the Pi"
BACKUP_PATH=$(sed -n 's/^BACKUP_PATH=//p' .env)
[ -d "$BACKUP_PATH" ] || fail "Backup folder $BACKUP_PATH isn't there (is the NAS mounted?); nothing changed"
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  git status --short
  fail "Files in the repo were edited on the Pi; commit them on the Mac instead, then: git checkout -- ."
fi

say "Checking GitHub for changes"
git fetch -q origin
PREV=$(git rev-parse HEAD)
NEW=$(git rev-parse '@{u}')
if [ "$PREV" = "$NEW" ] && [ "${1:-}" != "--force" ]; then
  echo "Already up to date: $(git log -1 --format='%h %s')"
  exit 0
fi
git log --format='  %h %s' "$PREV..$NEW"
STARTED=$(date +%s)

say "Backing up the database"
DUMP="$BACKUP_PATH/taddletick-before-update-$(date +%Y%m%d-%H%M).dump"
if $COMPOSE exec -T db pg_dump -U tracker -Fc tracker > "$DUMP.tmp"; then
  mv "$DUMP.tmp" "$DUMP"
  echo "  $DUMP"
else
  rm -f "$DUMP.tmp"
  fail "Backup failed; nothing changed"
fi
OLD_SCHEMA=$(db 'select version_num from alembic_version')

say "Updating the code"
git merge -q --ff-only "$NEW"

say "Building (a few minutes on a Pi 4; the current version keeps running)"
docker image tag taddletick:latest taddletick:previous
if ! $COMPOSE build -q; then
  git reset -q --hard "$PREV"
  fail "Build failed; code is back at $(git rev-parse --short HEAD) and the app never stopped"
fi

say "Restarting"
$COMPOSE up -d --remove-orphans 2>&1 | grep -E 'Recreated|Started|Error' || true

healthy() {
  [ -z "${SIMULATE_FAILURE:-}" ] || return 1
  for _ in $(seq 1 60); do
    if curl -sf http://localhost:8000/health >/dev/null; then
      sleep 5 # still up a moment later, not crash-looping
      curl -sf http://localhost:8000/health >/dev/null && return 0
    fi
    sleep 2
  done
  return 1
}

say "Checking the app is healthy"
if ! healthy; then
  say "The new version isn't healthy: rolling back"
  $COMPOSE logs --tail 20 app >&2 || true
  git reset -q --hard "$PREV"
  docker image tag taddletick:previous taddletick:latest
  if [ "$(db 'select version_num from alembic_version')" != "$OLD_SCHEMA" ]; then
    echo "  The update changed the database; restoring the backup taken just before it"
    $COMPOSE stop app worker
    $COMPOSE exec -T db pg_restore -U tracker -d tracker --clean --if-exists --no-owner --single-transaction < "$DUMP"
  fi
  $COMPOSE up -d 2>&1 | grep -E 'Recreated|Started|Error' || true
  unset SIMULATE_FAILURE
  healthy && fail "Rolled back: running $(git log -1 --format='%h %s') again" \
    || fail "The rollback isn't healthy either. Logs: $COMPOSE logs app"
fi

# The desk display reloads itself when the page changes; its service files need your password
if git diff --name-only "$PREV" "$NEW" | grep -q '^deploy/kiosk/' && systemctl is-enabled -q taddletick-display 2>/dev/null; then
  say "Desk display files changed: reinstalling its service (asks for your password)"
  if [ -t 0 ]; then sh deploy/kiosk/install.sh; else echo "  Run later: sh deploy/kiosk/install.sh"; fi
fi

docker image prune -f >/dev/null
say "Updated to $(git log -1 --format='%h %s') in $(( $(date +%s) - STARTED ))s"
