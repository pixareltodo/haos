import fs from 'node:fs/promises';
import https from 'node:https';
import express from 'express';
import selfsigned from 'selfsigned';
import { loadAddonOptions } from './config/loadAddonOptions.js';
import { logger } from './utils/logger.js';
import { ensureDir, pathExists } from './utils/fileUtils.js';
import { CsfdCatalogManager } from './csfd/CsfdCatalogManager.js';
import { TraktAuthStore } from './trakt/TraktAuthStore.js';
import { TraktClient } from './trakt/TraktClient.js';
import { buildManifest } from './stremio/manifest.js';
import { createCatalogRouter } from './stremio/catalogRoutes.js';
import { createMetaRouter } from './stremio/metaRoutes.js';
import { createAdminRouter } from './admin/csfdAdminRoutes.js';
import { createTraktAdminRouter } from './admin/traktAdminRoutes.js';

function createApp(options, catalogManager, traktClient) {
  const app = express();

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  });

  app.use(express.json());

  app.get('/manifest.json', (_req, res) => {
    res.json(buildManifest(options, catalogManager.getManifestCatalogs()));
  });

  app.get('/health', async (_req, res) => {
    res.json({
      ok: true,
      addon: options.addon_name,
      version: options.addon_version || '1.0.6',
      buildSignature: options.addon_build_signature || '1.0.6-trakt-cloudflare-fix-2026-05-03',
      catalogs: await catalogManager.getStatus()
    });
  });

  app.use('/catalog', createCatalogRouter(catalogManager));
  app.use('/meta', createMetaRouter(catalogManager));
  app.use('/admin/csfd', createAdminRouter(catalogManager));
  app.use('/admin/trakt', createTraktAdminRouter(traktClient));

  app.use((error, _req, res, _next) => {
    logger.error('Unhandled request error', { error: error.message });
    res.status(500).json({
      error: error.message || 'Internal Server Error'
    });
  });

  return app;
}

async function resolveHttpsCredentials(options) {
  const certExists = await pathExists(options.https_certfile);
  const keyExists = await pathExists(options.https_keyfile);

  if (certExists && keyExists) {
    return {
      cert: await fs.readFile(options.https_certfile, 'utf8'),
      key: await fs.readFile(options.https_keyfile, 'utf8')
    };
  }

  if (!options.https_auto_self_signed) {
    return null;
  }

  const generated = selfsigned.generate([{
    name: 'commonName',
    value: options.host_ip || 'localhost'
  }], {
    days: 30,
    keySize: 2048
  });

  return {
    cert: generated.cert,
    key: generated.private
  };
}

async function start() {
  const options = await loadAddonOptions();
  logger.info('Addon build info', {
    version: options.addon_version || '1.0.6',
    buildSignature: options.addon_build_signature || '1.0.6-trakt-cloudflare-fix-2026-05-03'
  });
  await ensureDir(options.cacheDir);
  await ensureDir(options.shareDir);
  await ensureDir(`${options.shareDir}/import`);
  await ensureDir(`${options.shareDir}/scripts`);

  const catalogManager = new CsfdCatalogManager(options, logger);
  const traktClient = new TraktClient(options, logger, new TraktAuthStore(options.cacheDir));
  await catalogManager.init();

  const app = createApp(options, catalogManager, traktClient);

  if (options.http_enabled) {
    app.listen(options.http_port, '0.0.0.0', () => {
      logger.info('HTTP server listening', {
        port: options.http_port,
        manifest: `http://${options.host_ip}:${options.http_port}/manifest.json`
      });
    });
  }

  if (options.https_enabled) {
    const credentials = await resolveHttpsCredentials(options);
    if (credentials) {
      https.createServer(credentials, app).listen(options.https_port, '0.0.0.0', () => {
        logger.info('HTTPS server listening', {
          port: options.https_port,
          manifest: `https://${options.host_ip}:${options.https_port}/manifest.json`
        });
      });
    }
    else {
      logger.warn('HTTPS requested but no certificate material is available. HTTPS listener was skipped.');
    }
  }
}

start().catch((error) => {
  logger.error('Addon startup failed', { error: error.message, stack: error.stack });
  process.exit(1);
});
