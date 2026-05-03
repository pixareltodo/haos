import express from 'express';

export function createMetaRouter(catalogManager) {
  const router = express.Router();

  router.get('/:type/:metaId.json', async (req, res, next) => {
    try {
      const meta = await catalogManager.getMeta(req.params.type, req.params.metaId);
      if (!meta) {
        res.status(404).json({ error: 'Meta not found' });
        return;
      }

      res.json({ meta, cacheMaxAge: 86400, staleRevalidate: 86400 });
    }
    catch (error) {
      next(error);
    }
  });

  return router;
}
