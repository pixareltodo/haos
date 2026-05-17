# Changelog

## 0.1.2

- Change add-on website link to the GitHub repository page for `n8n_official`

## 0.1.1

- Fix permissions for `/data/.n8n`
- Start wrapper as `root`, prepare persistent data directory, then run n8n as `node`
- Link `/home/node/.n8n` to `/data/.n8n` for compatibility with the official image

## 0.1.0

- Initial local add-on scaffold
- Uses official `docker.n8n.io/n8nio/n8n:stable`
- Exposes direct port `5678`
- Persists n8n user folder in `/data/.n8n`
