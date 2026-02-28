import express from "express";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvConfig } from "../config.js";
import {
  AppRecord,
  CreateAppInput,
  MobileAutomatorRepository,
  UpdateAppInput,
} from "./db.js";
import { SyncJobRunner } from "./jobRunner.js";
import {
  StoreApiService,
  type AppStoreSnapshot,
  type PlayStoreSnapshot,
} from "./storeService.js";
import {
  renderInfoPlistStrings,
  STORE_RULES,
  type StoreId,
  validateNamingConsistency,
} from "./storeRules.js";
import {
  ALL_STORE_LOCALES,
  buildLocaleMatrix,
  LOCALE_CATALOG,
} from "./localeCatalog.js";

const env = loadEnvConfig();
const WEB_PORT = Number(env.webPort ?? "8787");
const DB_PATH = resolve(process.cwd(), env.webDbPath ?? "./data/mobile-automator.sqlite");
const WEB_ENABLE_UI = parseBoolean(env.webEnableUi, false);

const repo = new MobileAutomatorRepository(DB_PATH);
const storeApi = new StoreApiService();
const jobRunner = new SyncJobRunner(repo, storeApi);

const app = express();
app.use(express.json({ limit: "2mb" }));

type LocaleSelectionRow = {
  locale: string;
  asc: boolean;
  android: boolean;
};

function parseId(raw: string): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid id: ${raw}`);
  }
  return value;
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseLocaleList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item.length > 0);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  return [];
}

function parseLocaleMatrix(value: unknown): LocaleSelectionRow[] {
  if (!Array.isArray(value)) return [];
  const rows: LocaleSelectionRow[] = [];

  for (const item of value) {
    const row = (item ?? {}) as Record<string, unknown>;
    const locale = toOptionalString(row.locale);
    if (!locale) continue;
    rows.push({
      locale,
      asc: parseBoolean(row.asc, false),
      android: parseBoolean(row.android, false),
    });
  }

  return rows;
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "y"].includes(normalized)) return true;
    if (["0", "false", "no", "n"].includes(normalized)) return false;
  }
  return fallback;
}

function mustGetApp(appId: number): AppRecord {
  const appRow = repo.getAppById(appId);
  if (!appRow) {
    throw new Error(`App not found: ${appId}`);
  }
  return appRow;
}

function parseCreateAppInput(body: Record<string, unknown>): CreateAppInput {
  const canonicalName = toOptionalString(body.canonicalName);
  if (!canonicalName) {
    throw new Error("canonicalName is required.");
  }

  return {
    canonicalName,
    sourceLocale: toOptionalString(body.sourceLocale),
    androidPackageName: toOptionalString(body.androidPackageName),
    ascAppId: toOptionalString(body.ascAppId),
  };
}

function parseUpdateAppInput(body: Record<string, unknown>): UpdateAppInput {
  const next: UpdateAppInput = {};

  if (body.canonicalName !== undefined) {
    const canonicalName = toOptionalString(body.canonicalName);
    if (!canonicalName) {
      throw new Error("canonicalName cannot be empty.");
    }
    next.canonicalName = canonicalName;
  }

  if (body.sourceLocale !== undefined) {
    const sourceLocale = toOptionalString(body.sourceLocale);
    if (!sourceLocale) {
      throw new Error("sourceLocale cannot be empty.");
    }
    next.sourceLocale = sourceLocale;
  }

  if (body.androidPackageName !== undefined)
    next.androidPackageName = toOptionalString(body.androidPackageName);
  if (body.ascAppId !== undefined) next.ascAppId = toOptionalString(body.ascAppId);

  return next;
}

function parseStoreScope(value: unknown): "app_store" | "play_store" | "both" {
  if (value === "app_store" || value === "play_store" || value === "both") {
    return value;
  }
  return "both";
}

function parseStoreId(value: unknown): StoreId {
  if (value === "app_store" || value === "play_store") {
    return value;
  }
  throw new Error("store must be one of: app_store | play_store");
}

function parseJsonOrUndefined(raw?: string): unknown {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

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
          store: "app_store",
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
      store: "play_store",
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

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "mobile-automator-web",
    uiEnabled: WEB_ENABLE_UI,
    now: new Date().toISOString(),
  });
});

app.get("/api/meta", (_req, res) => {
  res.json({
    storeRules: STORE_RULES,
    localeCatalog: LOCALE_CATALOG,
    guidance: {
      publishVsSave:
        "Media requirements like screenshots are strict for publish/review stages; draft saves can be less strict depending on store flow.",
      references: [
        ...STORE_RULES.app_store.sources,
        ...STORE_RULES.play_store.sources,
      ],
    },
  });
});

app.get("/api/apps", (_req, res, next) => {
  try {
    const apps = repo.listApps().map((item) => {
      const locales = repo.listStoreLocales(item.id);
      return {
        ...item,
        appStoreLocaleCount: locales.filter((row) => row.store === "app_store").length,
        playStoreLocaleCount: locales.filter((row) => row.store === "play_store").length,
      };
    });
    res.json({ apps });
  } catch (error) {
    next(error);
  }
});

app.post("/api/apps", (req, res, next) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const input = parseCreateAppInput(body);
    const created = repo.createApp(input);
    res.status(201).json({ app: created });
  } catch (error) {
    next(error);
  }
});

app.get("/api/apps/:id", (req, res, next) => {
  try {
    const appId = parseId(req.params.id);
    const appRow = mustGetApp(appId);
    const locales = repo.listStoreLocales(appId);
    const names = repo.listNamingOverrides(appId);
    const localeDetails = repo.listStoreLocaleDetails(appId);
    const ascLocales = locales
      .filter((row) => row.store === "app_store")
      .map((row) => row.locale);
    const playLocales = locales
      .filter((row) => row.store === "play_store")
      .map((row) => row.locale);
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
        appStore: localeDetails.filter((row) => row.store === "app_store").length,
        playStore: localeDetails.filter((row) => row.store === "play_store").length,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.put("/api/apps/:id", (req, res, next) => {
  try {
    const appId = parseId(req.params.id);
    mustGetApp(appId);

    const body = (req.body ?? {}) as Record<string, unknown>;
    const input = parseUpdateAppInput(body);
    const updated = repo.updateApp(appId, input);

    res.json({ app: updated });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/apps/:id", (req, res, next) => {
  try {
    const appId = parseId(req.params.id);
    mustGetApp(appId);
    repo.deleteApp(appId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get("/api/apps/:id/locales", (req, res, next) => {
  try {
    const appId = parseId(req.params.id);
    mustGetApp(appId);

    const rows = repo.listStoreLocales(appId);
    const appStoreLocales = rows
      .filter((row) => row.store === "app_store")
      .map((row) => row.locale);
    const playStoreLocales = rows
      .filter((row) => row.store === "play_store")
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

app.put("/api/apps/:id/locales", (req, res, next) => {
  try {
    const appId = parseId(req.params.id);
    mustGetApp(appId);

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

    const appStoreRows = repo.replaceStoreLocales(appId, "app_store", appStoreLocales);
    const playStoreRows = repo.replaceStoreLocales(appId, "play_store", playStoreLocales);
    const updatedRows = repo.listStoreLocales(appId);

    res.json({
      appId,
      appStoreLocales: appStoreRows
        .filter((row) => row.store === "app_store")
        .map((row) => row.locale),
      playStoreLocales: playStoreRows
        .filter((row) => row.store === "play_store")
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

app.post("/api/apps/:id/locales/sync", async (req, res, next) => {
  try {
    const appId = parseId(req.params.id);
    const appRow = mustGetApp(appId);

    const body = (req.body ?? {}) as Record<string, unknown>;
    const storeScope = parseStoreScope(body.storeScope ?? req.query.storeScope);

    const errors: Array<{ store: StoreId; message: string }> = [];
    let syncedStoreCount = 0;

    const payload: Record<string, unknown> = {
      appId,
      storeScope,
      startedAt: new Date().toISOString(),
    };

    if (storeScope === "app_store" || storeScope === "both") {
      try {
        const snapshot = await storeApi.fetchAppStoreSnapshot(appRow);
        const locales = snapshot.locales.map((item) => item.locale);
        repo.replaceStoreLocales(appId, "app_store", locales);
        const detailEntries = buildAppStoreDetailEntries(snapshot);
        repo.replaceStoreLocaleDetails(appId, "app_store", detailEntries);

        payload.appStore = {
          synced: true,
          localeCount: locales.length,
          detailCount: detailEntries.length,
          appId: snapshot.appId,
          versionId: snapshot.versionId,
          versionString: snapshot.versionString,
          fetchedAt: snapshot.fetchedAt,
        };
        syncedStoreCount += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push({ store: "app_store", message });
        payload.appStore = { synced: false, error: message };
      }
    }

    if (storeScope === "play_store" || storeScope === "both") {
      try {
        const snapshot = await storeApi.fetchPlayStoreSnapshot(appRow);
        const locales = snapshot.locales.map((item) => item.locale);
        repo.replaceStoreLocales(appId, "play_store", locales);
        const detailEntries = buildPlayStoreDetailEntries(snapshot);
        repo.replaceStoreLocaleDetails(appId, "play_store", detailEntries);

        payload.playStore = {
          synced: true,
          localeCount: locales.length,
          detailCount: detailEntries.length,
          packageName: snapshot.packageName,
          fetchedAt: snapshot.fetchedAt,
        };
        syncedStoreCount += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push({ store: "play_store", message });
        payload.playStore = { synced: false, error: message };
      }
    }

    const rows = repo.listStoreLocales(appId);
    const appStoreLocales = rows
      .filter((row) => row.store === "app_store")
      .map((row) => row.locale);
    const playStoreLocales = rows
      .filter((row) => row.store === "play_store")
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

app.get("/api/apps/:id/locales/details", (req, res, next) => {
  try {
    const appId = parseId(req.params.id);
    mustGetApp(appId);

    const storeScope = parseStoreScope(req.query.store);
    const rows =
      storeScope === "both"
        ? repo.listStoreLocaleDetails(appId)
        : repo.listStoreLocaleDetails(appId, storeScope);

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

app.get("/api/apps/:id/locales/details/:store/:locale", (req, res, next) => {
  try {
    const appId = parseId(req.params.id);
    mustGetApp(appId);

    const store = parseStoreId(req.params.store);
    const locale = req.params.locale;
    const row = repo.getStoreLocaleDetail(appId, store, locale);

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

app.get("/api/apps/:id/naming", (req, res, next) => {
  try {
    const appId = parseId(req.params.id);
    mustGetApp(appId);

    const entries = repo.listNamingOverrides(appId);
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

app.put("/api/apps/:id/naming", (req, res, next) => {
  try {
    const appId = parseId(req.params.id);
    mustGetApp(appId);

    const body = (req.body ?? {}) as Record<string, unknown>;
    const entriesRaw = Array.isArray(body.entries) ? body.entries : [];

    const entries = entriesRaw.map((item) => {
      const row = (item ?? {}) as Record<string, unknown>;
      const locale = toOptionalString(row.locale);
      if (!locale) {
        throw new Error("Each naming row requires locale.");
      }
      return {
        locale,
        appStoreName: toOptionalString(row.appStoreName),
        appStoreKeywords: toOptionalString(row.appStoreKeywords),
        playStoreTitle: toOptionalString(row.playStoreTitle),
        iosBundleDisplayName: toOptionalString(row.iosBundleDisplayName),
      };
    });

    const updatedEntries = repo.replaceNamingOverrides(appId, entries);
    const issues = validateNamingConsistency(entries);

    res.json({ appId, entries: updatedEntries, issues });
  } catch (error) {
    next(error);
  }
});

app.get("/api/apps/:id/name-consistency", (req, res, next) => {
  try {
    const appId = parseId(req.params.id);
    const appRow = mustGetApp(appId);
    const entries = repo.listNamingOverrides(appId);

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
      ok: issues.filter((item) => item.level === "error").length === 0,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/apps/:id/ios-info-plist/:locale", (req, res, next) => {
  try {
    const appId = parseId(req.params.id);
    const locale = req.params.locale;
    const appRow = mustGetApp(appId);

    const names = repo.listNamingOverrides(appId);
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

app.post("/api/apps/:id/connections/test", async (req, res, next) => {
  try {
    const appId = parseId(req.params.id);
    const appRow = mustGetApp(appId);

    const tasks: Array<Promise<unknown>> = [];
    tasks.push(
      storeApi
        .testAppStoreConnection(appRow)
        .then((result) => ({ store: "app_store", result }))
        .catch((error) => ({
          store: "app_store",
          error: error instanceof Error ? error.message : String(error),
        }))
    );

    tasks.push(
      storeApi
        .testPlayStoreConnection(appRow)
        .then((result) => ({ store: "play_store", result }))
        .catch((error) => ({
          store: "play_store",
          error: error instanceof Error ? error.message : String(error),
        }))
    );

    const results = await Promise.all(tasks);
    res.json({ appId, results, testedAt: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

app.get("/api/apps/:id/snapshots", async (req, res, next) => {
  try {
    const appId = parseId(req.params.id);
    const appRow = mustGetApp(appId);
    const store = (req.query.store as string | undefined) ?? "both";

    const payload: Record<string, unknown> = {
      appId,
      requestedStore: store,
      fetchedAt: new Date().toISOString(),
    };

    if (store === "app_store" || store === "both") {
      try {
        payload.appStore = await storeApi.fetchAppStoreSnapshot(appRow);
      } catch (error) {
        payload.appStoreError = error instanceof Error ? error.message : String(error);
      }
    }

    if (store === "play_store" || store === "both") {
      try {
        payload.playStore = await storeApi.fetchPlayStoreSnapshot(appRow);
      } catch (error) {
        payload.playStoreError = error instanceof Error ? error.message : String(error);
      }
    }

    res.json(payload);
  } catch (error) {
    next(error);
  }
});

app.get("/api/apps/:id/workload", async (req, res, next) => {
  try {
    const appId = parseId(req.params.id);
    const appRow = mustGetApp(appId);
    const includeRemote = parseBoolean(req.query.includeRemote, false);

    const localeRows = repo.listStoreLocales(appId);
    const workload = await storeApi.computeWorkload({
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

app.post("/api/apps/:id/sync-jobs", (req, res, next) => {
  try {
    const appId = parseId(req.params.id);
    mustGetApp(appId);

    const body = (req.body ?? {}) as Record<string, unknown>;
    const storeScope = parseStoreScope(body.storeScope);
    const includeRemote = parseBoolean(body.includeRemote, true);

    const job = repo.createSyncJob({
      appId,
      storeScope,
      payload: {
        includeRemote,
      },
    });

    jobRunner.enqueue(job.id);

    res.status(202).json({
      job,
      message: "Preflight sync job queued.",
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/apps/:id/sync-jobs", (req, res, next) => {
  try {
    const appId = parseId(req.params.id);
    mustGetApp(appId);

    const jobs = repo.listSyncJobsForApp(appId).map((job) => ({
      ...job,
      payload: parseJsonOrUndefined(job.payloadJson),
      summary: parseJsonOrUndefined(job.summaryJson),
    }));

    res.json({ appId, jobs });
  } catch (error) {
    next(error);
  }
});

app.get("/api/sync-jobs/:jobId", (req, res, next) => {
  try {
    const jobId = parseId(req.params.jobId);
    const job = repo.getSyncJobById(jobId);
    if (!job) {
      throw new Error(`Sync job not found: ${jobId}`);
    }

    const logs = repo.listSyncJobLogs(jobId);
    res.json({
      job: {
        ...job,
        payload: parseJsonOrUndefined(job.payloadJson),
        summary: parseJsonOrUndefined(job.summaryJson),
      },
      logs,
    });
  } catch (error) {
    next(error);
  }
});

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = dirname(currentFilePath);
const publicDir = join(currentDir, "public");

if (WEB_ENABLE_UI && existsSync(publicDir)) {
  app.use(express.static(publicDir));

  app.use((req, res, next) => {
    if (req.method !== "GET") {
      next();
      return;
    }
    if (req.path.startsWith("/api/")) {
      next();
      return;
    }
    res.sendFile(join(publicDir, "index.html"));
  });
}

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : String(error);
  res.status(400).json({ error: message });
});

const server = app.listen(WEB_PORT, () => {
  // eslint-disable-next-line no-console
  console.log(
    `mobile-automator web listening on http://localhost:${WEB_PORT} (db: ${DB_PATH})`
  );
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => {
      repo.close();
      process.exit(0);
    });
  });
}
