import type { AppStoreSnapshot, PlayStoreSnapshot } from '../storeService.js';
import { ALL_STORE_LOCALES, buildLocaleMatrix, iosToPlayLocale, playToIosLocale } from '../localeCatalog.js';
import type { StoreId } from '../storeRules.js';
import type { RouteRegistrar } from '../serverHelpers.js';
import {
  applyLocaleChangesToList,
  mustGetApp,
  parseIapFieldChanges,
  parseId,
  parseJsonOrUndefined,
  parseLocaleChanges,
  parseLocaleList,
  parseLocaleMatrix,
  parseStoreId,
  parseStoreScope,
  type IapFieldChangeInput,
  type LocaleChangeInput,
} from '../serverHelpers.js';

export const registerLocaleRoutes: RouteRegistrar = (router, ctx) => {
  router.get('/api/apps/:id/locales', (req, res, next) => {
    try {
      const appId = parseId(req.params.id);
      mustGetApp(ctx.repo, appId);

      const rows = ctx.repo.listStoreLocales(appId);
      const appStoreLocales = rows
        .filter((row) => row.store === 'app_store')
        .map((row) => row.locale);
      const playStoreLocales = rows
        .filter((row) => row.store === 'play_store')
        .map((row) => row.locale);
      res.json({
        appId,
        appStoreLocales,
        playStoreLocales,
        localeMatrix: buildLocaleMatrix({
          knownLocales: ALL_STORE_LOCALES,
          ascLocales: appStoreLocales,
          playLocales: playStoreLocales,
        }),
        rows,
      });
    } catch (error) {
      next(error);
    }
  });

  router.put('/api/apps/:id/locales', (req, res, next) => {
    try {
      const appId = parseId(req.params.id);
      mustGetApp(ctx.repo, appId);

      const body = (req.body ?? {}) as Record<string, unknown>;
      const matrixRows = parseLocaleMatrix(body.localeMatrix);
      const appStoreLocales =
        matrixRows.length > 0
          ? matrixRows.filter((row) => row.asc).map((row) => row.locale)
          : parseLocaleList(body.appStoreLocales);
      const playStoreLocales =
        matrixRows.length > 0
          ? matrixRows.filter((row) => row.android).map((row) => row.locale)
          : parseLocaleList(body.playStoreLocales);

      const appStoreRows = ctx.repo.replaceStoreLocales(appId, 'app_store', appStoreLocales);
      const playStoreRows = ctx.repo.replaceStoreLocales(appId, 'play_store', playStoreLocales);
      const updatedRows = ctx.repo.listStoreLocales(appId);

      res.json({
        appId,
        appStoreLocales: appStoreRows
          .filter((row) => row.store === 'app_store')
          .map((row) => row.locale),
        playStoreLocales: playStoreRows
          .filter((row) => row.store === 'play_store')
          .map((row) => row.locale),
        localeMatrix: buildLocaleMatrix({
          knownLocales: ALL_STORE_LOCALES,
          ascLocales: appStoreLocales,
          playLocales: playStoreLocales,
        }),
        rows: updatedRows,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/api/apps/:id/locales/sync', async (req, res, next) => {
    try {
      const appId = parseId(req.params.id);
      const appRow = mustGetApp(ctx.repo, appId);

      const body = (req.body ?? {}) as Record<string, unknown>;
      const storeScope = parseStoreScope(body.storeScope ?? req.query.storeScope);

      const errors: Array<{ store: StoreId; message: string }> = [];
      let syncedStoreCount = 0;

      const payload: Record<string, unknown> = {
        appId,
        storeScope,
        startedAt: new Date().toISOString(),
      };

      if (storeScope === 'app_store' || storeScope === 'both') {
        try {
          const snapshot = await ctx.storeApi.fetchAppStoreSnapshot(appRow);
          const locales = snapshot.locales.map((item) => item.locale);
          ctx.repo.replaceStoreLocales(appId, 'app_store', locales);
          const detailEntries = buildAppStoreDetailEntries(snapshot);
          ctx.repo.replaceStoreLocaleDetails(appId, 'app_store', detailEntries);
          let iapCount = 0;
          let iapError: string | undefined;
          try {
            const iapCatalog = await ctx.storeApi.fetchAppStoreIapCatalog(appRow);
            const iapRows = ctx.repo.replaceStoreIaps(
              appId,
              'app_store',
              iapCatalog.items.map((item) => ({
                productId: item.productId,
                detail: item,
                syncedAt: iapCatalog.fetchedAt,
              }))
            );
            iapCount = iapRows.length;
          } catch (error) {
            iapError = error instanceof Error ? error.message : String(error);
          }

          payload.appStore = {
            synced: true,
            localeCount: locales.length,
            detailCount: detailEntries.length,
            iapCount,
            iapSynced: !iapError,
            iapError,
            appId: snapshot.appId,
            versionId: snapshot.versionId,
            versionString: snapshot.versionString,
            fetchedAt: snapshot.fetchedAt,
          };
          syncedStoreCount += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          errors.push({ store: 'app_store', message });
          payload.appStore = { synced: false, error: message };
        }
      }

      if (storeScope === 'play_store' || storeScope === 'both') {
        try {
          const snapshot = await ctx.storeApi.fetchPlayStoreSnapshot(appRow);
          const locales = snapshot.locales.map((item) => item.locale);
          ctx.repo.replaceStoreLocales(appId, 'play_store', locales);
          const detailEntries = buildPlayStoreDetailEntries(snapshot);
          ctx.repo.replaceStoreLocaleDetails(appId, 'play_store', detailEntries);
          let iapCount = 0;
          let iapError: string | undefined;
          try {
            const iapCatalog = await ctx.storeApi.fetchPlayStoreIapCatalog(appRow);
            const iapRows = ctx.repo.replaceStoreIaps(
              appId,
              'play_store',
              iapCatalog.items.map((item) => ({
                productId: item.productId,
                detail: item,
                syncedAt: iapCatalog.fetchedAt,
              }))
            );
            iapCount = iapRows.length;
          } catch (error) {
            iapError = error instanceof Error ? error.message : String(error);
          }

          payload.playStore = {
            synced: true,
            localeCount: locales.length,
            detailCount: detailEntries.length,
            iapCount,
            iapSynced: !iapError,
            iapError,
            packageName: snapshot.packageName,
            fetchedAt: snapshot.fetchedAt,
          };
          syncedStoreCount += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          errors.push({ store: 'play_store', message });
          payload.playStore = { synced: false, error: message };
        }
      }

      const rows = ctx.repo.listStoreLocales(appId);
      const appStoreLocales = rows
        .filter((row) => row.store === 'app_store')
        .map((row) => row.locale);
      const playStoreLocales = rows
        .filter((row) => row.store === 'play_store')
        .map((row) => row.locale);

      payload.completedAt = new Date().toISOString();
      payload.errors = errors;
      payload.appStoreLocales = appStoreLocales;
      payload.playStoreLocales = playStoreLocales;
      payload.localeMatrix = buildLocaleMatrix({
        knownLocales: ALL_STORE_LOCALES,
        ascLocales: appStoreLocales,
        playLocales: playStoreLocales,
      });

      if (syncedStoreCount === 0 && errors.length > 0) {
        res.status(502).json(payload);
        return;
      }

      if (errors.length > 0) {
        res.status(207).json(payload);
        return;
      }

      res.json(payload);
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/apps/:id/prepare-ios-to-play', (req, res, next) => {
    try {
      const appId = parseId(req.params.id);
      mustGetApp(ctx.repo, appId);

      const iosDetails = ctx.repo.listStoreLocaleDetails(appId, 'app_store');
      if (iosDetails.length === 0) {
        res.status(400).json({ error: "iOS locale detayları bulunamadı. Önce eşzamanlayın." });
        return;
      }

      const playDetails = ctx.repo.listStoreLocaleDetails(appId, 'play_store');
      const playDetailByLocale = new Map<string, Record<string, unknown>>();
      for (const pd of playDetails) {
        try {
          playDetailByLocale.set(pd.locale, JSON.parse(pd.detailJson) as Record<string, unknown>);
        } catch {
          // skip
        }
      }

      const playLocaleSet = new Set(
        ctx.repo.listStoreLocales(appId)
          .filter((row) => row.store === 'play_store')
          .map((row) => row.locale)
      );

      type FieldDiff = {
        field: string;
        newValue: string;
        oldValue: string;
      };

      type DiffEntry = {
        iosLocale: string;
        playLocale: string;
        isNewLocale: boolean;
        fields: FieldDiff[];
      };

      type SkippedEntry = { iosLocale: string; reason: string };

      const entries: DiffEntry[] = [];
      const skipped: SkippedEntry[] = [];

      for (const row of iosDetails) {
        const playLocale = iosToPlayLocale(row.locale);
        if (!playLocale) {
          skipped.push({ iosLocale: row.locale, reason: "Play Store'da karşılığı yok" });
          continue;
        }

        let detail: Record<string, unknown>;
        try {
          detail = JSON.parse(row.detailJson) as Record<string, unknown>;
        } catch {
          skipped.push({ iosLocale: row.locale, reason: 'detail JSON parse hatası' });
          continue;
        }

        const appInfo = detail.appInfo as { name?: string; subtitle?: string } | undefined;
        const versionLoc = detail.versionLocalization as { description?: string } | undefined;

        const iosTitle = appInfo?.name ?? '';
        const iosShortDesc = appInfo?.subtitle ?? '';
        const iosFullDesc = versionLoc?.description ?? '';

        if (!iosTitle) {
          skipped.push({ iosLocale: row.locale, reason: 'appName (title) boş' });
          continue;
        }

        const isNewLocale = !playLocaleSet.has(playLocale);

        let playTitle = '';
        let playShortDesc = '';
        let playFullDesc = '';

        if (!isNewLocale) {
          const playDetail = playDetailByLocale.get(playLocale);
          if (playDetail) {
            const listing = playDetail.listing as {
              title?: string;
              shortDescription?: string;
              fullDescription?: string;
            } | undefined;
            playTitle = listing?.title ?? '';
            playShortDesc = listing?.shortDescription ?? '';
            playFullDesc = listing?.fullDescription ?? '';
          }
        }

        const norm = (value: string) => value.replace(/\s+$/, '');
        const fields: FieldDiff[] = [];
        if (norm(iosTitle) !== norm(playTitle)) {
          fields.push({ field: 'title', newValue: iosTitle, oldValue: playTitle });
        }
        if (norm(iosShortDesc) !== norm(playShortDesc)) {
          fields.push({ field: 'shortDescription', newValue: iosShortDesc, oldValue: playShortDesc });
        }
        if (norm(iosFullDesc) !== norm(playFullDesc)) {
          fields.push({ field: 'fullDescription', newValue: iosFullDesc, oldValue: playFullDesc });
        }

        if (fields.length > 0 || isNewLocale) {
          entries.push({ iosLocale: row.locale, playLocale, isNewLocale, fields });
        }
      }

      res.json({ appId, entries, skipped });
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/apps/:id/prepare-play-to-ios', (req, res, next) => {
    try {
      const appId = parseId(req.params.id);
      mustGetApp(ctx.repo, appId);

      const playDetails = ctx.repo.listStoreLocaleDetails(appId, 'play_store');
      if (playDetails.length === 0) {
        res.status(400).json({ error: "Play Store locale detayları bulunamadı. Önce eşzamanlayın." });
        return;
      }

      const iosDetails = ctx.repo.listStoreLocaleDetails(appId, 'app_store');
      const iosDetailByLocale = new Map<string, Record<string, unknown>>();
      for (const row of iosDetails) {
        try {
          iosDetailByLocale.set(row.locale, JSON.parse(row.detailJson) as Record<string, unknown>);
        } catch {
          // skip
        }
      }

      const iosLocaleSet = new Set(
        ctx.repo.listStoreLocales(appId)
          .filter((row) => row.store === 'app_store')
          .map((row) => row.locale)
      );

      type FieldDiff = { field: string; newValue: string; oldValue: string };
      type DiffEntry = {
        playLocale: string;
        iosLocale: string;
        isNewLocale: boolean;
        fields: FieldDiff[];
      };
      type SkippedEntry = { playLocale: string; reason: string };

      const entries: DiffEntry[] = [];
      const skipped: SkippedEntry[] = [];

      for (const row of playDetails) {
        const iosLocale = playToIosLocale(row.locale);
        if (!iosLocale) {
          skipped.push({ playLocale: row.locale, reason: "App Store'da karşılığı yok" });
          continue;
        }

        let detail: Record<string, unknown>;
        try {
          detail = JSON.parse(row.detailJson) as Record<string, unknown>;
        } catch {
          skipped.push({ playLocale: row.locale, reason: 'detail JSON parse hatası' });
          continue;
        }

        const listing = detail.listing as {
          title?: string;
          shortDescription?: string;
          fullDescription?: string;
        } | undefined;

        const playTitle = listing?.title ?? '';
        const playShortDesc = listing?.shortDescription ?? '';
        const playFullDesc = listing?.fullDescription ?? '';

        if (!playTitle) {
          skipped.push({ playLocale: row.locale, reason: 'title (appName) boş' });
          continue;
        }

        const isNewLocale = !iosLocaleSet.has(iosLocale);

        let iosAppName = '';
        let iosSubtitle = '';
        let iosDescription = '';

        if (!isNewLocale) {
          const iosDetail = iosDetailByLocale.get(iosLocale);
          if (iosDetail) {
            const appInfo = iosDetail.appInfo as { name?: string; subtitle?: string } | undefined;
            const versionLoc = iosDetail.versionLocalization as { description?: string } | undefined;
            iosAppName = appInfo?.name ?? '';
            iosSubtitle = appInfo?.subtitle ?? '';
            iosDescription = versionLoc?.description ?? '';
          }
        }

        const norm = (value: string) => value.replace(/\s+$/, '');
        const fields: FieldDiff[] = [];
        if (norm(playTitle) !== norm(iosAppName)) {
          fields.push({ field: 'appName', newValue: playTitle, oldValue: iosAppName });
        }
        if (norm(playShortDesc) !== norm(iosSubtitle)) {
          const truncated = playShortDesc.length > 30 ? playShortDesc.slice(0, 30) : playShortDesc;
          fields.push({ field: 'subtitle', newValue: truncated, oldValue: iosSubtitle });
        }
        if (norm(playFullDesc) !== norm(iosDescription)) {
          fields.push({ field: 'description', newValue: playFullDesc, oldValue: iosDescription });
        }

        if (fields.length > 0 || isNewLocale) {
          entries.push({ playLocale: row.locale, iosLocale, isNewLocale, fields });
        }
      }

      res.json({ appId, entries, skipped });
    } catch (error) {
      next(error);
    }
  });

  router.post('/api/apps/:id/locales/apply', async (req, res, next) => {
    try {
      const appId = parseId(req.params.id);
      const appRow = mustGetApp(ctx.repo, appId);
      const body = (req.body ?? {}) as Record<string, unknown>;
      const rawChanges = Array.isArray(body.changes) ? body.changes : [];
      const rawIapChanges = Array.isArray(body.iapChanges) ? body.iapChanges : rawChanges;

      const localeChanges = parseLocaleChanges(rawChanges);
      const iapChanges = parseIapFieldChanges(rawIapChanges);

      if (localeChanges.length === 0 && iapChanges.length === 0) {
        res.status(400).json({ error: 'No valid locale or IAP changes provided.' });
        return;
      }

      const ascChanges = localeChanges.filter((change) => change.store === 'app_store');
      const gpcChanges = localeChanges.filter((change) => change.store === 'play_store');

      const succeeded: LocaleChangeInput[] = [];
      const failed: Array<LocaleChangeInput & { error: string }> = [];
      const iapSucceeded: IapFieldChangeInput[] = [];
      const iapFailed: Array<IapFieldChangeInput & { error: string }> = [];

      if (ascChanges.length > 0) {
        const results = await Promise.allSettled(
          ascChanges.map(async (change) => {
            if (change.action === 'add') {
              await ctx.storeApi.addAscLocale(appRow, change.locale, change.fields);
            } else if (change.action === 'update') {
              await ctx.storeApi.updateAscLocaleFields(appRow, change.locale, change.fields ?? {});
            } else {
              await ctx.storeApi.deleteAscLocale(appRow, change.locale);
            }
          })
        );

        for (let index = 0; index < results.length; index += 1) {
          const result = results[index];
          const change = ascChanges[index];
          if (result.status === 'fulfilled') {
            succeeded.push(change);
          } else {
            failed.push({
              ...change,
              error: result.reason instanceof Error ? result.reason.message : String(result.reason),
            });
          }
        }
      }

      if (gpcChanges.length > 0) {
        const upsertByLocale = new Map<string, Record<string, string>>();
        const removeLocaleSet = new Set<string>();

        for (const change of gpcChanges) {
          if (change.action === 'remove') {
            removeLocaleSet.add(change.locale);
            upsertByLocale.delete(change.locale);
            continue;
          }
          removeLocaleSet.delete(change.locale);
          upsertByLocale.set(change.locale, change.fields ?? {});
        }

        const localesToAdd = Array.from(upsertByLocale.entries()).map(([locale, fields]) => ({
          locale,
          fields,
        }));
        const localesToRemove = Array.from(removeLocaleSet.values());

        try {
          if (localesToAdd.length > 0 || localesToRemove.length > 0) {
            await ctx.storeApi.applyPlayStoreLocaleChanges(appRow, localesToAdd, localesToRemove);
          }
          succeeded.push(...gpcChanges);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          for (const change of gpcChanges) {
            failed.push({ ...change, error: errorMessage });
          }
        }
      }

      if (iapChanges.length > 0) {
        type MergedIapChange = {
          store: StoreId;
          productId: string;
          iapType?: string;
          locale: string;
          fields: Record<string, string>;
          originals: IapFieldChangeInput[];
        };

        const mergedByTarget = new Map<string, MergedIapChange>();
        for (const change of iapChanges) {
          const key = `${change.store}::${change.productId}::${change.locale}`;
          const existing = mergedByTarget.get(key);
          if (existing) {
            existing.fields[change.field] = change.newValue;
            existing.originals.push(change);
            if (!existing.iapType && change.iapType) {
              existing.iapType = change.iapType;
            }
            continue;
          }
          mergedByTarget.set(key, {
            store: change.store,
            productId: change.productId,
            iapType: change.iapType,
            locale: change.locale,
            fields: { [change.field]: change.newValue },
            originals: [change],
          });
        }

        const mergedChanges = Array.from(mergedByTarget.values()).sort((a, b) => {
          if (a.store !== b.store) return a.store.localeCompare(b.store);
          if (a.productId !== b.productId) return a.productId.localeCompare(b.productId);
          return a.locale.localeCompare(b.locale);
        });

        for (const change of mergedChanges) {
          try {
            if (change.store === 'app_store') {
              const invalidFields = Object.keys(change.fields).filter(
                (field) => field !== 'name' && field !== 'description'
              );
              if (invalidFields.length > 0) {
                throw new Error(
                  `App Store IAP için desteklenmeyen alan(lar): ${invalidFields.join(', ')}`
                );
              }

              const name = Object.prototype.hasOwnProperty.call(change.fields, 'name')
                ? change.fields.name
                : undefined;
              const description = Object.prototype.hasOwnProperty.call(change.fields, 'description')
                ? change.fields.description
                : undefined;
              await ctx.storeApi.updateAscIapLocalizationFields(appRow, {
                productId: change.productId,
                locale: change.locale,
                name,
                description,
              });
            } else {
              const invalidFields = Object.keys(change.fields).filter(
                (field) => field !== 'title' && field !== 'description' && field !== 'benefits'
              );
              if (invalidFields.length > 0) {
                throw new Error(
                  `Play Store IAP için desteklenmeyen alan(lar): ${invalidFields.join(', ')}`
                );
              }

              const title = Object.prototype.hasOwnProperty.call(change.fields, 'title')
                ? change.fields.title
                : undefined;
              const description = Object.prototype.hasOwnProperty.call(change.fields, 'description')
                ? change.fields.description
                : undefined;
              const benefits = Object.prototype.hasOwnProperty.call(change.fields, 'benefits')
                ? change.fields.benefits
                    .split(/\r?\n/)
                    .map((entry) => entry.trim())
                    .filter((entry) => entry.length > 0)
                : undefined;

              await ctx.storeApi.updatePlayIapLocalizationFields(appRow, {
                productId: change.productId,
                iapType: change.iapType,
                locale: change.locale,
                title,
                description,
                benefits,
              });
            }

            iapSucceeded.push(...change.originals);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            for (const original of change.originals) {
              iapFailed.push({ ...original, error: errorMessage });
            }
          }
        }
      }

      if (succeeded.length > 0) {
        const ascSucceeded = succeeded.filter((change) => change.store === 'app_store');
        const gpcSucceeded = succeeded.filter((change) => change.store === 'play_store');

        if (ascSucceeded.length > 0) {
          const current = ctx.repo
            .listStoreLocales(appId)
            .filter((row) => row.store === 'app_store')
            .map((row) => row.locale);
          const next = applyLocaleChangesToList(current, ascSucceeded);
          ctx.repo.replaceStoreLocales(appId, 'app_store', next);
        }

        if (gpcSucceeded.length > 0) {
          const current = ctx.repo
            .listStoreLocales(appId)
            .filter((row) => row.store === 'play_store')
            .map((row) => row.locale);
          const next = applyLocaleChangesToList(current, gpcSucceeded);
          ctx.repo.replaceStoreLocales(appId, 'play_store', next);
        }
      }

      const iapRefreshErrors: Array<{ store: StoreId; message: string }> = [];
      const iapSucceededStores = new Set(iapSucceeded.map((change) => change.store));
      if (iapSucceededStores.has('app_store')) {
        try {
          const appStoreCatalog = await ctx.storeApi.fetchAppStoreIapCatalog(appRow);
          ctx.repo.replaceStoreIaps(
            appId,
            'app_store',
            appStoreCatalog.items.map((item) => ({
              productId: item.productId,
              detail: item,
              syncedAt: appStoreCatalog.fetchedAt,
            }))
          );
        } catch (error) {
          iapRefreshErrors.push({
            store: 'app_store',
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (iapSucceededStores.has('play_store')) {
        try {
          const playStoreCatalog = await ctx.storeApi.fetchPlayStoreIapCatalog(appRow);
          ctx.repo.replaceStoreIaps(
            appId,
            'play_store',
            playStoreCatalog.items.map((item) => ({
              productId: item.productId,
              detail: item,
              syncedAt: playStoreCatalog.fetchedAt,
            }))
          );
        } catch (error) {
          iapRefreshErrors.push({
            store: 'play_store',
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const rows = ctx.repo.listStoreLocales(appId);
      const appStoreLocales = rows
        .filter((row) => row.store === 'app_store')
        .map((row) => row.locale);
      const playStoreLocales = rows
        .filter((row) => row.store === 'play_store')
        .map((row) => row.locale);

      res.json({
        appId,
        succeeded,
        failed,
        iapSucceeded,
        iapFailed,
        iapRefreshErrors,
        appStoreLocales,
        playStoreLocales,
        completedAt: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/apps/:id/locales/details', (req, res, next) => {
    try {
      const appId = parseId(req.params.id);
      mustGetApp(ctx.repo, appId);

      const storeScope = parseStoreScope(req.query.store);
      const rows =
        storeScope === 'both'
          ? ctx.repo.listStoreLocaleDetails(appId)
          : ctx.repo.listStoreLocaleDetails(appId, storeScope);

      res.json({
        appId,
        store: storeScope,
        count: rows.length,
        entries: rows.map((row) => ({
          appId: row.appId,
          store: row.store,
          locale: row.locale,
          syncedAt: row.syncedAt,
          detail: parseJsonOrUndefined(row.detailJson),
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/apps/:id/locales/details/:store/:locale', (req, res, next) => {
    try {
      const appId = parseId(req.params.id);
      mustGetApp(ctx.repo, appId);

      const store = parseStoreId(req.params.store);
      const locale = req.params.locale;
      const row = ctx.repo.getStoreLocaleDetail(appId, store, locale);

      if (!row) {
        res.status(404).json({
          error: `Locale detail not found for appId=${appId}, store=${store}, locale=${locale}`,
        });
        return;
      }

      res.json({
        appId,
        store,
        locale,
        syncedAt: row.syncedAt,
        detail: parseJsonOrUndefined(row.detailJson),
      });
    } catch (error) {
      next(error);
    }
  });
};

function buildAppStoreDetailEntries(snapshot: AppStoreSnapshot): Array<{
  locale: string;
  syncedAt: string;
  detail: unknown;
}> {
  const localizationByLocale = new Map(
    snapshot.locales.map((item) => [item.locale, item] as const)
  );
  const appInfoByLocale = new Map(
    snapshot.appInfoNames.map((item) => [item.locale, item] as const)
  );
  const allLocales = new Set<string>([
    ...Array.from(localizationByLocale.keys()),
    ...Array.from(appInfoByLocale.keys()),
  ]);

  return Array.from(allLocales)
    .sort((a, b) => a.localeCompare(b))
    .map((locale) => {
      const localization = localizationByLocale.get(locale);
      const appInfo = appInfoByLocale.get(locale);
      return {
        locale,
        syncedAt: snapshot.fetchedAt,
        detail: {
          store: 'app_store',
          locale,
          appId: snapshot.appId,
          versionId: snapshot.versionId,
          versionString: snapshot.versionString,
          fetchedAt: snapshot.fetchedAt,
          versionLocalization: localization
            ? {
                lengths: localization.lengths,
                description: localization.description,
                promotionalText: localization.promotionalText,
                whatsNew: localization.whatsNew,
                keywords: localization.keywords,
                supportUrl: localization.supportUrl,
                marketingUrl: localization.marketingUrl,
              }
            : undefined,
          screenshots: localization?.screenshots,
          appInfo: appInfo
            ? {
                name: appInfo.name,
                subtitle: appInfo.subtitle,
                privacyPolicyUrl: appInfo.privacyPolicyUrl,
              }
            : undefined,
        },
      };
    });
}

function buildPlayStoreDetailEntries(snapshot: PlayStoreSnapshot): Array<{
  locale: string;
  syncedAt: string;
  detail: unknown;
}> {
  return snapshot.locales.map((item) => ({
    locale: item.locale,
    syncedAt: snapshot.fetchedAt,
    detail: {
      store: 'play_store',
      locale: item.locale,
      packageName: snapshot.packageName,
      editId: snapshot.editId,
      fetchedAt: snapshot.fetchedAt,
      listing: {
        lengths: item.lengths,
        title: item.title,
        shortDescription: item.shortDescription,
        fullDescription: item.fullDescription,
      },
      screenshots: item.screenshots,
    },
  }));
}
