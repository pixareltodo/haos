import { csfd } from 'node-csfd-api';
import { sleep } from '../utils/urlUtils.js';

function normalizeMediaUrl(url) {
  if (!url) {
    return '';
  }

  if (url.startsWith('//')) {
    return `https:${url}`;
  }

  return url;
}

function normalizeTitlesOther(titlesOther = []) {
  return Array.isArray(titlesOther)
    ? titlesOther
      .map((entry) => ({
        country: entry?.country || '',
        title: entry?.title || ''
      }))
      .filter((entry) => entry.title)
    : [];
}

export class CsfdApiClient {
  constructor(options, logger) {
    this.mode = options.csfd_api_mode || 'internal';
    this.baseUrl = options.csfd_api_base_url || '';
    this.delayMs = Number(options.csfd_request_delay_ms || 0);
    this.concurrency = Number(options.csfd_detail_concurrency || 1);
    this.logger = logger;
    this.nextAllowedAt = 0;
    this.activeCount = 0;
    this.waitQueue = [];
  }

  async throttle() {
    const waitMs = Math.max(0, this.nextAllowedAt - Date.now());
    if (waitMs > 0) {
      await sleep(waitMs);
    }

    this.nextAllowedAt = Date.now() + this.delayMs;
  }

  async acquireSlot() {
    if (this.activeCount < this.concurrency) {
      this.activeCount += 1;
      return;
    }

    await new Promise((resolve) => {
      this.waitQueue.push(resolve);
    });
    this.activeCount += 1;
  }

  releaseSlot() {
    this.activeCount = Math.max(0, this.activeCount - 1);
    const next = this.waitQueue.shift();
    if (next) {
      next();
    }
  }

  async fetchMovie(csfdId) {
    await this.acquireSlot();
    try {
      await this.throttle();
      this.logger.info('Fetching CSFD detail', { csfdId, mode: this.mode });

      const detail = this.mode === 'external'
        ? await this.fetchExternalMovie(csfdId)
        : await csfd.movie(Number(csfdId));

      return this.normalizeMovie(detail);
    }
    finally {
      this.releaseSlot();
    }
  }

  async fetchExternalMovie(csfdId) {
    if (!this.baseUrl) {
      throw new Error('csfd_api_base_url is not configured for external mode.');
    }

    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/movie/${csfdId}`);
    if (!response.ok) {
      throw new Error(`External CSFD API returned ${response.status} for ${csfdId}.`);
    }

    return response.json();
  }

  normalizeMovie(movie) {
    const description = Array.isArray(movie.descriptions)
      ? movie.descriptions.filter(Boolean).join('\n\n')
      : '';

    return {
      id: `${movie.id}`,
      title: movie.title || '',
      year: movie.year ? `${movie.year}` : '',
      type: movie.type || '',
      url: movie.url || '',
      genres: Array.isArray(movie.genres) ? movie.genres : [],
      origins: Array.isArray(movie.origins) ? movie.origins : [],
      poster: normalizeMediaUrl(movie.poster || movie.photo || ''),
      background: normalizeMediaUrl(movie.photo || movie.poster || ''),
      rating: typeof movie.rating === 'number' ? movie.rating : null,
      ratingCount: typeof movie.ratingCount === 'number' ? movie.ratingCount : null,
      descriptions: Array.isArray(movie.descriptions) ? movie.descriptions : [],
      description,
      colorRating: movie.colorRating || '',
      creators: movie.creators || {},
      vod: Array.isArray(movie.vod) ? movie.vod : [],
      titlesOther: normalizeTitlesOther(movie.titlesOther),
      tags: Array.isArray(movie.tags) ? movie.tags : [],
      premieres: Array.isArray(movie.premieres) ? movie.premieres : [],
      duration: Number.isFinite(Number(movie.duration)) ? Number(movie.duration) : null,
      fetchedAt: new Date().toISOString()
    };
  }
}
