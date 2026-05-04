import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathExists, readJson } from '../utils/fileUtils.js';
import { BUILD_INFO } from './buildInfo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

export const DEFAULTS = {
  addon_version: BUILD_INFO.version,
  addon_build_signature: BUILD_INFO.buildSignature,
  host_ip: '127.0.0.1',
  http_enabled: true,
  http_port: 7010,
  https_enabled: false,
  https_port: 7450,
  https_auto_self_signed: true,
  https_certfile: '/ssl/fullchain.pem',
  https_keyfile: '/ssl/privkey.pem',
  addon_name: 'CSFD katalogy',
  addon_id: 'community.csfd.catalogs.local',
  csfd_enabled: true,
  csfd_refresh_on_start: true,
  csfd_api_mode: 'internal',
  csfd_api_base_url: '',
  trakt_enabled: false,
  trakt_client_id: '',
  trakt_client_secret: '',
  tmdb_enabled: true,
  tmdb_api_read_access_token: '',
  tmdb_language: 'cs-CZ',
  tmdb_fallback_language: 'en-US',
  csfd_detail_concurrency: 2,
  csfd_catalog_prefetch_count: 12,
  csfd_background_hydration_enabled: true,
  csfd_background_hydration_limit: 0,
  csfd_list_refresh_interval_hours_default: 24,
  csfd_detail_cache_ttl_days: 30,
  csfd_request_delay_ms: 800,
  csfd_catalogs: []
};

export function mergeDeep(base, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return patch === undefined ? base : patch;
  }

  const result = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (Array.isArray(value)) {
      result[key] = value;
      continue;
    }

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = mergeDeep(base?.[key] || {}, value);
      continue;
    }

    result[key] = value;
  }

  return result;
}

export function normalizeCatalog(catalog, defaults) {
  const legacyFilter = catalog.post_filter || {};
  return {
    id: catalog.id,
    name: catalog.name || catalog.id,
    enabled: catalog.enabled !== false,
    source_type: catalog.source_type || 'csfd_html_list',
    source_url: catalog.source_url || '',
    source_file: catalog.source_file || '',
    script_path: catalog.script_path || '',
    script_output: catalog.script_output || '',
    refresh_interval_hours: Number(catalog.refresh_interval_hours || defaults.csfd_list_refresh_interval_hours_default),
    max_pages: Number(catalog.max_pages || 20),
    max_items: Number(catalog.max_items || 500),
    stremio_type: catalog.stremio_type === 'series' ? 'series' : 'movie',
    include_future_titles: catalog.include_future_titles !== false,
    matched_only_default: catalog.matched_only_default === true,
    post_filter: mergeDeep({
      enabled: false,
      allowed_origins: [],
      required_genres: [],
      allowed_types: []
    }, {
      enabled: catalog.filter_enabled ?? legacyFilter.enabled ?? false,
      allowed_origins: catalog.filter_allowed_origins ?? legacyFilter.allowed_origins ?? [],
      required_genres: catalog.filter_required_genres ?? legacyFilter.required_genres ?? [],
      allowed_types: catalog.filter_allowed_types ?? legacyFilter.allowed_types ?? []
    })
  };
}

export function resolveAddonOptionsSource() {
  const requestedOptionsFile = process.env.ADDON_OPTIONS_FILE;
  const fallbackOptionsFile = path.join(projectRoot, 'dev.options.json');

  return {
    projectRoot,
    requestedOptionsFile,
    fallbackOptionsFile,
    optionsFile: requestedOptionsFile || fallbackOptionsFile,
    cacheDir: process.env.CSFD_CACHE_DIR || path.join(projectRoot, 'data', 'csfd-cache'),
    shareDir: process.env.CSFD_SHARE_DIR || path.join(projectRoot, 'share', 'csfd-lists')
  };
}

export function normalizeAddonOptions(fileOptions = {}, source = resolveAddonOptionsSource()) {
  const merged = mergeDeep(DEFAULTS, fileOptions);

  return {
    ...merged,
    addon_version: DEFAULTS.addon_version,
    addon_build_signature: DEFAULTS.addon_build_signature,
    projectRoot: source.projectRoot,
    cacheDir: source.cacheDir,
    shareDir: source.shareDir,
    csfd_catalogs: (merged.csfd_catalogs || [])
      .filter((catalog) => catalog && catalog.id)
      .map((catalog) => normalizeCatalog(catalog, merged))
  };
}

export async function loadAddonOptions() {
  const source = resolveAddonOptionsSource();
  let fileOptions = {};

  if (source.requestedOptionsFile && await pathExists(source.requestedOptionsFile)) {
    fileOptions = await readJson(source.requestedOptionsFile, {}) || {};
  }
  else if (await pathExists(source.fallbackOptionsFile)) {
    fileOptions = await readJson(source.fallbackOptionsFile, {}) || {};
  }

  return normalizeAddonOptions(fileOptions, source);
}
