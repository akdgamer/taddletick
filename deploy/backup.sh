#!/bin/sh
# Dumps the database once a day into /backups and deletes dumps older than KEEP_DAYS.
set -u
while true; do
  file="/backups/taddletick-$(date +%Y%m%d-%H%M).dump"
  if pg_dump -h db -U tracker -Fc tracker > "$file.tmp"; then
    mv "$file.tmp" "$file"
    echo "$(date) backup written: $file"
  else
    rm -f "$file.tmp"
    echo "$(date) BACKUP FAILED" >&2
  fi
  find /backups -name 'taddletick-*.dump' -mtime "+${KEEP_DAYS:-30}" -delete
  sleep 86400
done
