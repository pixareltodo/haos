import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { parse } from 'csv-parse/sync';
import { CatalogSourceProvider } from './CatalogSourceProvider.js';
import { extractCsfdIdFromUrl, normalizeTypeLabel } from '../../utils/urlUtils.js';

const execFileAsync = promisify(execFile);

function normalizeRecords(records) {
  return records.map((row, index) => {
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
  });
}

export class ExternalScriptProvider extends CatalogSourceProvider {
  constructor({ logger, shareDir }) {
    super();
    this.logger = logger;
    this.shareDir = shareDir;
  }

  async loadItems(catalogConfig) {
    const scriptPath = path.isAbsolute(catalogConfig.script_path)
      ? catalogConfig.script_path
      : path.join(this.shareDir, 'scripts', catalogConfig.script_path);

    const outputPath = catalogConfig.script_output
      ? (path.isAbsolute(catalogConfig.script_output)
          ? catalogConfig.script_output
          : path.join(this.shareDir, 'scripts', catalogConfig.script_output))
      : null;

    const { command, args } = this.resolveRunner(scriptPath);
    this.logger.info('Executing external source script', {
      catalogId: catalogConfig.id,
      scriptPath,
      outputPath
    });

    const { stdout } = await execFileAsync(command, [...args, scriptPath], {
      cwd: path.dirname(scriptPath),
      env: {
        ...process.env,
        CSFD_SOURCE_URL: catalogConfig.source_url || '',
        CSFD_OUTPUT_PATH: outputPath || ''
      },
      maxBuffer: 20 * 1024 * 1024
    });

    const payload = outputPath ? await fs.readFile(outputPath, 'utf8') : stdout;
    const records = this.parsePayload(payload, outputPath || scriptPath);
    return normalizeRecords(records);
  }

  resolveRunner(scriptPath) {
    const extension = path.extname(scriptPath).toLowerCase();
    if (extension === '.py') {
      return {
        command: process.platform === 'win32' ? 'python' : 'python3',
        args: []
      };
    }

    if (extension === '.js' || extension === '.mjs') {
      return {
        command: 'node',
        args: []
      };
    }

    return {
      command: process.platform === 'win32' ? 'cmd.exe' : 'sh',
      args: process.platform === 'win32' ? ['/c'] : []
    };
  }

  parsePayload(payload, hintPath) {
    const extension = path.extname(hintPath).toLowerCase();
    if (extension === '.csv') {
      return parse(payload, {
        columns: true,
        bom: true,
        skip_empty_lines: true
      });
    }

    const parsed = JSON.parse(payload);
    return Array.isArray(parsed) ? parsed : (parsed.items || []);
  }
}
