#!/usr/bin/env bash

set -euo pipefail

PROVIDER_DOMAIN="ytmusic_free"
PROVIDER_SRC="/provider/ytmusic_free"
SETTINGS_PATH="/data/settings.json"
BACKUP_PATH="/data/ytmusic_free_provider_backup.json"
POLL_INTERVAL=10
BACKUP_INTERVAL=60
MA_CONTAINER_NAME="${MA_CONTAINER_NAME:-}"

log() {
    echo "[$(date)] $*"
}

find_ma_container() {
    if [ -n "$MA_CONTAINER_NAME" ]; then
        echo "$MA_CONTAINER_NAME"
        return 0
    fi

    local detected
    detected="$(docker ps --format '{{.Names}}' 2>/dev/null | grep -E '^addon_[0-9a-f]+_music_assistant$' | head -n1 || true)"
    if [ -n "$detected" ]; then
        echo "$detected"
        return 0
    fi

    echo "addon_d5369777_music_assistant"
}

container_exists() {
    docker inspect "$1" >/dev/null 2>&1
}

container_running() {
    [ "$(docker inspect -f '{{.State.Running}}' "$1" 2>/dev/null || true)" = "true" ]
}

container_id() {
    docker inspect -f '{{.Id}}' "$1" 2>/dev/null || true
}

wait_for_container_running() {
    local name="$1"
    local retries="${2:-60}"
    local delay="${3:-2}"

    for _ in $(seq 1 "$retries"); do
        if container_exists "$name" && container_running "$name"; then
            return 0
        fi
        sleep "$delay"
    done
    return 1
}

wait_for_settings() {
    local name="$1"
    local retries="${2:-60}"
    local delay="${3:-2}"

    for _ in $(seq 1 "$retries"); do
        if docker exec "$name" sh -c "[ -f '$SETTINGS_PATH' ]" >/dev/null 2>&1; then
            return 0
        fi
        sleep "$delay"
    done
    return 1
}

detect_python_version() {
    docker exec "$1" sh -c "ls /app/venv/lib 2>/dev/null | grep -E '^python3\\.[0-9]+$' | head -n1" 2>/dev/null || true
}

provider_destination() {
    local name="$1"
    local pyver
    pyver="$(detect_python_version "$name")"
    if [ -z "$pyver" ]; then
        pyver="python3.13"
        log "WARN: Could not detect MA Python version, defaulting to $pyver"
    fi
    echo "/app/venv/lib/$pyver/site-packages/music_assistant/providers"
}

provider_installed() {
    local name="$1"
    local destination
    destination="$(provider_destination "$name")"
    docker exec "$name" sh -c "[ -f '$destination/$PROVIDER_DOMAIN/manifest.json' ]" >/dev/null 2>&1
}

copy_settings_out() {
    docker cp "$1:$SETTINGS_PATH" "$2" >/dev/null 2>&1
}

copy_settings_in() {
    docker cp "$2" "$1:$SETTINGS_PATH" >/dev/null 2>&1
}

backup_provider_config() {
    local name="$1"
    local temp_settings="/tmp/${PROVIDER_DOMAIN}_settings_backup.json"
    local result

    if ! wait_for_settings "$name" 20 2; then
        log "WARN: settings.json not ready yet, skipping config backup"
        return 0
    fi

    if ! copy_settings_out "$name" "$temp_settings"; then
        log "WARN: Could not copy settings.json out of Music Assistant"
        return 0
    fi

    result="$(python3 /provider/provider_config_sync.py backup --settings "$temp_settings" --backup "$BACKUP_PATH" --domain "$PROVIDER_DOMAIN" || true)"
    case "$result" in
        backed_up)
            log "Provider config backup updated"
            ;;
        unchanged)
            log "Provider config backup already current"
            ;;
        no_provider_entries)
            log "Provider config not present yet, backup unchanged"
            ;;
        *)
            log "WARN: Unexpected backup result: ${result:-<empty>}"
            ;;
    esac
}

restore_provider_config() {
    local name="$1"
    local temp_settings="/tmp/${PROVIDER_DOMAIN}_settings_restore.json"
    local result

    if [ ! -f "$BACKUP_PATH" ]; then
        log "No provider config backup available yet"
        return 1
    fi

    if ! wait_for_settings "$name" 20 2; then
        log "WARN: settings.json not ready yet, skipping config restore"
        return 1
    fi

    if ! copy_settings_out "$name" "$temp_settings"; then
        log "WARN: Could not copy settings.json for restore"
        return 1
    fi

    result="$(python3 /provider/provider_config_sync.py restore --settings "$temp_settings" --backup "$BACKUP_PATH" --domain "$PROVIDER_DOMAIN" || true)"
    case "$result" in
        restored)
            if copy_settings_in "$name" "$temp_settings"; then
                log "Restored provider config into Music Assistant settings"
                return 0
            fi
            log "ERROR: Provider config restore succeeded locally but failed to copy back"
            return 1
            ;;
        already_present)
            log "Provider config already present in Music Assistant settings"
            return 1
            ;;
        no_backup_entries)
            log "Provider config backup is empty, nothing to restore"
            return 1
            ;;
        *)
            log "WARN: Unexpected restore result: ${result:-<empty>}"
            return 1
            ;;
    esac
}

copy_provider_files() {
    local name="$1"
    local destination
    destination="$(provider_destination "$name")"
    docker cp "$PROVIDER_SRC" "$name:$destination/" >/dev/null 2>&1
    log "Copied $PROVIDER_DOMAIN into $destination"
}

ensure_provider_present() {
    local name="$1"
    local changed=0

    if ! provider_installed "$name"; then
        log "Provider files missing in Music Assistant, installing them now"
        copy_provider_files "$name"
        changed=1
    else
        log "Provider files already present in Music Assistant"
    fi

    if restore_provider_config "$name"; then
        changed=1
    fi

    if [ "$changed" -eq 1 ]; then
        log "Restarting Music Assistant to load restored provider state"
        docker restart "$name" >/dev/null 2>&1
        wait_for_container_running "$name" 60 2 || log "WARN: Music Assistant did not report running in time after restart"
        sleep 8
    fi

    backup_provider_config "$name"
}

if ! docker info >/dev/null 2>&1; then
    log "ERROR: No Docker socket available. Turn Protection mode off."
    sleep 300
    exit 1
fi

MA_CONTAINER_NAME="$(find_ma_container)"
log "MA Provider Watcher starting for container '$MA_CONTAINER_NAME'"

last_container_id=""
last_backup_epoch=0

if wait_for_container_running "$MA_CONTAINER_NAME" 5 2; then
    last_container_id="$(container_id "$MA_CONTAINER_NAME")"
    log "MA running (${last_container_id:0:12}), checking provider state"
    ensure_provider_present "$MA_CONTAINER_NAME"
    last_container_id="$(container_id "$MA_CONTAINER_NAME")"
    last_backup_epoch="$(date +%s)"
else
    log "MA not running yet, waiting for container recreation"
fi

log "Polling for MA container changes every ${POLL_INTERVAL}s"
while true; do
    sleep "$POLL_INTERVAL"

    current_epoch="$(date +%s)"
    current_container_id=""

    if container_exists "$MA_CONTAINER_NAME" && container_running "$MA_CONTAINER_NAME"; then
        current_container_id="$(container_id "$MA_CONTAINER_NAME")"
    fi

    if [ -n "$current_container_id" ] && [ "$current_container_id" != "$last_container_id" ]; then
        log "Detected new MA container (${current_container_id:0:12}), repairing provider state"
        last_container_id="$current_container_id"
        ensure_provider_present "$MA_CONTAINER_NAME"
        last_container_id="$(container_id "$MA_CONTAINER_NAME")"
        last_backup_epoch="$current_epoch"
        continue
    fi

    if [ -z "$current_container_id" ] && [ -n "$last_container_id" ]; then
        log "MA stopped"
        last_container_id=""
        continue
    fi

    if [ -n "$current_container_id" ] && [ $((current_epoch - last_backup_epoch)) -ge "$BACKUP_INTERVAL" ]; then
        backup_provider_config "$MA_CONTAINER_NAME"
        last_backup_epoch="$current_epoch"
    fi
done
