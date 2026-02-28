import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { type StoreId } from "./storeRules.js";

export type AppRecord = {
  id: number;
  canonicalName: string;
  sourceLocale: string;
  androidPackageName?: string;
  ascAppId?: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateAppInput = {
  canonicalName: string;
  sourceLocale?: string;
  androidPackageName?: string;
  ascAppId?: string;
};

export type UpdateAppInput = Partial<CreateAppInput>;

export type LocaleRecord = {
  appId: number;
  store: StoreId;
  locale: string;
  enabled: boolean;
  priority: number;
};

export type NamingRecord = {
  appId: number;
  locale: string;
  appStoreName?: string;
  appStoreKeywords?: string;
  playStoreTitle?: string;
  iosBundleDisplayName?: string;
  updatedAt: string;
};

export type StoreLocaleDetailRecord = {
  appId: number;
  store: StoreId;
  locale: string;
  detailJson: string;
  syncedAt: string;
};

export type SyncJobRecord = {
  id: number;
  appId: number;
  storeScope: "app_store" | "play_store" | "both";
  status: "queued" | "running" | "succeeded" | "failed";
  payloadJson: string;
  summaryJson?: string;
  errorMessage?: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
};

export type CreateSyncJobInput = {
  appId: number;
  storeScope: "app_store" | "play_store" | "both";
  payload: unknown;
};

function nowIso(): string {
  return new Date().toISOString();
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["1", "true", "yes", "y"].includes(normalized);
  }
  return false;
}

function parseAppRow(row: Record<string, unknown>): AppRecord {
  return {
    id: Number(row.id),
    canonicalName: String(row.canonical_name),
    sourceLocale: String(row.source_locale),
    androidPackageName: toOptionalString(row.android_package_name),
    ascAppId: toOptionalString(row.asc_app_id),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function parseLocaleRow(row: Record<string, unknown>): LocaleRecord {
  return {
    appId: Number(row.app_id),
    store: String(row.store) as StoreId,
    locale: String(row.locale),
    enabled: toBoolean(row.enabled),
    priority: Number(row.priority ?? 0),
  };
}

function parseNamingRow(row: Record<string, unknown>): NamingRecord {
  return {
    appId: Number(row.app_id),
    locale: String(row.locale),
    appStoreName: toOptionalString(row.app_store_name),
    appStoreKeywords: toOptionalString(row.app_store_keywords),
    playStoreTitle: toOptionalString(row.play_store_title),
    iosBundleDisplayName: toOptionalString(row.ios_bundle_display_name),
    updatedAt: String(row.updated_at),
  };
}

function parseSyncJobRow(row: Record<string, unknown>): SyncJobRecord {
  return {
    id: Number(row.id),
    appId: Number(row.app_id),
    storeScope: String(row.store_scope) as SyncJobRecord["storeScope"],
    status: String(row.status) as SyncJobRecord["status"],
    payloadJson: String(row.payload_json),
    summaryJson: toOptionalString(row.summary_json),
    errorMessage: toOptionalString(row.error_message),
    createdAt: String(row.created_at),
    startedAt: toOptionalString(row.started_at),
    finishedAt: toOptionalString(row.finished_at),
  };
}

function parseStoreLocaleDetailRow(row: Record<string, unknown>): StoreLocaleDetailRecord {
  return {
    appId: Number(row.app_id),
    store: String(row.store) as StoreId,
    locale: String(row.locale),
    detailJson: String(row.detail_json ?? "{}"),
    syncedAt: String(row.synced_at),
  };
}

export class MobileAutomatorRepository {
  private db: Database.Database;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("foreign_keys = ON");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS apps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        canonical_name TEXT NOT NULL,
        source_locale TEXT NOT NULL DEFAULT 'en-US',
        ios_bundle_id TEXT,
        android_package_name TEXT,
        asc_app_id TEXT,
        asc_version_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS store_locales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        app_id INTEGER NOT NULL,
        store TEXT NOT NULL CHECK (store IN ('app_store', 'play_store')),
        locale TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        priority INTEGER NOT NULL DEFAULT 0,
        UNIQUE(app_id, store, locale),
        FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS naming_overrides (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        app_id INTEGER NOT NULL,
        locale TEXT NOT NULL,
        app_store_name TEXT,
        app_store_keywords TEXT,
        play_store_title TEXT,
        ios_bundle_display_name TEXT,
        updated_at TEXT NOT NULL,
        UNIQUE(app_id, locale),
        FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS sync_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        app_id INTEGER NOT NULL,
        store_scope TEXT NOT NULL CHECK (store_scope IN ('app_store', 'play_store', 'both')),
        status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
        payload_json TEXT NOT NULL,
        summary_json TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT,
        FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS sync_job_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id INTEGER NOT NULL,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (job_id) REFERENCES sync_jobs(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS store_locale_details (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        app_id INTEGER NOT NULL,
        store TEXT NOT NULL CHECK (store IN ('app_store', 'play_store')),
        locale TEXT NOT NULL,
        detail_json TEXT NOT NULL,
        synced_at TEXT NOT NULL,
        UNIQUE(app_id, store, locale),
        FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_store_locales_app_store ON store_locales(app_id, store);
      CREATE INDEX IF NOT EXISTS idx_store_locale_details_app_store ON store_locale_details(app_id, store);
      CREATE INDEX IF NOT EXISTS idx_naming_overrides_app ON naming_overrides(app_id);
      CREATE INDEX IF NOT EXISTS idx_sync_jobs_app ON sync_jobs(app_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_sync_job_logs_job ON sync_job_logs(job_id, created_at ASC);
    `);

    this.ensureColumn(
      "naming_overrides",
      "app_store_keywords",
      "ALTER TABLE naming_overrides ADD COLUMN app_store_keywords TEXT"
    );
  }

  private ensureColumn(tableName: string, columnName: string, addSql: string): void {
    const rows = this.db
      .prepare(`PRAGMA table_info(${tableName})`)
      .all() as Array<{ name?: string }>;
    const exists = rows.some((row) => row.name === columnName);
    if (!exists) {
      this.db.exec(addSql);
    }
  }

  close(): void {
    this.db.close();
  }

  listApps(): AppRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM apps ORDER BY updated_at DESC, id DESC")
      .all() as Array<Record<string, unknown>>;
    return rows.map(parseAppRow);
  }

  getAppById(id: number): AppRecord | undefined {
    const row = this.db
      .prepare("SELECT * FROM apps WHERE id = ?")
      .get(id) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return parseAppRow(row);
  }

  createApp(input: CreateAppInput): AppRecord {
    const now = nowIso();
    const stmt = this.db.prepare(`
      INSERT INTO apps (
        canonical_name,
        source_locale,
        android_package_name,
        asc_app_id,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      input.canonicalName,
      input.sourceLocale?.trim() || "en-US",
      toOptionalString(input.androidPackageName),
      toOptionalString(input.ascAppId),
      now,
      now
    );

    const app = this.getAppById(Number(result.lastInsertRowid));
    if (!app) throw new Error("Failed to load created app.");
    return app;
  }

  updateApp(id: number, input: UpdateAppInput): AppRecord {
    const existing = this.getAppById(id);
    if (!existing) {
      throw new Error(`App not found: ${id}`);
    }

    const next: AppRecord = {
      ...existing,
      canonicalName: input.canonicalName?.trim() || existing.canonicalName,
      sourceLocale: input.sourceLocale?.trim() || existing.sourceLocale,
      androidPackageName:
        input.androidPackageName !== undefined
          ? toOptionalString(input.androidPackageName)
          : existing.androidPackageName,
      ascAppId: input.ascAppId !== undefined ? toOptionalString(input.ascAppId) : existing.ascAppId,
      createdAt: existing.createdAt,
      updatedAt: nowIso(),
    };

    this.db
      .prepare(`
        UPDATE apps
        SET canonical_name = ?,
            source_locale = ?,
            android_package_name = ?,
            asc_app_id = ?,
            updated_at = ?
        WHERE id = ?
      `)
      .run(
        next.canonicalName,
        next.sourceLocale,
        toOptionalString(next.androidPackageName),
        toOptionalString(next.ascAppId),
        next.updatedAt,
        id
      );

    return this.getAppById(id)!;
  }

  deleteApp(id: number): void {
    this.db.prepare("DELETE FROM apps WHERE id = ?").run(id);
  }

  listStoreLocales(appId: number): LocaleRecord[] {
    const rows = this.db
      .prepare(
        `SELECT app_id, store, locale, enabled, priority
         FROM store_locales
         WHERE app_id = ?
         ORDER BY store ASC, priority DESC, locale ASC`
      )
      .all(appId) as Array<Record<string, unknown>>;
    return rows.map(parseLocaleRow);
  }

  replaceStoreLocales(appId: number, store: StoreId, locales: string[]): LocaleRecord[] {
    const normalized = Array.from(
      new Set(
        locales
          .map((locale) => locale.trim())
          .filter((locale) => locale.length > 0)
      )
    );

    const tx = this.db.transaction(() => {
      this.db
        .prepare("DELETE FROM store_locales WHERE app_id = ? AND store = ?")
        .run(appId, store);

      const insertStmt = this.db.prepare(
        `INSERT INTO store_locales (app_id, store, locale, enabled, priority)
         VALUES (?, ?, ?, 1, ?)`
      );

      let priority = normalized.length;
      for (const locale of normalized) {
        insertStmt.run(appId, store, locale, priority);
        priority -= 1;
      }

      this.db
        .prepare("UPDATE apps SET updated_at = ? WHERE id = ?")
        .run(nowIso(), appId);
    });

    tx();
    return this.listStoreLocales(appId);
  }

  listStoreLocaleDetails(appId: number, store?: StoreId): StoreLocaleDetailRecord[] {
    const rows = store
      ? (this.db
          .prepare(
            `SELECT app_id, store, locale, detail_json, synced_at
             FROM store_locale_details
             WHERE app_id = ? AND store = ?
             ORDER BY store ASC, locale ASC`
          )
          .all(appId, store) as Array<Record<string, unknown>>)
      : (this.db
          .prepare(
            `SELECT app_id, store, locale, detail_json, synced_at
             FROM store_locale_details
             WHERE app_id = ?
             ORDER BY store ASC, locale ASC`
          )
          .all(appId) as Array<Record<string, unknown>>);

    return rows.map(parseStoreLocaleDetailRow);
  }

  getStoreLocaleDetail(
    appId: number,
    store: StoreId,
    locale: string
  ): StoreLocaleDetailRecord | undefined {
    const row = this.db
      .prepare(
        `SELECT app_id, store, locale, detail_json, synced_at
         FROM store_locale_details
         WHERE app_id = ? AND store = ? AND locale = ?`
      )
      .get(appId, store, locale) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return parseStoreLocaleDetailRow(row);
  }

  replaceStoreLocaleDetails(
    appId: number,
    store: StoreId,
    entries: Array<{
      locale: string;
      detail: unknown;
      syncedAt?: string;
    }>
  ): StoreLocaleDetailRecord[] {
    const dedup = new Map<
      string,
      {
        detailJson: string;
        syncedAt: string;
      }
    >();

    for (const entry of entries) {
      const locale = entry.locale.trim();
      if (!locale) continue;
      dedup.set(locale, {
        detailJson: JSON.stringify(entry.detail ?? {}),
        syncedAt: entry.syncedAt ?? nowIso(),
      });
    }

    const tx = this.db.transaction(() => {
      this.db
        .prepare("DELETE FROM store_locale_details WHERE app_id = ? AND store = ?")
        .run(appId, store);

      const insertStmt = this.db.prepare(
        `INSERT INTO store_locale_details (app_id, store, locale, detail_json, synced_at)
         VALUES (?, ?, ?, ?, ?)`
      );

      for (const [locale, value] of dedup.entries()) {
        insertStmt.run(appId, store, locale, value.detailJson, value.syncedAt);
      }

      this.db
        .prepare("UPDATE apps SET updated_at = ? WHERE id = ?")
        .run(nowIso(), appId);
    });

    tx();
    return this.listStoreLocaleDetails(appId, store);
  }

  listNamingOverrides(appId: number): NamingRecord[] {
    const rows = this.db
      .prepare(
        `SELECT app_id, locale, app_store_name, app_store_keywords, play_store_title, ios_bundle_display_name, updated_at
         FROM naming_overrides
         WHERE app_id = ?
         ORDER BY locale ASC`
      )
      .all(appId) as Array<Record<string, unknown>>;
    return rows.map(parseNamingRow);
  }

  replaceNamingOverrides(
    appId: number,
    entries: Array<{
      locale: string;
      appStoreName?: string;
      appStoreKeywords?: string;
      playStoreTitle?: string;
      iosBundleDisplayName?: string;
    }>
  ): NamingRecord[] {
    const normalized = entries
      .map((entry) => ({
        locale: entry.locale.trim(),
        appStoreName: toOptionalString(entry.appStoreName),
        appStoreKeywords: toOptionalString(entry.appStoreKeywords),
        playStoreTitle: toOptionalString(entry.playStoreTitle),
        iosBundleDisplayName: toOptionalString(entry.iosBundleDisplayName),
      }))
      .filter((entry) => entry.locale.length > 0);

    const tx = this.db.transaction(() => {
      this.db
        .prepare("DELETE FROM naming_overrides WHERE app_id = ?")
        .run(appId);

      const insertStmt = this.db.prepare(`
        INSERT INTO naming_overrides (
          app_id,
          locale,
          app_store_name,
          app_store_keywords,
          play_store_title,
          ios_bundle_display_name,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const now = nowIso();
      for (const entry of normalized) {
        insertStmt.run(
          appId,
          entry.locale,
          entry.appStoreName,
          entry.appStoreKeywords,
          entry.playStoreTitle,
          entry.iosBundleDisplayName,
          now
        );
      }

      this.db
        .prepare("UPDATE apps SET updated_at = ? WHERE id = ?")
        .run(now, appId);
    });

    tx();
    return this.listNamingOverrides(appId);
  }

  createSyncJob(input: CreateSyncJobInput): SyncJobRecord {
    const now = nowIso();
    const payloadJson = JSON.stringify(input.payload ?? {});
    const result = this.db
      .prepare(
        `INSERT INTO sync_jobs (
          app_id,
          store_scope,
          status,
          payload_json,
          created_at
        ) VALUES (?, ?, 'queued', ?, ?)`
      )
      .run(input.appId, input.storeScope, payloadJson, now);

    return this.getSyncJobById(Number(result.lastInsertRowid))!;
  }

  getSyncJobById(jobId: number): SyncJobRecord | undefined {
    const row = this.db
      .prepare("SELECT * FROM sync_jobs WHERE id = ?")
      .get(jobId) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return parseSyncJobRow(row);
  }

  listSyncJobsForApp(appId: number): SyncJobRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM sync_jobs WHERE app_id = ? ORDER BY id DESC")
      .all(appId) as Array<Record<string, unknown>>;
    return rows.map(parseSyncJobRow);
  }

  markSyncJobRunning(jobId: number): void {
    this.db
      .prepare(
        `UPDATE sync_jobs
         SET status = 'running', started_at = ?
         WHERE id = ?`
      )
      .run(nowIso(), jobId);
  }

  markSyncJobSuccess(jobId: number, summary: unknown): void {
    this.db
      .prepare(
        `UPDATE sync_jobs
         SET status = 'succeeded',
             summary_json = ?,
             finished_at = ?,
             error_message = NULL
         WHERE id = ?`
      )
      .run(JSON.stringify(summary ?? {}), nowIso(), jobId);
  }

  markSyncJobFailure(jobId: number, errorMessage: string): void {
    this.db
      .prepare(
        `UPDATE sync_jobs
         SET status = 'failed',
             error_message = ?,
             finished_at = ?
         WHERE id = ?`
      )
      .run(errorMessage, nowIso(), jobId);
  }

  appendSyncJobLog(jobId: number, level: "info" | "warn" | "error", message: string): void {
    this.db
      .prepare(
        `INSERT INTO sync_job_logs (job_id, level, message, created_at)
         VALUES (?, ?, ?, ?)`
      )
      .run(jobId, level, message, nowIso());
  }

  listSyncJobLogs(jobId: number): Array<{
    id: number;
    level: string;
    message: string;
    createdAt: string;
  }> {
    const rows = this.db
      .prepare(
        `SELECT id, level, message, created_at
         FROM sync_job_logs
         WHERE job_id = ?
         ORDER BY id ASC`
      )
      .all(jobId) as Array<Record<string, unknown>>;

    return rows.map((row) => ({
      id: Number(row.id),
      level: String(row.level),
      message: String(row.message),
      createdAt: String(row.created_at),
    }));
  }
}
