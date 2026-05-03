import path from 'node:path';
import { ensureDir, readJson, writeJsonAtomic } from '../utils/fileUtils.js';

export class CsfdCache {
  constructor(cacheRoot) {
    this.cacheRoot = cacheRoot;
  }

  getCatalogRoot(catalogId) {
    return path.join(this.cacheRoot, 'catalogs', catalogId);
  }

  getMovieDir(catalogId) {
    return path.join(this.getCatalogRoot(catalogId), 'movies');
  }

  getListPath(catalogId) {
    return path.join(this.getCatalogRoot(catalogId), 'list.json');
  }

  getLastGoodListPath(catalogId) {
    return path.join(this.getCatalogRoot(catalogId), 'list.last-good.json');
  }

  getStatusPath(catalogId) {
    return path.join(this.getCatalogRoot(catalogId), 'status.json');
  }

  getRefreshLogPath(catalogId) {
    return path.join(this.getCatalogRoot(catalogId), 'refresh-log.json');
  }

  getMoviePath(catalogId, csfdId) {
    return path.join(this.getMovieDir(catalogId), `${csfdId}.json`);
  }

  async initCatalog(catalogId) {
    await ensureDir(this.getMovieDir(catalogId));
  }

  async readList(catalogId) {
    return readJson(this.getListPath(catalogId), null);
  }

  async readLastGoodList(catalogId) {
    return readJson(this.getLastGoodListPath(catalogId), null);
  }

  async writeSuccessfulRefresh(catalogId, listPayload, statusPayload) {
    await this.initCatalog(catalogId);
    await writeJsonAtomic(this.getListPath(catalogId), listPayload);
    await writeJsonAtomic(this.getLastGoodListPath(catalogId), listPayload);
    await writeJsonAtomic(this.getStatusPath(catalogId), statusPayload);
    await this.appendRefreshLog(catalogId, {
      at: new Date().toISOString(),
      success: true,
      itemCount: listPayload.items.length
    });
  }

  async writeFailedRefresh(catalogId, statusPayload, errorMessage) {
    await this.initCatalog(catalogId);
    await writeJsonAtomic(this.getStatusPath(catalogId), statusPayload);
    await this.appendRefreshLog(catalogId, {
      at: new Date().toISOString(),
      success: false,
      error: errorMessage
    });
  }

  async appendRefreshLog(catalogId, entry) {
    const current = await readJson(this.getRefreshLogPath(catalogId), []) || [];
    current.unshift(entry);
    await writeJsonAtomic(this.getRefreshLogPath(catalogId), current.slice(0, 100));
  }

  async readStatus(catalogId) {
    return readJson(this.getStatusPath(catalogId), null);
  }

  async readMovie(catalogId, csfdId) {
    return readJson(this.getMoviePath(catalogId, csfdId), null);
  }

  async writeMovie(catalogId, csfdId, payload) {
    await this.initCatalog(catalogId);
    await writeJsonAtomic(this.getMoviePath(catalogId, csfdId), payload);
  }
}
