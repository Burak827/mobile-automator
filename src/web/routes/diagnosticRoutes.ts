import type { RouteRegistrar } from '../serverHelpers.js';
import { mustGetApp, parseBoolean, parseId } from '../serverHelpers.js';

export const registerDiagnosticRoutes: RouteRegistrar = (router, ctx) => {
  router.post('/api/apps/:id/connections/test', async (req, res, next) => {
    try {
      const appId = parseId(req.params.id);
      const appRow = mustGetApp(ctx.repo, appId);

      const tasks: Array<Promise<unknown>> = [];
      tasks.push(
        ctx.storeApi
          .testAppStoreConnection(appRow)
          .then((result) => ({ store: 'app_store', result }))
          .catch((error) => ({
            store: 'app_store',
            error: error instanceof Error ? error.message : String(error),
          }))
      );

      tasks.push(
        ctx.storeApi
          .testPlayStoreConnection(appRow)
          .then((result) => ({ store: 'play_store', result }))
          .catch((error) => ({
            store: 'play_store',
            error: error instanceof Error ? error.message : String(error),
          }))
      );

      const results = await Promise.all(tasks);
      res.json({ appId, results, testedAt: new Date().toISOString() });
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/apps/:id/snapshots', async (req, res, next) => {
    try {
      const appId = parseId(req.params.id);
      const appRow = mustGetApp(ctx.repo, appId);
      const store = (req.query.store as string | undefined) ?? 'both';

      const payload: Record<string, unknown> = {
        appId,
        requestedStore: store,
        fetchedAt: new Date().toISOString(),
      };

      if (store === 'app_store' || store === 'both') {
        try {
          payload.appStore = await ctx.storeApi.fetchAppStoreSnapshot(appRow);
        } catch (error) {
          payload.appStoreError = error instanceof Error ? error.message : String(error);
        }
      }

      if (store === 'play_store' || store === 'both') {
        try {
          payload.playStore = await ctx.storeApi.fetchPlayStoreSnapshot(appRow);
        } catch (error) {
          payload.playStoreError = error instanceof Error ? error.message : String(error);
        }
      }

      res.json(payload);
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/apps/:id/workload', async (req, res, next) => {
    try {
      const appId = parseId(req.params.id);
      const appRow = mustGetApp(ctx.repo, appId);
      const includeRemote = parseBoolean(req.query.includeRemote, false);

      const localeRows = ctx.repo.listStoreLocales(appId);
      const workload = await ctx.storeApi.computeWorkload({
        app: appRow,
        localeRows,
        includeRemote,
      });

      res.json({
        appId,
        includeRemote,
        workload,
      });
    } catch (error) {
      next(error);
    }
  });
};
