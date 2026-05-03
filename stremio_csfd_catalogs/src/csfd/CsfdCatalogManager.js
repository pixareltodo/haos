import { CsfdCache } from './CsfdCache.js';
import { CsfdApiClient } from './CsfdApiClient.js';
import { CinemetaMatcher } from './CinemetaMatcher.js';
import { TmdbClient } from './TmdbClient.js';
import { CsfdHtmlListProvider } from './providers/CsfdHtmlListProvider.js';
import { JsonFileProvider } from './providers/JsonFileProvider.js';
import { CsvFileProvider } from './providers/CsvFileProvider.js';
import { ExternalScriptProvider } from './providers/ExternalScriptProvider.js';
import { applyPostFilter } from './filters/postFilter.js';
import { mapDetailToMeta, mapListItemToMeta } from './mappers/stremioMapper.js';
import { normalizeSearchText, parseMetaId } from '../utils/urlUtils.js';

const PAGE_SIZE = 100;
const PREFETCH_HEAD_COUNT = 12;
const PAGE_WARMUP_COUNT = 8;
const ENRICHMENT_VERSION = 4;

function createEmptyListState(catalogConfig) {
  return {
    catalogId: catalogConfig.id,
    name: catalogConfig.name,
    items: [],
    refreshedAt: null,
    sourceType: catalogConfig.source_type,
    sourceUrl: catalogConfig.source_url || '',
    totalSourceItems: 0
  };
}

function getCurrentYear() {
  return new Date().getFullYear();
}

function parseYear(value) {
  const year = Number(`${value || ''}`.slice(0, 4));
  return Number.isFinite(year) && year > 1800 ? year : null;
}

function isReleasedItem(item) {
  const year = parseYear(item?.year);
  return year !== null && year <= getCurrentYear();
}

function isFutureItem(item) {
  const year = parseYear(item?.year);
  return year !== null && year > getCurrentYear();
}

function prioritizeItemsForHydration(items) {
  return [...items].sort((left, right) => {
    const releasedLeft = isReleasedItem(left) ? 0 : 1;
    const releasedRight = isReleasedItem(right) ? 0 : 1;
    if (releasedLeft !== releasedRight) {
      return releasedLeft - releasedRight;
    }

    return (left.order || 0) - (right.order || 0);
  });
}

function matchesSearch(item, searchQuery) {
  if (!searchQuery) {
    return true;
  }

  const haystacks = [
    item.title,
    item.genre,
    item.origin,
    item.typeLabel
  ].map(normalizeSearchText).filter(Boolean);

  return haystacks.some((value) => value.includes(searchQuery));
}

export class CsfdCatalogManager {
  constructor(options, logger) {
    this.options = options;
    this.logger = logger;
    this.cache = new CsfdCache(options.cacheDir);
    this.apiClient = new CsfdApiClient(options, logger);
    this.matcher = new CinemetaMatcher({ logger });
    this.tmdbClient = new TmdbClient(options, logger);
    this.catalogStates = new Map();
    this.catalogStatuses = new Map();
    this.refreshTimers = [];
    this.hydrationJobs = new Map();
    this.providers = {
      csfd_html_list: new CsfdHtmlListProvider({
        logger,
        requestDelayMs: options.csfd_request_delay_ms
      }),
      json_file: new JsonFileProvider({
        logger,
        shareDir: options.shareDir
      }),
      csv_file: new CsvFileProvider({
        logger,
        shareDir: options.shareDir
      }),
      external_script: new ExternalScriptProvider({
        logger,
        shareDir: options.shareDir
      })
    };
  }

  getEnabledCatalogs() {
    return this.options.csfd_catalogs.filter((catalog) => catalog.enabled);
  }

  getCatalogById(catalogId) {
    return this.options.csfd_catalogs.find((catalog) => catalog.id === catalogId) || null;
  }

  async init() {
    for (const catalog of this.options.csfd_catalogs) {
      await this.cache.initCatalog(catalog.id);
      const cachedStatus = await this.cache.readStatus(catalog.id);
      if (cachedStatus) {
        this.catalogStatuses.set(catalog.id, cachedStatus);
      }

      const cachedList = await this.cache.readList(catalog.id)
        || await this.cache.readLastGoodList(catalog.id);
      if (cachedList) {
        this.catalogStates.set(catalog.id, cachedList);
      }
    }

    if (this.options.csfd_enabled && this.options.csfd_refresh_on_start) {
      for (const catalog of this.getEnabledCatalogs()) {
        await this.refreshCatalog(catalog.id, 'startup');
      }
    }
    else {
      for (const catalog of this.getEnabledCatalogs()) {
        const state = this.catalogStates.get(catalog.id);
        if (state?.items?.length) {
          this.startBackgroundHydration(catalog, state.items, 'startup-cache');
        }
      }
    }

    for (const catalog of this.getEnabledCatalogs()) {
      const timer = setInterval(() => {
        this.refreshCatalog(catalog.id, 'scheduled').catch((error) => {
          this.logger.error('Scheduled refresh failed', {
            catalogId: catalog.id,
            error: error.message
          });
        });
      }, catalog.refresh_interval_hours * 60 * 60 * 1000);

      this.refreshTimers.push(timer);
    }
  }

  async ensureCatalogState(catalogId) {
    if (this.catalogStates.has(catalogId)) {
      return this.catalogStates.get(catalogId);
    }

    const cached = await this.cache.readList(catalogId)
      || await this.cache.readLastGoodList(catalogId);
    if (cached) {
      this.catalogStates.set(catalogId, cached);
      return cached;
    }

    const catalogConfig = this.getCatalogById(catalogId);
    if (!catalogConfig) {
      return null;
    }

    await this.refreshCatalog(catalogId, 'on-demand');
    return this.catalogStates.get(catalogId) || createEmptyListState(catalogConfig);
  }

  async refreshAll(reason = 'manual') {
    const results = [];
    for (const catalog of this.getEnabledCatalogs()) {
      results.push(await this.refreshCatalog(catalog.id, reason));
    }
    return results;
  }

  async refreshCatalog(catalogId, reason = 'manual') {
    const catalogConfig = this.getCatalogById(catalogId);
    if (!catalogConfig) {
      throw new Error(`Unknown catalog: ${catalogId}`);
    }

    const status = {
      catalogId,
      name: catalogConfig.name,
      running: true,
      reason,
      lastAttemptAt: new Date().toISOString(),
      lastSuccessAt: this.catalogStatuses.get(catalogId)?.lastSuccessAt || null,
      error: null,
      hydrationRunning: Boolean(this.hydrationJobs.get(catalogId))
    };
    this.catalogStatuses.set(catalogId, status);

    try {
      const provider = this.providers[catalogConfig.source_type];
      if (!provider) {
        throw new Error(`Unsupported source_type: ${catalogConfig.source_type}`);
      }

      const sourceItems = await provider.loadItems(catalogConfig);
      const filteredItems = applyPostFilter(sourceItems, catalogConfig.post_filter)
        .filter((item) => catalogConfig.include_future_titles !== false || !isFutureItem(item))
        .slice(0, catalogConfig.max_items)
        .map((item, index) => ({
          ...item,
          order: index + 1
        }));

      const listPayload = {
        catalogId,
        name: catalogConfig.name,
        sourceType: catalogConfig.source_type,
        sourceUrl: catalogConfig.source_url || '',
        refreshedAt: new Date().toISOString(),
        totalSourceItems: sourceItems.length,
        items: filteredItems
      };

      const successStatus = {
        ...status,
        running: false,
        lastSuccessAt: listPayload.refreshedAt,
        itemCount: filteredItems.length,
        totalSourceItems: sourceItems.length
      };

      await this.cache.writeSuccessfulRefresh(catalogId, listPayload, successStatus);
      this.catalogStates.set(catalogId, listPayload);
      this.catalogStatuses.set(catalogId, successStatus);
      await this.prefetchCatalogHead(catalogConfig, filteredItems);
      this.startBackgroundHydration(catalogConfig, filteredItems, reason);
      return successStatus;
    }
    catch (error) {
      const fallback = await this.cache.readLastGoodList(catalogId);
      if (fallback) {
        this.catalogStates.set(catalogId, fallback);
      }
      else {
        this.catalogStates.set(catalogId, createEmptyListState(catalogConfig));
      }

      const failedStatus = {
        ...status,
        running: false,
        error: error.message
      };

      await this.cache.writeFailedRefresh(catalogId, failedStatus, error.message);
      this.catalogStatuses.set(catalogId, failedStatus);
      this.logger.error('Catalog refresh failed', {
        catalogId,
        error: error.message
      });
      return failedStatus;
    }
  }

  isFreshEnough(detail) {
    if (!detail?.fetchedAt) {
      return false;
    }

    const ttlMs = this.options.csfd_detail_cache_ttl_days * 24 * 60 * 60 * 1000;
    const ageMs = Date.now() - new Date(detail.fetchedAt).getTime();
    return ageMs < ttlMs;
  }

  isHydratedEnough(detail) {
    if (!this.isFreshEnough(detail)) {
      return false;
    }

    if (!detail?.idResolutionAttemptedAt) {
      return false;
    }

    if ((detail?.enrichmentVersion || 0) < ENRICHMENT_VERSION) {
      return false;
    }

    if (this.tmdbClient.enabled && !detail?.trailersResolvedAt) {
      return false;
    }

    return true;
  }

  async prefetchCatalogHead(catalogConfig, items) {
    const prefetchCount = Number(this.options.csfd_catalog_prefetch_count || PREFETCH_HEAD_COUNT);
    const headItems = prioritizeItemsForHydration(items).slice(0, prefetchCount);

    await Promise.all(headItems.map(async (item) => {
      try {
        await this.getOrFetchDetail(catalogConfig.id, item.csfdId, catalogConfig.stremio_type, item);
      }
      catch (error) {
        this.logger.warn('Head prefetch failed', {
          catalogId: catalogConfig.id,
          csfdId: item.csfdId,
          error: error.message
        });
      }
    }));
  }

  startBackgroundHydration(catalogConfig, items, reason = 'background') {
    if (this.hydrationJobs.has(catalogConfig.id)) {
      return;
    }

    const enabled = this.options.csfd_background_hydration_enabled !== false;
    if (!enabled || !items?.length) {
      return;
    }

    const job = this.runBackgroundHydration(catalogConfig, items, reason)
      .catch((error) => {
        this.logger.error('Background hydration failed', {
          catalogId: catalogConfig.id,
          error: error.message
        });
      })
      .finally(() => {
        this.hydrationJobs.delete(catalogConfig.id);
        const current = this.catalogStatuses.get(catalogConfig.id);
        if (current) {
          this.catalogStatuses.set(catalogConfig.id, {
            ...current,
            hydrationRunning: false,
            hydrationFinishedAt: new Date().toISOString()
          });
        }
      });

    this.hydrationJobs.set(catalogConfig.id, job);
    const current = this.catalogStatuses.get(catalogConfig.id);
    if (current) {
      this.catalogStatuses.set(catalogConfig.id, {
        ...current,
        hydrationRunning: true,
        hydrationStartedAt: new Date().toISOString()
      });
    }
  }

  async runBackgroundHydration(catalogConfig, items, reason) {
    const orderedItems = prioritizeItemsForHydration(items);
    const limit = Number(this.options.csfd_background_hydration_limit || 0);
    let processed = 0;
    let fetched = 0;
    let skipped = 0;
    let failed = 0;

    this.logger.info('Starting background CSFD hydration', {
      catalogId: catalogConfig.id,
      itemCount: orderedItems.length,
      reason,
      limit: limit || 'all'
    });

    for (const item of orderedItems) {
      if (limit > 0 && processed >= limit) {
        break;
      }

      processed += 1;
      try {
        const cached = await this.cache.readMovie(catalogConfig.id, item.csfdId);
        if (this.isHydratedEnough(cached)) {
          this.mergeResolvedItemData(catalogConfig.id, item.csfdId, cached);
          skipped += 1;
          continue;
        }

        await this.getOrFetchDetail(catalogConfig.id, item.csfdId, catalogConfig.stremio_type, item);
        fetched += 1;
      }
      catch (error) {
        failed += 1;
        this.logger.warn('Background hydration item failed', {
          catalogId: catalogConfig.id,
          csfdId: item.csfdId,
          title: item.title,
          error: error.message
        });
      }
    }

    this.logger.info('Completed background CSFD hydration', {
      catalogId: catalogConfig.id,
      processed,
      fetched,
      skipped,
      failed
    });
  }

  async warmCatalogPage(catalogConfig, pageItems, searchQuery = '') {
    const budget = searchQuery ? PAGE_WARMUP_COUNT : Math.min(PAGE_WARMUP_COUNT, PREFETCH_HEAD_COUNT);
    const warmItems = prioritizeItemsForHydration(pageItems).slice(0, budget);

    await Promise.all(warmItems.map(async (item) => {
      const cached = await this.cache.readMovie(catalogConfig.id, item.csfdId);
      if (this.isHydratedEnough(cached)) {
        this.mergeResolvedItemData(catalogConfig.id, item.csfdId, cached);
        return;
      }

      try {
        await this.getOrFetchDetail(catalogConfig.id, item.csfdId, catalogConfig.stremio_type, item);
      }
      catch (error) {
        this.logger.warn('Page warmup failed', {
          catalogId: catalogConfig.id,
          csfdId: item.csfdId,
          error: error.message
        });
      }
    }));
  }

  mergeResolvedItemData(catalogId, csfdId, detail) {
    const state = this.catalogStates.get(catalogId);
    if (!state?.items?.length) {
      return;
    }

    const item = state.items.find((candidate) => candidate.csfdId === `${csfdId}`);
    if (!item) {
      return;
    }

    item.stremioId = detail.stremioId || item.stremioId || `csfd:${csfdId}`;
    item.poster = detail.poster || item.poster || '';
    item.background = detail.background || item.background || item.poster || '';
  }

  async getCatalogMetas(catalogId, skip = 0, search = '') {
    const catalogConfig = this.getCatalogById(catalogId);
    if (!catalogConfig) {
      return [];
    }

    const normalizedSearch = normalizeSearchText(search);
    const state = await this.ensureCatalogState(catalogId);
    const filteredItems = (state?.items || []).filter((item) => matchesSearch(item, normalizedSearch));
    const pageItems = filteredItems.slice(skip, skip + PAGE_SIZE);
    await this.warmCatalogPage(catalogConfig, pageItems, normalizedSearch);
    this.startBackgroundHydration(catalogConfig, state?.items || [], normalizedSearch ? 'search-browse' : 'catalog-browse');

    const metas = [];
    for (const item of pageItems) {
      const cachedDetail = await this.cache.readMovie(catalogId, item.csfdId);
      if (cachedDetail) {
        this.mergeResolvedItemData(catalogId, item.csfdId, cachedDetail);
      }
      metas.push(mapListItemToMeta(item, catalogConfig.stremio_type, cachedDetail));
    }

    return metas;
  }

  async getMeta(catalogType, metaId) {
    const csfdId = parseMetaId(metaId);

    for (const catalog of this.getEnabledCatalogs()) {
      const state = await this.ensureCatalogState(catalog.id);

      if (csfdId) {
        const item = state?.items?.find((candidate) => candidate.csfdId === csfdId);
        if (!item) {
          continue;
        }

        const detail = await this.getOrFetchDetail(catalog.id, csfdId, catalog.stremio_type, item);
        return mapDetailToMeta(detail, catalogType || catalog.stremio_type, metaId);
      }

      const inMemoryItem = state?.items?.find((candidate) => candidate.stremioId === metaId);
      if (inMemoryItem) {
        const detail = await this.getOrFetchDetail(catalog.id, inMemoryItem.csfdId, catalog.stremio_type, inMemoryItem);
        return mapDetailToMeta(detail, catalogType || catalog.stremio_type, metaId);
      }

      for (const item of state?.items || []) {
        const cachedDetail = await this.cache.readMovie(catalog.id, item.csfdId);
        if (!cachedDetail) {
          continue;
        }

        this.mergeResolvedItemData(catalog.id, item.csfdId, cachedDetail);
        if (cachedDetail.stremioId === metaId || cachedDetail.imdbId === metaId) {
          return mapDetailToMeta(cachedDetail, catalogType || catalog.stremio_type, metaId);
        }
      }
    }

    return null;
  }

  async getOrFetchDetail(catalogId, csfdId, catalogType = 'movie', item = null) {
    const cached = await this.cache.readMovie(catalogId, csfdId);
    if (this.isFreshEnough(cached) && (cached?.enrichmentVersion || 0) >= ENRICHMENT_VERSION) {
      const enrichedCached = await this.enrichDetail(cached, catalogType, item);
      this.mergeResolvedItemData(catalogId, csfdId, enrichedCached);
      if (JSON.stringify(enrichedCached) !== JSON.stringify(cached)) {
        await this.cache.writeMovie(catalogId, csfdId, enrichedCached);
      }
      return enrichedCached;
    }

    const detail = await this.apiClient.fetchMovie(csfdId);
    const enrichedDetail = await this.enrichDetail(detail, catalogType, item);
    await this.cache.writeMovie(catalogId, csfdId, enrichedDetail);
    this.mergeResolvedItemData(catalogId, csfdId, enrichedDetail);
    return enrichedDetail;
  }

  async enrichDetail(detail, catalogType, item) {
    if (detail?.idResolutionAttemptedAt
      && detail?.stremioId
      && (detail?.enrichmentVersion || 0) >= ENRICHMENT_VERSION
      && (detail?.trailersResolvedAt || !this.tmdbClient.enabled)) {
      return detail;
    }

    let cinemetaMatch = null;
    try {
      cinemetaMatch = await this.matcher.resolve(item, detail, catalogType);
    }
    catch (error) {
      this.logger.warn('Cinemeta match failed', {
        csfdId: detail?.id,
        title: detail?.title || item?.title || '',
        error: error.message
      });
    }

    let tmdbMatch = null;
    try {
      if (cinemetaMatch?.imdbId) {
        tmdbMatch = await this.tmdbClient.findByImdbId(cinemetaMatch.imdbId, catalogType);
      }

      if (!tmdbMatch) {
        const aliases = Array.isArray(detail?.titlesOther)
          ? detail.titlesOther.map((entry) => entry?.title).filter(Boolean)
          : [];
        tmdbMatch = await this.tmdbClient.searchByText(
          detail?.title || item?.title || '',
          detail?.year || item?.year || '',
          catalogType,
          aliases
        );
      }
    }
    catch (error) {
      this.logger.warn('TMDB enrichment failed', {
        csfdId: detail?.id,
        title: detail?.title || item?.title || '',
        error: error.message
      });
    }

    const enriched = {
      ...detail,
      stremioId: cinemetaMatch?.stremioId || tmdbMatch?.imdbId || detail?.stremioId || `csfd:${detail.id}`,
      imdbId: cinemetaMatch?.imdbId || tmdbMatch?.imdbId || detail?.imdbId || null,
      tmdbId: tmdbMatch?.tmdbId || detail?.tmdbId || null,
      tmdbMediaType: tmdbMatch?.tmdbMediaType || detail?.tmdbMediaType || (catalogType === 'series' ? 'tv' : 'movie'),
      matchedTitle: cinemetaMatch?.matchedName || detail?.matchedTitle || tmdbMatch?.title || '',
      matchedYear: cinemetaMatch?.matchedYear || detail?.matchedYear || detail?.year || '',
      idResolutionSource: cinemetaMatch?.stremioId
        ? 'cinemeta'
        : tmdbMatch?.imdbId
          ? 'tmdb'
          : 'csfd-fallback',
      enrichmentVersion: ENRICHMENT_VERSION,
      idResolutionAttemptedAt: new Date().toISOString(),
      trailersResolvedAt: new Date().toISOString(),
      poster: detail?.poster || cinemetaMatch?.poster || tmdbMatch?.poster || '',
      background: detail?.background || cinemetaMatch?.background || tmdbMatch?.background || detail?.poster || cinemetaMatch?.poster || tmdbMatch?.poster || '',
      description: detail?.description || tmdbMatch?.overview || '',
      trailers: Array.isArray(detail?.trailers) && detail.trailers.length
        ? detail.trailers
        : (tmdbMatch?.trailers || []),
      releaseDate: detail?.releaseDate || tmdbMatch?.releaseDate || ''
    };

    if (cinemetaMatch?.stremioId) {
      this.logger.info('Resolved Stremio ID for CSFD item', {
        csfdId: detail.id,
        stremioId: cinemetaMatch.stremioId,
        imdbId: cinemetaMatch.imdbId || null,
        title: detail.title
      });
    }
    else if (tmdbMatch?.imdbId) {
      this.logger.info('Resolved Stremio ID from TMDB for CSFD item', {
        csfdId: detail.id,
        stremioId: tmdbMatch.imdbId,
        imdbId: tmdbMatch.imdbId,
        tmdbId: tmdbMatch.tmdbId,
        title: detail.title
      });
    }

    if (tmdbMatch?.trailers?.length) {
      this.logger.info('Resolved trailers from TMDB', {
        csfdId: detail.id,
        tmdbId: tmdbMatch.tmdbId,
        trailerCount: tmdbMatch.trailers.length,
        title: detail.title
      });
    }

    return enriched;
  }

  getManifestCatalogs() {
    return this.getEnabledCatalogs().map((catalog) => ({
      type: catalog.stremio_type,
      id: catalog.id,
      name: catalog.name,
      extra: [
        { name: 'search', isRequired: false },
        { name: 'skip', isRequired: false }
      ]
    }));
  }

  async getStatus() {
    const result = {};
    for (const catalog of this.options.csfd_catalogs) {
      result[catalog.id] = this.catalogStatuses.get(catalog.id)
        || await this.cache.readStatus(catalog.id)
        || {
          catalogId: catalog.id,
          name: catalog.name,
          running: false,
          lastAttemptAt: null,
          lastSuccessAt: null,
          error: null,
          hydrationRunning: false
        };
    }
    return result;
  }

  async getMatchReport(catalogId) {
    const catalog = this.getCatalogById(catalogId);
    if (!catalog) {
      return null;
    }

    const state = await this.ensureCatalogState(catalogId);
    const items = state?.items || [];
    const reportItems = [];

    for (const item of items) {
      const cachedDetail = await this.cache.readMovie(catalogId, item.csfdId);
      const stremioId = cachedDetail?.stremioId || item.stremioId || `csfd:${item.csfdId}`;
      const imdbId = cachedDetail?.imdbId || null;
      const tmdbId = cachedDetail?.tmdbId || null;
      const resolved = Boolean(imdbId || (stremioId && !stremioId.startsWith('csfd:')));

      reportItems.push({
        csfdId: item.csfdId,
        title: item.title,
        year: item.year,
        typeLabel: item.typeLabel,
        metaId: `csfd:${item.csfdId}`,
        videoId: stremioId,
        stremioId,
        imdbId,
        tmdbId,
        matchedTitle: cachedDetail?.matchedTitle || '',
        matchedYear: cachedDetail?.matchedYear || '',
        resolved,
        resolutionSource: cachedDetail?.idResolutionSource || (
          imdbId
            ? 'imdb'
            : tmdbId
              ? 'tmdb-only'
              : 'csfd-fallback'
        ),
        hasDetailCache: Boolean(cachedDetail),
        hasPoster: Boolean(cachedDetail?.poster),
        hasBackground: Boolean(cachedDetail?.background),
        trailersCount: Array.isArray(cachedDetail?.trailers) ? cachedDetail.trailers.length : 0,
        fetchedAt: cachedDetail?.fetchedAt || null,
        idResolutionAttemptedAt: cachedDetail?.idResolutionAttemptedAt || null
      });
    }

    const resolvedCount = reportItems.filter((item) => item.resolved).length;
    const unresolvedCount = reportItems.length - resolvedCount;

    return {
      catalogId,
      name: catalog.name,
      total: reportItems.length,
      resolvedCount,
      unresolvedCount,
      resolvedPercent: reportItems.length
        ? Number(((resolvedCount / reportItems.length) * 100).toFixed(1))
        : 0,
      items: reportItems
    };
  }
}
