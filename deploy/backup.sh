#!/usr/bin/env bash
# ==============================================================================
# VibeHabit Automated Database Backup Script (Disaster Recovery Layer 2)
# Reference: PRD §10, ARCHITECTURE §8 & §9
# ==============================================================================

set -euo pipefail

# Configuration with environment variable overrides
BACKUP_DIR="${BACKUP_DIR:-/var/backups/vibehabit}"
CONTAINER_NAME="${CONTAINER_NAME:-vibehabit-db}"
DB_NAME="${DB_NAME:-vibehabit}"
DB_USER="${DB_USER:-vibehabit_user}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"
BACKUP_FILE="${BACKUP_DIR}/vibehabit_backup_${TIMESTAMP}.sql.gz"

echo "=== [$(date --iso-8601=seconds)] Starting VibeHabit Database Backup ==="

# Ensure backup destination directory exists
mkdir -p "${BACKUP_DIR}"

# Detect available container engine (Podman preferred on Debian 12 LXC VPS)
if command -v podman &>/dev/null; then
  CONTAINER_CLI="podman"
elif command -v docker &>/dev/null; then
  CONTAINER_CLI="docker"
else
  echo "[ERROR] Neither 'podman' nor 'docker' container CLI found in PATH." >&2
  exit 1
fi

echo "[INFO] Using container CLI: ${CONTAINER_CLI}"
echo "[INFO] Target database: ${DB_NAME} in container: ${CONTAINER_NAME}"
echo "[INFO] Backup target: ${BACKUP_FILE}"

# Verify container is running
if ! "${CONTAINER_CLI}" ps --format '{{.Names}}' | grep -Eq "^${CONTAINER_NAME}\$"; then
  echo "[ERROR] Database container '${CONTAINER_NAME}' is not currently running." >&2
  exit 1
fi

# Execute pg_dump inside container and stream through gzip compression (maximum ratio -9)
BACKUP_TEMP="${BACKUP_FILE}.tmp"
trap 'rm -f "${BACKUP_TEMP}"' EXIT ERR INT TERM

"${CONTAINER_CLI}" exec "${CONTAINER_NAME}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" | gzip -9 > "${BACKUP_TEMP}"

# Verify gzip archive integrity
echo "[INFO] Verifying backup archive integrity..."
if ! gzip -t "${BACKUP_TEMP}"; then
  echo "[FATAL] Corrupted backup archive created! Removing: ${BACKUP_TEMP}" >&2
  rm -f "${BACKUP_TEMP}"
  exit 1
fi

# Move verified archive to final destination
mv "${BACKUP_TEMP}" "${BACKUP_FILE}"
trap - EXIT ERR INT TERM

BACKUP_SIZE="$(du -h "${BACKUP_FILE}" | cut -f1)"
echo "[SUCCESS] Backup created and verified successfully (${BACKUP_SIZE}): ${BACKUP_FILE}"

# Rotate old backups beyond retention threshold
echo "[INFO] Rotating backups older than ${RETENTION_DAYS} days..."
OLD_BACKUPS_COUNT="$(find "${BACKUP_DIR}" -name "vibehabit_backup_*.sql.gz" -type f -mtime +"${RETENTION_DAYS}" | wc -l)"

if [ "${OLD_BACKUPS_COUNT}" -gt 0 ]; then
  find "${BACKUP_DIR}" -name "vibehabit_backup_*.sql.gz" -type f -mtime +"${RETENTION_DAYS}" -print -delete
  echo "[INFO] Purged ${OLD_BACKUPS_COUNT} outdated backup archive(s)."
else
  echo "[INFO] No expired backups found beyond ${RETENTION_DAYS} days."
fi

echo "=== [$(date --iso-8601=seconds)] Backup Process Completed Cleanly ==="
exit 0
