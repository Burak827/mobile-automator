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
  iosToPlayLocale,
  LOCALE_CATALOG,
  playToIosLocale,
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

// ---------------------------------------------------------------------------
// Locale apply — add/remove locales on ASC & GPC
// ---------------------------------------------------------------------------

type LocaleChangeInput = {
  store: StoreId;
  locale: string;
  action: "add" | "remove" | "update";
  fields?: Record<string, string>;
};

function parseLocaleChanges(raw: unknown[]): LocaleChangeInput[] {
  const result: LocaleChangeInput[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const store =
      row.store === "app_store" || row.store === "play_store"
        ? (row.store as StoreId)
        : null;
    const locale = typeof row.locale === "string" ? row.locale.trim() : "";
    const action =
      row.action === "add" || row.action === "remove" || row.action === "update"
        ? (row.action as "add" | "remove" | "update")
        : null;
    if (!store || !locale || !action) continue;

    let fields: Record<string, string> | undefined;
    if ((action === "add" || action === "update") && row.fields && typeof row.fields === "object") {
      fields = {};
      for (const [key, val] of Object.entries(row.fields as Record<string, unknown>)) {
        if (typeof val === "string") fields[key] = val;
      }
    }

    result.push({ store, locale, action, fields });
  }
  return result;
}

function applyLocaleChangesToList(
  current: string[],
  changes: LocaleChangeInput[]
): string[] {
  const set = new Set(current);
  for (const change of changes) {
    if (change.action === "add") set.add(change.locale);
    else if (change.action === "remove") set.delete(change.locale);
    // "update" doesn't change the locale list
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

// ---------------------------------------------------------------------------
// Prepare iOS → Play Store diff (returns changes to queue, does NOT apply)
// ---------------------------------------------------------------------------

app.get("/api/apps/:id/prepare-ios-to-play", (req, res, next) => {
  try {
    const appId = parseId(req.params.id);
    mustGetApp(appId);

    const iosDetails = repo.listStoreLocaleDetails(appId, "app_store");
    if (iosDetails.length === 0) {
      res.status(400).json({ error: "iOS locale detayları bulunamadı. Önce eşzamanlayın." });
      return;
    }

    // Build Play Store detail lookup
    const playDetails = repo.listStoreLocaleDetails(appId, "play_store");
    const playDetailByLocale = new Map<string, Record<string, unknown>>();
    for (const pd of playDetails) {
      try {
        playDetailByLocale.set(pd.locale, JSON.parse(pd.detailJson) as Record<string, unknown>);
      } catch { /* skip */ }
    }

    const playLocaleSet = new Set(
      repo.listStoreLocales(appId)
        .filter((r) => r.store === "play_store")
        .map((r) => r.locale)
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
        skipped.push({ iosLocale: row.locale, reason: "detail JSON parse hatası" });
        continue;
      }

      const appInfo = detail.appInfo as { name?: string; subtitle?: string } | undefined;
      const versionLoc = detail.versionLocalization as { description?: string } | undefined;

      const iosTitle = appInfo?.name ?? "";
      const iosShortDesc = appInfo?.subtitle ?? "";
      const iosFullDesc = versionLoc?.description ?? "";

      if (!iosTitle) {
        skipped.push({ iosLocale: row.locale, reason: "appName (title) boş" });
        continue;
      }

      const isNewLocale = !playLocaleSet.has(playLocale);

      // Get current Play Store values for comparison
      let playTitle = "";
      let playShortDesc = "";
      let playFullDesc = "";

      if (!isNewLocale) {
        const playDetail = playDetailByLocale.get(playLocale);
        if (playDetail) {
          const listing = playDetail.listing as {
            title?: string;
            shortDescription?: string;
            fullDescription?: string;
          } | undefined;
          playTitle = listing?.title ?? "";
          playShortDesc = listing?.shortDescription ?? "";
          playFullDesc = listing?.fullDescription ?? "";
        }
      }

      // Compute field diffs (trim trailing whitespace — GPC strips trailing newlines)
      const norm = (s: string) => s.replace(/\s+$/, "");
      const fields: FieldDiff[] = [];
      if (norm(iosTitle) !== norm(playTitle)) {
        fields.push({ field: "title", newValue: iosTitle, oldValue: playTitle });
      }
      if (norm(iosShortDesc) !== norm(playShortDesc)) {
        fields.push({ field: "shortDescription", newValue: iosShortDesc, oldValue: playShortDesc });
      }
      if (norm(iosFullDesc) !== norm(playFullDesc)) {
        fields.push({ field: "fullDescription", newValue: iosFullDesc, oldValue: playFullDesc });
      }

      // Only include if there are actual differences
      if (fields.length > 0 || isNewLocale) {
        entries.push({ iosLocale: row.locale, playLocale, isNewLocale, fields });
      }
    }

    res.json({ appId, entries, skipped });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Prepare Play Store → iOS diff (returns changes to queue, does NOT apply)
// ---------------------------------------------------------------------------

app.get("/api/apps/:id/prepare-play-to-ios", (req, res, next) => {
  try {
    const appId = parseId(req.params.id);
    mustGetApp(appId);

    const playDetails = repo.listStoreLocaleDetails(appId, "play_store");
    if (playDetails.length === 0) {
      res.status(400).json({ error: "Play Store locale detayları bulunamadı. Önce eşzamanlayın." });
      return;
    }

    // Build iOS detail lookup
    const iosDetails = repo.listStoreLocaleDetails(appId, "app_store");
    const iosDetailByLocale = new Map<string, Record<string, unknown>>();
    for (const d of iosDetails) {
      try {
        iosDetailByLocale.set(d.locale, JSON.parse(d.detailJson) as Record<string, unknown>);
      } catch { /* skip */ }
    }

    const iosLocaleSet = new Set(
      repo.listStoreLocales(appId)
        .filter((r) => r.store === "app_store")
        .map((r) => r.locale)
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
        skipped.push({ playLocale: row.locale, reason: "detail JSON parse hatası" });
        continue;
      }

      const listing = detail.listing as {
        title?: string;
        shortDescription?: string;
        fullDescription?: string;
      } | undefined;

      const playTitle = listing?.title ?? "";
      const playShortDesc = listing?.shortDescription ?? "";
      const playFullDesc = listing?.fullDescription ?? "";

      if (!playTitle) {
        skipped.push({ playLocale: row.locale, reason: "title (appName) boş" });
        continue;
      }

      const isNewLocale = !iosLocaleSet.has(iosLocale);

      // Get current iOS values for comparison
      let iosAppName = "";
      let iosSubtitle = "";
      let iosDescription = "";

      if (!isNewLocale) {
        const iosDetail = iosDetailByLocale.get(iosLocale);
        if (iosDetail) {
          const appInfo = iosDetail.appInfo as { name?: string; subtitle?: string } | undefined;
          const versionLoc = iosDetail.versionLocalization as { description?: string } | undefined;
          iosAppName = appInfo?.name ?? "";
          iosSubtitle = appInfo?.subtitle ?? "";
          iosDescription = versionLoc?.description ?? "";
        }
      }

      // Compute field diffs (trim trailing whitespace — stores may strip them)
      const norm = (s: string) => s.replace(/\s+$/, "");
      const fields: FieldDiff[] = [];

      // Play title → iOS appName
      if (norm(playTitle) !== norm(iosAppName)) {
        fields.push({ field: "appName", newValue: playTitle, oldValue: iosAppName });
      }
      // Play shortDescription → iOS subtitle (shortDesc max 80, subtitle max 30 — may truncate)
      if (norm(playShortDesc) !== norm(iosSubtitle)) {
        const truncated = playShortDesc.length > 30 ? playShortDesc.slice(0, 30) : playShortDesc;
        fields.push({ field: "subtitle", newValue: truncated, oldValue: iosSubtitle });
      }
      // Play fullDescription → iOS description
      if (norm(playFullDesc) !== norm(iosDescription)) {
        fields.push({ field: "description", newValue: playFullDesc, oldValue: iosDescription });
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

app.post("/api/apps/:id/locales/apply", async (req, res, next) => {
  try {
    const appId = parseId(req.params.id);
    const appRow = mustGetApp(appId);
    const body = (req.body ?? {}) as Record<string, unknown>;

    const localeChanges = parseLocaleChanges(
      Array.isArray(body.changes) ? body.changes : []
    );

    if (localeChanges.length === 0) {
      res.status(400).json({ error: "No valid locale changes provided." });
      return;
    }

    const ascChanges = localeChanges.filter((c) => c.store === "app_store");
    const gpcChanges = localeChanges.filter((c) => c.store === "play_store");

    const succeeded: LocaleChangeInput[] = [];
    const failed: Array<LocaleChangeInput & { error: string }> = [];

    // ASC — each locale independently, in parallel
    if (ascChanges.length > 0) {
      const results = await Promise.allSettled(
        ascChanges.map(async (change) => {
          if (change.action === "add") {
            await storeApi.addAscLocale(appRow, change.locale, change.fields);
          } else if (change.action === "update") {
            await storeApi.updateAscLocaleFields(appRow, change.locale, change.fields ?? {});
          } else {
            await storeApi.deleteAscLocale(appRow, change.locale);
          }
        })
      );
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const change = ascChanges[i];
        if (result.status === "fulfilled") {
          succeeded.push(change);
        } else {
          failed.push({
            ...change,
            error:
              result.reason instanceof Error
                ? result.reason.message
                : String(result.reason),
          });
        }
      }
    }

    // GPC — all in one edit batch
    if (gpcChanges.length > 0) {
      const gpcAdds = gpcChanges
        .filter((c) => c.action === "add" || c.action === "update")
        .map((c) => ({ locale: c.locale, fields: c.fields ?? {} }));
      const gpcRemoves = gpcChanges
        .filter((c) => c.action === "remove")
        .map((c) => c.locale);
      try {
        if (gpcAdds.length > 0 || gpcRemoves.length > 0) {
          await storeApi.applyPlayStoreLocaleChanges(appRow, gpcAdds, gpcRemoves);
        }
        succeeded.push(...gpcChanges);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        for (const change of gpcChanges) {
          failed.push({ ...change, error: message });
        }
      }
    }

    // Update DB for succeeded changes
    if (succeeded.length > 0) {
      const ascSucceeded = succeeded.filter((c) => c.store === "app_store");
      const gpcSucceeded = succeeded.filter((c) => c.store === "play_store");

      if (ascSucceeded.length > 0) {
        const current = repo
          .listStoreLocales(appId)
          .filter((r) => r.store === "app_store")
          .map((r) => r.locale);
        const next = applyLocaleChangesToList(current, ascSucceeded);
        repo.replaceStoreLocales(appId, "app_store", next);
      }

      if (gpcSucceeded.length > 0) {
        const current = repo
          .listStoreLocales(appId)
          .filter((r) => r.store === "play_store")
          .map((r) => r.locale);
        const next = applyLocaleChangesToList(current, gpcSucceeded);
        repo.replaceStoreLocales(appId, "play_store", next);
      }
    }

    // Build response
    const rows = repo.listStoreLocales(appId);
    const appStoreLocales = rows
      .filter((r) => r.store === "app_store")
      .map((r) => r.locale);
    const playStoreLocales = rows
      .filter((r) => r.store === "play_store")
      .map((r) => r.locale);

    res.json({
      appId,
      succeeded,
      failed,
      appStoreLocales,
      playStoreLocales,
      completedAt: new Date().toISOString(),
    });
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
