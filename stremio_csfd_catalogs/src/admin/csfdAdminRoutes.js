import express from 'express';

export function createAdminRouter(catalogManager) {
  const router = express.Router();

  router.get('/status', async (_req, res, next) => {
    try {
      res.json(await catalogManager.getStatus());
    }
    catch (error) {
      next(error);
    }
  });

  router.get('/status/:catalogId', async (req, res, next) => {
    try {
      const allStatuses = await catalogManager.getStatus();
      const status = allStatuses[req.params.catalogId];
      if (!status) {
        res.status(404).json({ error: 'Catalog not found' });
        return;
      }

      res.json(status);
    }
    catch (error) {
      next(error);
    }
  });

  router.get('/matches/:catalogId', async (req, res, next) => {
    try {
      const report = await catalogManager.getMatchReport(req.params.catalogId);
      if (!report) {
        res.status(404).json({ error: 'Catalog not found' });
        return;
      }

      const unresolvedOnly = `${req.query.unresolvedOnly || ''}` === '1';
      if (unresolvedOnly) {
        res.json({
          ...report,
          items: report.items.filter((item) => !item.resolved)
        });
        return;
      }

      res.json(report);
    }
    catch (error) {
      next(error);
    }
  });

  router.post('/refresh', async (_req, res, next) => {
    try {
      res.json(await catalogManager.refreshAll('admin'));
    }
    catch (error) {
      next(error);
    }
  });

  router.post('/refresh/:catalogId', async (req, res, next) => {
    try {
      res.json(await catalogManager.refreshCatalog(req.params.catalogId, 'admin'));
    }
    catch (error) {
      next(error);
    }
  });

  return router;
}
