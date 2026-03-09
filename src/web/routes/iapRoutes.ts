import type { RouteRegistrar } from '../serverHelpers.js';
import { mustGetApp, parseId } from '../serverHelpers.js';

export const registerIapRoutes: RouteRegistrar = (router, ctx) => {
  router.get('/api/apps/:id/iaps', (req, res, next) => {
    try {
      const appId = parseId(req.params.id);
      mustGetApp(ctx.repo, appId);

      const rows = ctx.repo.listStoreIaps(appId);
      const appStoreIaps = rows
        .filter((row) => row.store === 'app_store')
        .map((row) => ({
          appId: row.appId,
          store: row.store,
          productId: row.productId,
          syncedAt: row.syncedAt,
          detail: parseIapDetailJson(row.detailJson),
        }));
      const playStoreIaps = rows
        .filter((row) => row.store === 'play_store')
        .map((row) => ({
          appId: row.appId,
          store: row.store,
          productId: row.productId,
          syncedAt: row.syncedAt,
          detail: parseIapDetailJson(row.detailJson),
        }));

      res.json({
        appId,
        appStoreIaps,
        playStoreIaps,
        counts: {
          appStore: appStoreIaps.length,
          playStore: playStoreIaps.length,
        },
      });
    } catch (error) {
      next(error);
    }
  });
};

function parseIapDetailJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
