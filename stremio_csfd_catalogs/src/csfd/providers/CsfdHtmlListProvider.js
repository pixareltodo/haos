import { load } from 'cheerio';
import { CatalogSourceProvider } from './CatalogSourceProvider.js';
import {
  computeAnubisHash,
  ensureAbsoluteUrl,
  extractCsfdIdFromUrl,
  hashMatchesDifficulty,
  normalizeTypeLabel
} from '../../utils/urlUtils.js';

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  addFromHeaders(headers) {
    const setCookies = typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : [];

    for (const cookieLine of setCookies) {
      const firstPart = cookieLine.split(';')[0];
      const separatorIndex = firstPart.indexOf('=');
      if (separatorIndex <= 0) {
        continue;
      }

      const name = firstPart.slice(0, separatorIndex).trim();
      const value = firstPart.slice(separatorIndex + 1).trim();
      this.cookies.set(name, value);
    }
  }

  toHeader() {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }
}

export class CsfdHtmlListProvider extends CatalogSourceProvider {
  constructor({ logger, requestDelayMs = 0 }) {
    super();
    this.logger = logger;
    this.requestDelayMs = requestDelayMs;
    this.cookieJar = new CookieJar();
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';
  }

  async loadItems(catalogConfig) {
    const items = [];
    let pageUrl = catalogConfig.source_url;
    let pageIndex = 1;
    let order = 0;
    const seen = new Set();

    while (pageUrl && pageIndex <= catalogConfig.max_pages && items.length < catalogConfig.max_items) {
      this.logger.info('Fetching CSFD list page', {
        catalogId: catalogConfig.id,
        pageIndex,
        pageUrl
      });

      const html = await this.fetchHtml(pageUrl);
      const pageItems = this.parsePageItems(html, pageUrl);

      for (const item of pageItems) {
        if (!item.csfdId || seen.has(item.csfdId)) {
          continue;
        }

        seen.add(item.csfdId);
        order += 1;
        items.push({
          ...item,
          order
        });

        if (items.length >= catalogConfig.max_items) {
          break;
        }
      }

      pageUrl = this.findNextPageUrl(html, pageUrl);
      pageIndex += 1;
    }

    return items;
  }

  async fetchHtml(url) {
    const response = await this.fetchWithCookies(url);
    const html = await response.text();

    if (!html.includes('id="anubis_challenge"')) {
      return html;
    }

    this.logger.info('Solving Anubis challenge', { url });
    await this.solveAnubisChallenge(url, html);
    const retry = await this.fetchWithCookies(url);
    return retry.text();
  }

  async fetchWithCookies(url, redirectsLeft = 5) {
    const headers = {
      'user-agent': this.userAgent
    };

    const cookieHeader = this.cookieJar.toHeader();
    if (cookieHeader) {
      headers.cookie = cookieHeader;
    }

    const response = await fetch(url, {
      headers,
      redirect: 'manual'
    });

    this.cookieJar.addFromHeaders(response.headers);

    if (response.status >= 300 && response.status < 400 && redirectsLeft > 0) {
      const location = response.headers.get('location');
      if (!location) {
        return response;
      }

      return this.fetchWithCookies(ensureAbsoluteUrl(url, location), redirectsLeft - 1);
    }

    return response;
  }

  async solveAnubisChallenge(targetUrl, html) {
    const challengeMatch = html.match(/<script id="anubis_challenge" type="application\/json">([\s\S]*?)<\/script>/i);
    if (!challengeMatch) {
      throw new Error('Anubis challenge payload was not found.');
    }

    const challengePayload = JSON.parse(challengeMatch[1]);
    const difficulty = Number(challengePayload.rules?.difficulty || 0);
    const challenge = challengePayload.challenge;
    const startedAt = Date.now();

    let nonce = 0;
    let hashBuffer;
    while (true) {
      hashBuffer = computeAnubisHash(challenge.randomData, nonce);
      if (hashMatchesDifficulty(hashBuffer, difficulty)) {
        break;
      }
      nonce += 1;
    }

    const hashHex = hashBuffer.toString('hex');
    const passUrl = new URL('/.within.website/x/cmd/anubis/api/pass-challenge', new URL(targetUrl).origin);
    passUrl.searchParams.set('id', challenge.id);
    passUrl.searchParams.set('response', hashHex);
    passUrl.searchParams.set('nonce', `${nonce}`);
    passUrl.searchParams.set('redir', targetUrl);
    passUrl.searchParams.set('elapsedTime', `${Math.max(1, Date.now() - startedAt)}`);

    await this.fetchWithCookies(passUrl.toString());
  }

  parsePageItems(html, pageUrl) {
    const $ = load(html);
    const items = [];

    $('h3.film-title-nooverflow').each((_, heading) => {
      const $heading = $(heading);
      const link = $heading.find('a.film-title-name').first();
      const href = link.attr('href') || '';
      const csfdId = extractCsfdIdFromUrl(href);
      if (!csfdId) {
        return;
      }

      const infoValues = $heading.find('span.info')
        .map((__, info) => $(info).text().replace(/^\(|\)$/g, '').trim())
        .get()
        .filter(Boolean);

      const year = infoValues.find((value) => /^\d{4}$/.test(value)) || '';
      const typeValue = infoValues.find((value) => !/^\d{4}$/.test(value)) || 'Film';
      const row = $heading.closest('tr');

      items.push({
        csfdId,
        title: link.text().trim(),
        csfdUrl: ensureAbsoluteUrl(pageUrl, href),
        year,
        origin: row.find('td.origin').text().trim(),
        genre: row.find('td.genre').text().trim(),
        typeLabel: normalizeTypeLabel(typeValue)
      });
    });

    return items;
  }

  findNextPageUrl(html, pageUrl) {
    const $ = load(html);
    const href = $('a.page-next').attr('href');
    return href ? ensureAbsoluteUrl(pageUrl, href) : null;
  }
}
