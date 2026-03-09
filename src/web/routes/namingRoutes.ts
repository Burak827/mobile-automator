import { APP_STORE_LOCALES } from '../localeCatalog.js';
import { renderInfoPlistStrings, validateNamingConsistency } from '../storeRules.js';
import type { RouteRegistrar } from '../serverHelpers.js';
import {
  mustGetApp,
  parseId,
  parseJsonOrUndefined,
  toNonEmptyString,
  toOptionalString,
} from '../serverHelpers.js';

export const registerNamingRoutes: RouteRegistrar = (router, ctx) => {
  router.get('/api/apps/:id/naming', (req, res, next) => {
    try {
      const appId = parseId(req.params.id);
      mustGetApp(ctx.repo, appId);

      const entries = ctx.repo.listNamingOverrides(appId);
      const issues = validateNamingConsistency(
        entries.map((entry) => ({
          locale: entry.locale,
          appStoreName: entry.appStoreName,
          appStoreKeywords: entry.appStoreKeywords,
          playStoreTitle: entry.playStoreTitle,
          iosBundleDisplayName: entry.iosBundleDisplayName,
        }))
      );

      res.json({ appId, entries, issues });
    } catch (error) {
      next(error);
    }
  });

  router.put('/api/apps/:id/naming', (req, res, next) => {
    try {
      const appId = parseId(req.params.id);
      mustGetApp(ctx.repo, appId);

      const body = (req.body ?? {}) as Record<string, unknown>;
      const entriesRaw = Array.isArray(body.entries) ? body.entries : [];

      const entries = entriesRaw.map((item) => {
        const row = (item ?? {}) as Record<string, unknown>;
        const locale = toOptionalString(row.locale);
        if (!locale) {
          throw new Error('Each naming row requires locale.');
        }
        return {
          locale,
          appStoreName: toOptionalString(row.appStoreName),
          appStoreKeywords: toOptionalString(row.appStoreKeywords),
          playStoreTitle: toOptionalString(row.playStoreTitle),
          iosBundleDisplayName: toOptionalString(row.iosBundleDisplayName),
        };
      });

      const updatedEntries = ctx.repo.replaceNamingOverrides(appId, entries);
      const issues = validateNamingConsistency(entries);

      res.json({ appId, entries: updatedEntries, issues });
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/apps/:id/name-consistency', (req, res, next) => {
    try {
      const appId = parseId(req.params.id);
      const appRow = mustGetApp(ctx.repo, appId);
      const entries = ctx.repo.listNamingOverrides(appId);

      const normalized = entries.map((entry) => ({
        locale: entry.locale,
        appStoreName: entry.appStoreName,
        appStoreKeywords: entry.appStoreKeywords,
        playStoreTitle: entry.playStoreTitle,
        iosBundleDisplayName: entry.iosBundleDisplayName,
      }));

      const issues = validateNamingConsistency(normalized);

      res.json({
        appId,
        canonicalName: appRow.canonicalName,
        entries,
        issues,
        ok: issues.filter((item) => item.level === 'error').length === 0,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/apps/:id/ios-info-plist/:locale', (req, res, next) => {
    try {
      const appId = parseId(req.params.id);
      const locale = req.params.locale;
      const appRow = mustGetApp(ctx.repo, appId);

      const names = ctx.repo.listNamingOverrides(appId);
      const row = names.find((item) => item.locale === locale);
      const value = row?.iosBundleDisplayName ?? row?.appStoreName ?? appRow.canonicalName;

      res.json({
        appId,
        locale,
        appName: value,
        content: renderInfoPlistStrings(value),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/apps/:id/apple-cfbundle-list', (req, res, next) => {
    try {
      const appId = parseId(req.params.id);
      const appRow = mustGetApp(ctx.repo, appId);

      const appStoreLocaleRows = ctx.repo
        .listStoreLocales(appId)
        .filter((row) => row.store === 'app_store');
      const appStoreLocales = Array.from(
        new Set(appStoreLocaleRows.map((row) => row.locale.trim()).filter((value) => value.length > 0))
      ).sort((a, b) => a.localeCompare(b));

      const namingByLocale = new Map(ctx.repo.listNamingOverrides(appId).map((row) => [row.locale, row] as const));

      const detailByLocale = new Map<string, Record<string, unknown>>();
      for (const row of ctx.repo.listStoreLocaleDetails(appId, 'app_store')) {
        const parsed = parseJsonOrUndefined(row.detailJson);
        if (parsed && typeof parsed === 'object') {
          detailByLocale.set(row.locale, parsed as Record<string, unknown>);
        }
      }

      const sourceLocale = appRow.sourceLocale;
      const sourceDetail = detailByLocale.get(sourceLocale);
      const sourceAppInfo =
        sourceDetail?.appInfo && typeof sourceDetail.appInfo === 'object'
          ? (sourceDetail.appInfo as Record<string, unknown>)
          : undefined;
      const sourceFallbackName = toNonEmptyString(sourceAppInfo?.name);

      const localesPayload: Record<
        string,
        {
          app_name: string;
          CFBundleDisplayName: string;
          CFBundleName: string;
        }
      > = {};

      for (const locale of appStoreLocales) {
        const naming = namingByLocale.get(locale);
        const detail = detailByLocale.get(locale);
        const appInfo =
          detail?.appInfo && typeof detail.appInfo === 'object'
            ? (detail.appInfo as Record<string, unknown>)
            : undefined;

        const appStoreName =
          toNonEmptyString(naming?.appStoreName) ??
          toNonEmptyString(appInfo?.name) ??
          sourceFallbackName ??
          appRow.canonicalName;

        const bundleName =
          toNonEmptyString(naming?.iosBundleDisplayName) ?? appStoreName ?? appRow.canonicalName;

        localesPayload[locale] = {
          app_name: appStoreName,
          CFBundleDisplayName: bundleName,
          CFBundleName: bundleName,
        };
      }

      const appStoreCatalogSet = new Set(APP_STORE_LOCALES);
      const unsupportedInCatalog = appStoreLocales.filter((locale) => !appStoreCatalogSet.has(locale));

      res.json({
        appId,
        sourceLocale,
        generatedAt: new Date().toISOString(),
        localeCount: Object.keys(localesPayload).length,
        unsupportedInCatalog,
        locales: localesPayload,
      });
    } catch (error) {
      next(error);
    }
  });
};
