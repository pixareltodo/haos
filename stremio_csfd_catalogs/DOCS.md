# Stremio CSFD katalogy

## Co addon dela

Addon stahuje seznamy filmu z CSFD, doplnuje metadata, uklada je do lokalni cache a vystavuje je jako Stremio katalog.

## Hlavni endpointy

- `/manifest.json`
- `/catalog/...`
- `/meta/...`
- `/health`
- `/admin/csfd/status`
- `/admin/trakt/status`

## Trakt test

Pro test Trakt integrace nastav:

- `trakt_enabled`
- `trakt_client_id`
- `trakt_client_secret`

Pak lze pouzit:

- `POST /admin/trakt/device/start`
- `POST /admin/trakt/device/complete`
- `GET /admin/trakt/test?title=Certoviny&year=2017`
