#!/bin/sh
set -eu

OPTIONS_FILE="/data/options.json"
USER_FOLDER="/data/.n8n"

mkdir -p "$USER_FOLDER"

json_get() {
  key="$1"
  node -e '
    const fs = require("fs");
    const file = process.argv[1];
    const key = process.argv[2];
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    const value = data[key];
    if (value === undefined || value === null) {
      process.exit(0);
    }
    if (typeof value === "boolean") {
      process.stdout.write(value ? "true" : "false");
      process.exit(0);
    }
    process.stdout.write(String(value));
  ' "$OPTIONS_FILE" "$key"
}

TIMEZONE="$(json_get timezone)"
N8N_HOST_OPT="$(json_get n8n_host)"
N8N_PORT_OPT="$(json_get n8n_port)"
N8N_PROTOCOL_OPT="$(json_get n8n_protocol)"
EDITOR_BASE_URL_OPT="$(json_get editor_base_url)"
WEBHOOK_URL_OPT="$(json_get webhook_url)"
ENCRYPTION_KEY_OPT="$(json_get encryption_key)"
ENFORCE_PERMS_OPT="$(json_get enforce_settings_file_permissions)"
RUNNERS_ENABLED_OPT="$(json_get runners_enabled)"
PRUNE_OPT="$(json_get executions_data_prune)"
PRUNE_MAX_AGE_OPT="$(json_get executions_data_max_age)"
PRUNE_MAX_COUNT_OPT="$(json_get executions_data_prune_max_count)"
SAVE_SUCCESS_OPT="$(json_get executions_data_save_on_success)"
SAVE_MANUAL_OPT="$(json_get executions_data_save_manual_executions)"
VACUUM_OPT="$(json_get db_sqlite_vacuum_on_startup)"

export N8N_PORT="${N8N_PORT_OPT:-5678}"
export N8N_HOST="${N8N_HOST_OPT:-0.0.0.0}"
export N8N_PROTOCOL="${N8N_PROTOCOL_OPT:-http}"
export N8N_USER_FOLDER="$USER_FOLDER"
export GENERIC_TIMEZONE="${TIMEZONE:-Europe/Prague}"
export TZ="${TIMEZONE:-Europe/Prague}"
export N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS="${ENFORCE_PERMS_OPT:-true}"
export N8N_RUNNERS_ENABLED="${RUNNERS_ENABLED_OPT:-true}"
export EXECUTIONS_DATA_PRUNE="${PRUNE_OPT:-true}"
export EXECUTIONS_DATA_MAX_AGE="${PRUNE_MAX_AGE_OPT:-168}"
export EXECUTIONS_DATA_PRUNE_MAX_COUNT="${PRUNE_MAX_COUNT_OPT:-5000}"
export EXECUTIONS_DATA_SAVE_ON_SUCCESS="${SAVE_SUCCESS_OPT:-none}"
export EXECUTIONS_DATA_SAVE_MANUAL_EXECUTIONS="${SAVE_MANUAL_OPT:-false}"
export DB_SQLITE_VACUUM_ON_STARTUP="${VACUUM_OPT:-true}"

if [ -n "${EDITOR_BASE_URL_OPT:-}" ]; then
  export N8N_EDITOR_BASE_URL="$EDITOR_BASE_URL_OPT"
else
  export N8N_EDITOR_BASE_URL="${N8N_PROTOCOL}://${N8N_HOST}:${N8N_PORT}"
fi

if [ -n "${WEBHOOK_URL_OPT:-}" ]; then
  export WEBHOOK_URL="$WEBHOOK_URL_OPT"
else
  export WEBHOOK_URL="${N8N_EDITOR_BASE_URL}/"
fi

if [ -n "${ENCRYPTION_KEY_OPT:-}" ]; then
  export N8N_ENCRYPTION_KEY="$ENCRYPTION_KEY_OPT"
fi

exec tini -- /docker-entrypoint.sh
