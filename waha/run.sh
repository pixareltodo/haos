#!/bin/sh

set -eu

mkdir -p /data/sessions /data/media

eval "$(node /render-env.js)"

export WHATSAPP_API_HOSTNAME="0.0.0.0"
export WHATSAPP_API_PORT="3000"
export WAHA_LOCAL_STORE_BASE_DIR="/data/sessions"

if [ -z "${WAHA_API_KEY:-}" ] && [ "${WAHA_NO_API_KEY:-False}" != "True" ]; then
    echo "WARNING: api_key is empty and no_api_key is false. WAHA may generate a random API key on startup."
fi

if [ "${PERSIST_MEDIA:-False}" = "True" ]; then
    mkdir -p /data/media
else
    mkdir -p /tmp/whatsapp-files
fi

unset PERSIST_MEDIA

exec /usr/bin/tini -- /entrypoint.sh
