# n8n Official

This add-on runs the official n8n Docker image and exposes n8n directly on port `5678`.

## Why this add-on

- Uses the official n8n image instead of a third-party wrapper
- Keeps your data in the add-on data directory
- Gives you direct editor/API/webhook access on one port
- Makes it easier to update n8n by changing the image tag in the Dockerfile

## Install from this GitHub repository

1. In Home Assistant, open `Settings > Add-ons > Add-on Store`.
2. Open the menu and choose `Repositories`.
3. Add this repository URL: `https://github.com/pixareltodo/haos`
4. Install `n8n Official`.
5. Review the options and start the add-on.
6. Open `http://<home-assistant-ip>:5678`.

## Recommended options

For local use on your network:

```yaml
timezone: Europe/Prague
n8n_host: 192.168.1.196
n8n_port: 5678
n8n_protocol: http
editor_base_url: ""
webhook_url: ""
encryption_key: ""
enforce_settings_file_permissions: true
runners_enabled: true
executions_data_prune: true
executions_data_max_age: 168
executions_data_prune_max_count: 5000
executions_data_save_on_success: none
executions_data_save_manual_executions: false
db_sqlite_vacuum_on_startup: true
```

## Notes

- If you already have existing n8n data you want to preserve, migrate the `.n8n` data carefully.
- If you set `encryption_key`, keep it stable. Changing it later can break access to saved credentials.
- Webhooks use the same `5678` port unless you place n8n behind a reverse proxy.
- If you want external URLs, set `editor_base_url` and `webhook_url` explicitly.
- This add-on currently builds from `docker.n8n.io/n8nio/n8n:stable`.
- A local add-on does not give you zero-maintenance updates by itself. To move to a newer upstream n8n version, rebuild the add-on or pin a specific image tag in `Dockerfile`.
