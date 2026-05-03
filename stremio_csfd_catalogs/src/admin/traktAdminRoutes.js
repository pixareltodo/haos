import express from 'express';

export function createTraktAdminRouter(traktClient) {
  const router = express.Router();

  router.get('/status', async (_req, res, next) => {
    try {
      res.json(await traktClient.getStatus());
    }
    catch (error) {
      next(error);
    }
  });

  router.post('/device/start', async (_req, res, next) => {
    try {
      res.json(await traktClient.startDeviceAuth());
    }
    catch (error) {
      next(error);
    }
  });

  router.post('/device/complete', async (_req, res, next) => {
    try {
      res.json(await traktClient.completeDeviceAuth());
    }
    catch (error) {
      next(error);
    }
  });

  router.get('/test', async (req, res, next) => {
    try {
      res.json(await traktClient.testMovieLookup({
        title: `${req.query.title || ''}`.trim() || undefined,
        year: `${req.query.year || ''}`.trim() || undefined,
        type: `${req.query.type || ''}`.trim() || 'movie'
      }));
    }
    catch (error) {
      next(error);
    }
  });

  return router;
}
