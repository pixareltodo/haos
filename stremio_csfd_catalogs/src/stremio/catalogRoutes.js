import express from 'express';

function parseExtras(extraSegment = '') {
  const extras = {
    skip: 0,
    search: ''
  };

  const cleaned = `${extraSegment || ''}`.replace(/\.json$/i, '');
  for (const token of cleaned.split(',')) {
    const [rawKey, ...rawValueParts] = token.split('=');
    const key = rawKey?.trim().toLowerCase();
    const value = rawValueParts.join('=').trim();

    if (!key || !value) {
      continue;
    }

    if (key === 'skip') {
      extras.skip = Number(value) || 0;
    }

    if (key === 'search') {
      extras.search = decodeURIComponent(value);
    }
  }

  return extras;
}

export function createCatalogRouter(catalogManager) {
  const router = express.Router();

  router.get('/:type/:catalogId/:extra', async (req, res, next) => {
    try {
      const { type, catalogId, extra = '' } = req.params;
      const { skip, search } = parseExtras(extra);
      const metas = await catalogManager.getCatalogMetas(catalogId, skip, search);
      res.json({ metas, cacheMaxAge: 3600, staleRevalidate: 3600, type });
    }
    catch (error) {
      next(error);
    }
  });

  router.get('/:type/:catalogId.json', async (req, res, next) => {
    try {
      const { type, catalogId } = req.params;
      const metas = await catalogManager.getCatalogMetas(catalogId, 0, '');
      res.json({ metas, cacheMaxAge: 3600, staleRevalidate: 3600, type });
    }
    catch (error) {
      next(error);
    }
  });

  return router;
}
