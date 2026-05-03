import express from 'express';

function parseExtras(extraSegment = '') {
  const extras = {
    skip: 0,
    search: '',
    genre: '',
    country: '',
    type: '',
    year: '',
    future: '',
    matched: '',
    sort: ''
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

    if (key === 'genre') {
      extras.genre = decodeURIComponent(value);
    }

    if (key === 'country') {
      extras.country = decodeURIComponent(value);
    }

    if (key === 'type') {
      extras.type = decodeURIComponent(value);
    }

    if (key === 'year') {
      extras.year = decodeURIComponent(value);
    }

    if (key === 'future') {
      extras.future = decodeURIComponent(value);
    }

    if (key === 'matched') {
      extras.matched = decodeURIComponent(value);
    }

    if (key === 'sort') {
      extras.sort = decodeURIComponent(value);
    }
  }

  return extras;
}

export function createCatalogRouter(catalogManager) {
  const router = express.Router();

  router.get('/:type/:catalogId/:extra', async (req, res, next) => {
    try {
      const { type, catalogId, extra = '' } = req.params;
      const extras = parseExtras(extra);
      const metas = await catalogManager.getCatalogMetas(catalogId, extras);
      res.json({ metas, cacheMaxAge: 3600, staleRevalidate: 3600, type });
    }
    catch (error) {
      next(error);
    }
  });

  router.get('/:type/:catalogId.json', async (req, res, next) => {
    try {
      const { type, catalogId } = req.params;
      const metas = await catalogManager.getCatalogMetas(catalogId, parseExtras(''));
      res.json({ metas, cacheMaxAge: 3600, staleRevalidate: 3600, type });
    }
    catch (error) {
      next(error);
    }
  });

  return router;
}
