import type { RouteRegistrar } from '../serverHelpers.js';
import {
  mustGetApp,
  parseCreateAppInput,
  parseId,
  parseUpdateAppInput,
} from '../serverHelpers.js';
import { ALL_STORE_LOCALES, buildLocaleMatrix } from '../localeCatalog.js';
import { validateNamingConsistency } from '../storeRules.js';

export const registerAppCrudRoutes: RouteRegistrar = (router, ctx) => {
  router.get('/api/apps', (_req, res, next) => {
    try {
      const apps = ctx.repo.listApps().map((item) => {
        const locales = ctx.repo.listStoreLocales(item.id);
        return {
          ...item,
          appStoreLocaleCount: locales.filter((row) => row.store === 'app_store').length,
          playStoreLocaleCount: locales.filter((row) => row.store === 'play_store').length,
        };
      });
      res.json({ apps });
    } catch (error) {
      next(error);
    }
  });

  router.post('/api/apps', (req, res, next) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const input = parseCreateAppInput(body);
      const created = ctx.repo.createApp(input);
      res.status(201).json({ app: created });
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/apps/:id', (req, res, next) => {
    try {
      const appId = parseId(req.params.id);
      const appRow = mustGetApp(ctx.repo, appId);
      const locales = ctx.repo.listStoreLocales(appId);
      const names = ctx.repo.listNamingOverrides(appId);
      const localeDetails = ctx.repo.listStoreLocaleDetails(appId);
      const ascLocales = locales.filter((row) => row.store === 'app_store').map((row) => row.locale);
      const playLocales = locales.filter((row) => row.store === 'play_store').map((row) => row.locale);
      const namingIssues = validateNamingConsistency(
        names.map((entry) => ({
          locale: entry.locale,
          appStoreName: entry.appStoreName,
          appStoreKeywords: entry.appStoreKeywords,
          playStoreTitle: entry.playStoreTitle,
          iosBundleDisplayName: entry.iosBundleDisplayName,
        }))
      );

      res.json({
        app: appRow,
        locales,
        localeMatrix: buildLocaleMatrix({
          knownLocales: ALL_STORE_LOCALES,
          ascLocales,
          playLocales,
        }),
        namingOverrides: names,
        namingIssues,
        localeDetailCounts: {
          appStore: localeDetails.filter((row) => row.store === 'app_store').length,
          playStore: localeDetails.filter((row) => row.store === 'play_store').length,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.put('/api/apps/:id', (req, res, next) => {
    try {
      const appId = parseId(req.params.id);
      mustGetApp(ctx.repo, appId);

      const body = (req.body ?? {}) as Record<string, unknown>;
      const input = parseUpdateAppInput(body);
      const updated = ctx.repo.updateApp(appId, input);

      res.json({ app: updated });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/api/apps/:id', (req, res, next) => {
    try {
      const appId = parseId(req.params.id);
      mustGetApp(ctx.repo, appId);
      ctx.repo.deleteApp(appId);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });
};
