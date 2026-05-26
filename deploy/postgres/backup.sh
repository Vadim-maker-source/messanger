#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════
# Ежедневный бэкап PostgreSQL.
# ════════════════════════════════════════════════════════════════
# Использование:
#   1. Положить в /usr/local/bin/pg-backup.sh (chmod +x)
#   2. Прописать в crontab от root:
#        0 3 * * * /usr/local/bin/pg-backup.sh
#      (каждый день в 03:00)
#
# Что делает:
#   - pg_dump БД в /var/backups/postgres/<DB>_<DATE>.sql.gz
#   - Удаляет файлы старше N дней (по умолчанию 30)
#   - Логирует в /var/log/pg-backup.log
# ════════════════════════════════════════════════════════════════

set -euo pipefail

DB_NAME="${DB_NAME:-webMessanger}"
KEEP_DAYS="${KEEP_DAYS:-30}"
BACKUP_DIR="/var/backups/postgres"
LOG_FILE="/var/log/pg-backup.log"

mkdir -p "$BACKUP_DIR"
touch "$LOG_FILE"

DATE=$(date +%Y%m%d_%H%M%S)
DUMP_FILE="$BACKUP_DIR/${DB_NAME}_${DATE}.sql.gz"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

log "Starting backup of $DB_NAME → $DUMP_FILE"

# pg_dump запускаем от пользователя postgres (peer auth)
sudo -u postgres pg_dump -d "$DB_NAME" --format=plain --no-owner --no-acl \
    | gzip -9 > "$DUMP_FILE"

# Размер для лога
SIZE=$(du -h "$DUMP_FILE" | awk '{print $1}')
log "Backup OK: $DUMP_FILE ($SIZE)"

# Очистка старых
DELETED=$(find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime +"$KEEP_DAYS" -print -delete | wc -l)
if [[ "$DELETED" -gt 0 ]]; then
    log "Cleanup: removed $DELETED backup(s) older than $KEEP_DAYS days"
fi

log "Done"
