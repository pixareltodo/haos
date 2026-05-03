import fs from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { CatalogSourceProvider } from './CatalogSourceProvider.js';
import { extractCsfdIdFromUrl, normalizeTypeLabel } from '../../utils/urlUtils.js';

function normalizeRow(row, index) {
  const csfdUrl = row.csfdUrl || row.url || '';
  return {
    csfdId: `${row.csfdId || row.id || extractCsfdIdFromUrl(csfdUrl) || ''}`,
    title: row.title || row.name || '',
    csfdUrl,
    year: row.year ? `${row.year}` : '',
    origin: row.origin || row.origins || '',
    genre: row.genre || row.genres || '',
    typeLabel: normalizeTypeLabel(row.typeLabel || row.kind || row.type || 'Film'),
    order: row.order ? Number(row.order) : index + 1
  };
}

export class CsvFileProvider extends CatalogSourceProvider {
  constructor({ logger, shareDir }) {
    super();
    this.logger = logger;
    this.shareDir = shareDir;
  }

  async loadItems(catalogConfig) {
    const filePath = path.isAbsolute(catalogConfig.source_file)
      ? catalogConfig.source_file
      : path.join(this.shareDir, 'import', catalogConfig.source_file);

    this.logger.info('Loading CSV source file', { catalogId: catalogConfig.id, filePath });
    const content = await fs.readFile(filePath, 'utf8');
    return parse(content, {
      columns: true,
      bom: true,
      skip_empty_lines: true
    }).map(normalizeRow);
  }
}
