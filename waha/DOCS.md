# WAHA

WAHA is a self-hosted WhatsApp HTTP API with a web dashboard.

## What this add-on does

- Runs the official WAHA container inside Home Assistant OS
- Persists WhatsApp sessions in `/data/sessions`
- Optionally persists downloaded media in `/data/media`
- Exposes the dashboard at `/dashboard` on port `3000`

## Supported architectures

- `amd64`
- `aarch64`

## Recommended first start

1. Install the add-on from your custom repository.
2. Set either `api_key_plain` or `api_key` before exposing the port outside your LAN.
3. Start the add-on and open the web UI.
4. Use the dashboard to create or connect a WhatsApp session.

## Important notes

- `api_key_plain` is the simplest option for Home Assistant users. WAHA will hash it internally and you use that same plain key in clients like n8n.
- `api_key` is for advanced use when you already have a `sha512:...` hash prepared.
- If both API key fields stay empty and `no_api_key` is `false`, WAHA can generate its own random API key on startup.
- `persist_media: true` stores files in `/data/media` and disables automatic cleanup by setting `WHATSAPP_FILES_LIFETIME=0`.
- `persist_media: false` keeps media in `/tmp/whatsapp-files` and uses `files_lifetime` for cleanup.
- The add-on currently tracks WAHA `2026.4.3`.

## Main options

- `default_engine`: `WEBJS`, `NOWEB`, or `GOWS`
- `api_key_plain`: easiest secure API key option for Home Assistant and n8n
- `api_key`: pre-hashed `sha512:...` API key for advanced setups
- `dashboard_enabled`: enable or disable the WAHA dashboard
- `print_qr`: print QR code into the add-on log
- `webhook_url`, `webhook_events`, `webhook_hmac_key`: global webhook configuration
- `download_media`: enable or disable incoming media downloads
- `persist_media`: control whether media survives restarts

## Upstream docs

- WAHA configuration: https://waha.devlike.pro/docs/how-to/config/
- WAHA storage: https://waha.devlike.pro/docs/how-to/storages/
