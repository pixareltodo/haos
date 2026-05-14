const fs = require("fs");

const optionsPath = "/data/options.json";
const options = fs.existsSync(optionsPath)
  ? JSON.parse(fs.readFileSync(optionsPath, "utf8"))
  : {};

function boolString(value, fallback = false) {
  return (value ?? fallback) ? "True" : "False";
}

function stringValue(value, fallback = "") {
  if (value === undefined || value === null) {
    return fallback;
  }
  return String(value);
}

function shellEscape(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

const persistMedia = options.persist_media ?? true;
const apiKeyHash = stringValue(options.api_key);
const apiKeyPlain = stringValue(options.api_key_plain);
const env = {
  PERSIST_MEDIA: boolString(persistMedia, true),
  TZ: stringValue(process.env.TZ, "UTC"),
  WAHA_WORKER_ID: stringValue(options.worker_id, "haos"),
  WAHA_NAMESPACE: stringValue(options.namespace, "all"),
  WHATSAPP_DEFAULT_ENGINE: stringValue(options.default_engine, "WEBJS"),
  WAHA_PRINT_QR: boolString(options.print_qr, true),
  WHATSAPP_RESTART_ALL_SESSIONS: boolString(
    options.restart_all_sessions,
    false
  ),
  WAHA_AUTO_START_DELAY_SECONDS: stringValue(
    options.auto_start_delay_seconds,
    0
  ),
  WAHA_LOG_LEVEL: stringValue(options.log_level, "info"),
  WAHA_LOG_FORMAT: stringValue(options.log_format, "PRETTY"),
  WAHA_DASHBOARD_ENABLED: boolString(options.dashboard_enabled, true),
  WAHA_DASHBOARD_USERNAME: stringValue(options.dashboard_username, "waha"),
  WAHA_DASHBOARD_PASSWORD: stringValue(options.dashboard_password, "waha"),
  WHATSAPP_DOWNLOAD_MEDIA: boolString(options.download_media, true),
  WHATSAPP_FILES_FOLDER: persistMedia ? "/data/media" : "/tmp/whatsapp-files",
  WHATSAPP_FILES_LIFETIME: persistMedia
    ? "0"
    : stringValue(options.files_lifetime, 180),
};

const optionalEnv = {
  WAHA_API_KEY: apiKeyPlain || apiKeyHash,
  WAHA_API_KEY_PLAIN: apiKeyPlain,
  WAHA_NO_API_KEY:
    apiKeyPlain === "" && apiKeyHash === "" && options.no_api_key ? "True" : "",
  WAHA_BASE_URL: stringValue(options.base_url),
  WAHA_PUBLIC_URL: stringValue(options.public_url),
  WHATSAPP_HOOK_URL: stringValue(options.webhook_url),
  WHATSAPP_HOOK_EVENTS: stringValue(options.webhook_events),
  WHATSAPP_HOOK_HMAC_KEY: stringValue(options.webhook_hmac_key),
};

for (const [key, value] of Object.entries(optionalEnv)) {
  if (value !== "") {
    env[key] = value;
  }
}

for (const [key, value] of Object.entries(env)) {
  process.stdout.write(`export ${key}=${shellEscape(value)}\n`);
}
