import fs from 'node:fs/promises';
import path from 'node:path';
import { CatalogSourceProvider } from './CatalogSourceProvider.js';
import { extractCsfdIdFromUrl, normalizeTypeLabel } from '../../utils/urlUtils.js';

function normalizeItem(rawItem, index) {
  const csfdUrl = rawItem.csfdUrl || rawItem.url || '';
  const csfdId = `${rawItem.csfdId || rawItem.id || extractCsfdIdFromUrl(csfdUrl) || ''}`;

  return {
    csfdId,
    title: rawItem.title || rawItem.name || '',
    csfdUrl,
    year: rawItem.year ? `${rawItem.year}` : '',
    origin: rawItem.origin || rawItem.origins || '',
    genre: rawItem.genre || rawItem.genres || '',
    typeLabel: normalizeTypeLabel(rawItem.typeLabel || rawItem.kind || rawItem.type || 'Film'),
    order: rawItem.order ? Number(rawItem.order) : index + 1
  };
}

export class JsonFileProvider extends CatalogSourceProvider {
  constructor({ logger, shareDir }) {
    super();
    this.logger = logger;
    this.shareDir = shareDir;
  }

  async loadItems(catalogConfig) {
    const filePath = path.isAbsolute(catalogConfig.source_file)
      ? catalogConfig.source_file
      : path.join(this.shareDir, 'import', catalogConfig.source_file);

    this.logger.info('Loading JSON source file', { catalogId: catalogConfig.id, filePath });
    const content = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(content);
    const items = Array.isArray(parsed) ? parsed : (parsed.items || []);
    return items.map(normalizeItem);
  }
}
