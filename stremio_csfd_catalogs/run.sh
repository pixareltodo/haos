#!/usr/bin/with-contenv bashio

set -e

echo "[INIT] Starting standalone Stremio CSFD Catalogs addon"

export NODE_ENV=production
export ADDON_OPTIONS_FILE="/data/options.json"
export CSFD_CACHE_DIR="/data/csfd-cache"
export CSFD_SHARE_DIR="/share/csfd-lists"

mkdir -p /data/csfd-cache
mkdir -p /share/csfd-lists/import
mkdir -p /share/csfd-lists/scripts

echo "[INIT] Cache dir: $CSFD_CACHE_DIR"
echo "[INIT] Share dir: $CSFD_SHARE_DIR"

node /app/src/server.js
