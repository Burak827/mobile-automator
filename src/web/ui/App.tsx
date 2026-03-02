import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import Button from './components/atoms/Button';
import AppDetailsPanel from './components/organisms/AppDetailsPanel';
import AppListSidebar from './components/organisms/AppListSidebar';
import ChangeQueueDrawer from './components/organisms/ChangeQueueDrawer';
import CreateAppDialog from './components/organisms/CreateAppDialog';
import GenerateTranslationsDialog from './components/organisms/GenerateTranslationsDialog';
import HeaderBar from './components/organisms/HeaderBar';
import RulesDialog from './components/organisms/RulesDialog';
import StoreLocalePanels from './components/organisms/StoreLocalePanels';
import { api, formatOutput } from './lib/api';
import type {
  AppConfigField,
  AppConfigForm,
  AppListItem,
  AppRecord,
  AppStoreLocaleDetail,
  LocaleCatalogEntry,
  MetaPayload,
  PendingStoreChange,
  PendingStoreChangeMap,
  PendingStoreFieldChange,
  PendingStoreLocaleChange,
  PendingValueMap,
  PlayStoreLocaleDetail,
  StoreId,
  StoreLocaleDetailPayload,
  StoreLocalesPayload,
  StoreRuleSet,
  SyncResponse,
} from './types';

const EMPTY_CREATE_FORM: AppConfigForm = {
  canonicalName: '',
  sourceLocale: 'en-US',
  ascAppId: '',
  androidPackageName: '',
};

const EMPTY_APP_CONFIG: AppConfigForm = {
  canonicalName: '',
  sourceLocale: 'en-US',
  ascAppId: '',
  androidPackageName: '',
};

const CONFIG_KEYS: AppConfigField[] = [
  'canonicalName',
  'sourceLocale',
  'ascAppId',
  'androidPackageName',
];

type AppsResponse = {
  apps?: AppListItem[];
};

type AppResponse = {
  app: AppRecord;
};

type AppleCfBundleListResponse = {
  appId: number;
  sourceLocale: string;
  generatedAt: string;
  localeCount: number;
  unsupportedInCatalog: string[];
  locales: Record<
    string,
    {
      app_name: string;
      CFBundleDisplayName: string;
      CFBundleName: string;
    }
  >;
};

function normalizeLocaleCatalog(rows: unknown): LocaleCatalogEntry[] {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row): LocaleCatalogEntry | null => {
      if (typeof row === 'string') {
        return {
          locale: row,
          iosSupported: true,
          androidSupported: true,
        };
      }

      if (typeof row !== 'object' || row === null) return null;
      const item = row as Partial<LocaleCatalogEntry>;
      const locale = typeof item.locale === 'string' ? item.locale.trim() : '';
      if (!locale) return null;

      return {
        locale,
        iosSupported: Boolean(item.iosSupported),
        androidSupported: Boolean(item.androidSupported),
      };
    })
    .filter((row): row is LocaleCatalogEntry => Boolean(row));
}

function toUpdatePayload(form: AppConfigForm): AppConfigForm {
  return {
    canonicalName: form.canonicalName.trim(),
    sourceLocale: form.sourceLocale.trim(),
    ascAppId: form.ascAppId.trim(),
    androidPackageName: form.androidPackageName.trim(),
  };
}

function normalizeConfigForCompare(
  config: Partial<AppConfigForm> | AppRecord | null | undefined
): AppConfigForm {
  return {
    canonicalName: (config?.canonicalName || '').trim(),
    sourceLocale: (config?.sourceLocale || '').trim(),
    ascAppId: (config?.ascAppId || '').trim(),
    androidPackageName: (config?.androidPackageName || '').trim(),
  };
}

function toSortedUniqueLocaleList(locales?: string[]): string[] {
  return Array.from(
    new Set(
      (locales || [])
        .map((locale) => (typeof locale === 'string' ? locale.trim() : ''))
        .filter((locale) => locale.length > 0)
    )
  ).sort((a, b) => a.localeCompare(b));
}

function pickDefaultLocale(sourceLocale: string, localeList: string[]): string {
  const normalizedSource = (sourceLocale || '').trim();
  if (normalizedSource && localeList.includes(normalizedSource)) {
    return normalizedSource;
  }
  return localeList[0] || normalizedSource;
}

function toStoreChangeKey(store: StoreId, locale: string, field: string): string {
  return `${store}::${locale}::${field}`;
}

function toStoreLocaleChangeKey(store: StoreId, locale: string): string {
  return `${store}::${locale}::__locale__`;
}

function applyPendingLocaleChanges(
  baseLocales: string[],
  pendingChanges: PendingStoreChangeMap,
  store: StoreId
): string[] {
  const next = new Set(toSortedUniqueLocaleList(baseLocales));

  for (const change of Object.values(pendingChanges)) {
    if (change.kind !== 'locale' || change.store !== store) continue;
    if (change.action === 'add') {
      next.add(change.locale);
      continue;
    }
    next.delete(change.locale);
  }

  return Array.from(next).sort((a, b) => a.localeCompare(b));
}

function asAppStoreDetail(detail: unknown): AppStoreLocaleDetail | null {
  if (!detail || typeof detail !== 'object') return null;
  const store = (detail as { store?: unknown }).store;
  return store === 'app_store' ? (detail as AppStoreLocaleDetail) : null;
}

function asPlayStoreDetail(detail: unknown): PlayStoreLocaleDetail | null {
  if (!detail || typeof detail !== 'object') return null;
  const store = (detail as { store?: unknown }).store;
  return store === 'play_store' ? (detail as PlayStoreLocaleDetail) : null;
}

type StoreDiffField = { field: string; newValue: string; oldValue: string };

type StoreDiffEntry = {
  sourceLocale: string;
  targetLocale: string;
  targetStore: StoreId;
  isNewLocale: boolean;
  fields: StoreDiffField[];
};

type StoreDiffResponse = {
  entries: StoreDiffEntry[];
  skipped: Array<{ locale: string; reason: string }>;
};

// Raw server response types (server uses iosLocale/playLocale naming)
type RawIosToPlayResponse = {
  entries: Array<{ iosLocale: string; playLocale: string; isNewLocale: boolean; fields: StoreDiffField[] }>;
  skipped: Array<{ iosLocale: string; reason: string }>;
};

type RawPlayToIosResponse = {
  entries: Array<{ playLocale: string; iosLocale: string; isNewLocale: boolean; fields: StoreDiffField[] }>;
  skipped: Array<{ playLocale: string; reason: string }>;
};

function normalizeIosToPlayDiff(raw: RawIosToPlayResponse): StoreDiffResponse {
  return {
    entries: raw.entries.map((e) => ({
      sourceLocale: e.iosLocale,
      targetLocale: e.playLocale,
      targetStore: 'play_store' as StoreId,
      isNewLocale: e.isNewLocale,
      fields: e.fields,
    })),
    skipped: raw.skipped.map((s) => ({ locale: s.iosLocale, reason: s.reason })),
  };
}

function normalizePlayToIosDiff(raw: RawPlayToIosResponse): StoreDiffResponse {
  return {
    entries: raw.entries.map((e) => ({
      sourceLocale: e.playLocale,
      targetLocale: e.iosLocale,
      targetStore: 'app_store' as StoreId,
      isNewLocale: e.isNewLocale,
      fields: e.fields,
    })),
    skipped: raw.skipped.map((s) => ({ locale: s.playLocale, reason: s.reason })),
  };
}

export default function App() {
  const [meta, setMeta] = useState<MetaPayload | null>(null);
  const [apps, setApps] = useState<AppListItem[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<number | null>(null);
  const [selectedApp, setSelectedApp] = useState<AppRecord | null>(null);
  const selectedAppIdRef = useRef<number | null>(null);
  const populateQueueFromDiffRef = useRef<(result: StoreDiffResponse, options?: { silent?: boolean }) => void>(() => {});

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [generateModalStore, setGenerateModalStore] = useState<StoreId | null>(null);

  const [createForm, setCreateForm] = useState<AppConfigForm>(EMPTY_CREATE_FORM);
  const [appConfig, setAppConfig] = useState<AppConfigForm>(EMPTY_APP_CONFIG);

  const [localeCatalog, setLocaleCatalog] = useState<LocaleCatalogEntry[]>([]);
  const [statusLogs, setStatusLogs] = useState<string[]>([]);
  const [isApplyingConfig, setIsApplyingConfig] = useState(false);

  const [iosLocales, setIosLocales] = useState<string[]>([]);
  const [playLocales, setPlayLocales] = useState<string[]>([]);
  const [iosSelectedLocale, setIosSelectedLocale] = useState('');
  const [playSelectedLocale, setPlaySelectedLocale] = useState('');
  const [iosDetail, setIosDetail] = useState<AppStoreLocaleDetail | null>(null);
  const [playDetail, setPlayDetail] = useState<PlayStoreLocaleDetail | null>(null);
  const [isIosLoading, setIsIosLoading] = useState(false);
  const [isPlayLoading, setIsPlayLoading] = useState(false);
  const [isConsoleExpanded, setIsConsoleExpanded] = useState(false);
  const [isChangeDrawerOpen, setIsChangeDrawerOpen] = useState(false);
  const [pendingStoreChanges, setPendingStoreChanges] = useState<PendingStoreChangeMap>({});

  useEffect(() => {
    selectedAppIdRef.current = selectedAppId;
  }, [selectedAppId]);

  const pushStatus = useCallback((message: unknown) => {
    const now = new Date();
    const timestamp = now.toLocaleTimeString('tr-TR', { hour12: false });
    const text = formatOutput(message);
    setStatusLogs((prev) => [...prev, `[${timestamp}] ${text}`]);
  }, []);

  const clearSelectedDetail = useCallback(() => {
    setSelectedApp(null);
    setSelectedAppId(null);
    setAppConfig(EMPTY_APP_CONFIG);
    setIosLocales([]);
    setPlayLocales([]);
    setIosSelectedLocale('');
    setPlaySelectedLocale('');
    setIosDetail(null);
    setPlayDetail(null);
    setPendingStoreChanges({});
  }, []);

  const loadMeta = useCallback(async () => {
    const payload = await api<MetaPayload>('/api/meta');
    setMeta(payload);
    setLocaleCatalog(normalizeLocaleCatalog(payload?.localeCatalog));
  }, []);

  const loadIosLocaleDetail = useCallback(async (appId: number, locale: string) => {
    if (!locale) return null;
    const payload = await api<StoreLocaleDetailPayload>(
      `/api/apps/${appId}/locales/details/app_store/${encodeURIComponent(locale)}`
    );
    return asAppStoreDetail(payload?.detail);
  }, []);

  const loadPlayLocaleDetail = useCallback(async (appId: number, locale: string) => {
    if (!locale) return null;
    const payload = await api<StoreLocaleDetailPayload>(
      `/api/apps/${appId}/locales/details/play_store/${encodeURIComponent(locale)}`
    );
    return asPlayStoreDetail(payload?.detail);
  }, []);

  const loadStorePanels = useCallback(
    async (appId: number, sourceLocale: string) => {
      setIsIosLoading(true);
      setIsPlayLoading(true);

      try {
        const localesPayload = await api<StoreLocalesPayload>(`/api/apps/${appId}/locales`);
        const nextIosLocales = toSortedUniqueLocaleList(localesPayload?.appStoreLocales);
        const nextPlayLocales = toSortedUniqueLocaleList(localesPayload?.playStoreLocales);

        const nextIosSelectedLocale = pickDefaultLocale(sourceLocale, nextIosLocales);
        const nextPlaySelectedLocale = pickDefaultLocale(sourceLocale, nextPlayLocales);

        setIosLocales(nextIosLocales);
        setPlayLocales(nextPlayLocales);
        setIosSelectedLocale(nextIosSelectedLocale);
        setPlaySelectedLocale(nextPlaySelectedLocale);

        const [nextIosDetail, nextPlayDetail] = await Promise.all([
          nextIosLocales.includes(nextIosSelectedLocale)
            ? loadIosLocaleDetail(appId, nextIosSelectedLocale).catch(() => null)
            : Promise.resolve(null),
          nextPlayLocales.includes(nextPlaySelectedLocale)
            ? loadPlayLocaleDetail(appId, nextPlaySelectedLocale).catch(() => null)
            : Promise.resolve(null),
        ]);

        setIosDetail(nextIosDetail);
        setPlayDetail(nextPlayDetail);
      } catch (error) {
        setIosLocales([]);
        setPlayLocales([]);
        setIosSelectedLocale('');
        setPlaySelectedLocale('');
        setIosDetail(null);
        setPlayDetail(null);
        pushStatus(error instanceof Error ? error.message : String(error));
      } finally {
        setIsIosLoading(false);
        setIsPlayLoading(false);
      }
    },
    [loadIosLocaleDetail, loadPlayLocaleDetail, pushStatus]
  );

  const selectApp = useCallback(
    async (appId: number) => {
      const payload = await api<AppResponse>(`/api/apps/${appId}`);
      const app = payload.app;
      const previousSelectedId = selectedAppIdRef.current;

      setSelectedAppId(app.id);
      setSelectedApp(app);
      setAppConfig({
        canonicalName: app.canonicalName || '',
        sourceLocale: app.sourceLocale || 'en-US',
        ascAppId: app.ascAppId || '',
        androidPackageName: app.androidPackageName || '',
      });
      if (previousSelectedId !== app.id) {
        setPendingStoreChanges({});
      }

      await loadStorePanels(app.id, app.sourceLocale || 'en-US');
    },
    [loadStorePanels]
  );

  const loadApps = useCallback(
    async (selectId?: number) => {
      const payload = await api<AppsResponse>('/api/apps');
      const nextApps = Array.isArray(payload.apps) ? payload.apps : [];
      setApps(nextApps);

      if (typeof selectId === 'number') {
        await selectApp(selectId);
        return;
      }

      const currentSelectedId = selectedAppIdRef.current;
      if (currentSelectedId) {
        const stillExists = nextApps.some((item) => item.id === currentSelectedId);
        if (stillExists) {
          await selectApp(currentSelectedId);
          return;
        }
      }

      clearSelectedDetail();
    },
    [clearSelectedDetail, selectApp]
  );

  useEffect(() => {
    void (async () => {
      try {
        await Promise.all([loadMeta(), loadApps()]);
      } catch (error) {
        pushStatus(error instanceof Error ? error.message : String(error));
      }
    })();
  }, [loadApps, loadMeta, pushStatus]);

  const stores = useMemo<StoreRuleSet[]>(() => Object.values(meta?.storeRules ?? {}), [meta]);
  const pendingChangeEntries = useMemo<PendingStoreChange[]>(
    () =>
      Object.values(pendingStoreChanges).sort((a, b) => {
        if (a.store !== b.store) return a.store.localeCompare(b.store);
        if (a.locale !== b.locale) return a.locale.localeCompare(b.locale);
        const aField = a.kind === 'field' ? a.field : '__locale__';
        const bField = b.kind === 'field' ? b.field : '__locale__';
        return aField.localeCompare(bField);
      }),
    [pendingStoreChanges]
  );
  const pendingValueMap = useMemo<PendingValueMap>(() => {
    const map: PendingValueMap = {};
    for (const entry of pendingChangeEntries) {
      if (entry.kind !== 'field') continue;
      map[entry.key] = entry.newValue;
    }
    return map;
  }, [pendingChangeEntries]);
  const effectiveIosLocales = useMemo(
    () => applyPendingLocaleChanges(iosLocales, pendingStoreChanges, 'app_store'),
    [iosLocales, pendingStoreChanges]
  );
  const effectivePlayLocales = useMemo(
    () => applyPendingLocaleChanges(playLocales, pendingStoreChanges, 'play_store'),
    [pendingStoreChanges, playLocales]
  );
  const latestStatusLine = useMemo(
    () =>
      statusLogs.length > 0
        ? statusLogs[statusLogs.length - 1]
        : '[Sistem] Güncelleme ve olay logları burada görünecek.',
    [statusLogs]
  );

  const localeOptions = useMemo<LocaleCatalogEntry[]>(() => {
    const fallback: LocaleCatalogEntry[] = [
      { locale: 'en-US', iosSupported: true, androidSupported: true },
    ];
    const base = localeCatalog.length > 0 ? [...localeCatalog] : fallback;
    const known = new Set(base.map((entry) => entry.locale));

    for (const extra of [createForm.sourceLocale, appConfig.sourceLocale]) {
      if (typeof extra !== 'string') continue;
      const locale = extra.trim();
      if (!locale || known.has(locale)) continue;
      base.push({ locale, iosSupported: true, androidSupported: true });
      known.add(locale);
    }

    return base;
  }, [appConfig.sourceLocale, createForm.sourceLocale, localeCatalog]);

  const generateMissingLocales = useMemo(() => {
    if (!generateModalStore) return [];
    const supported = localeCatalog
      .filter((e) =>
        generateModalStore === 'app_store' ? e.iosSupported : e.androidSupported
      )
      .map((e) => e.locale);
    const existing = new Set(
      generateModalStore === 'app_store' ? iosLocales : playLocales
    );
    const source = selectedApp?.sourceLocale || 'en-US';
    return supported.filter((l) => l !== source && !existing.has(l)).sort();
  }, [generateModalStore, localeCatalog, iosLocales, playLocales, selectedApp]);

  const hasConfigChanges = useMemo(() => {
    if (!selectedApp) return false;
    const baseline = normalizeConfigForCompare(selectedApp);
    const current = normalizeConfigForCompare(appConfig);
    return CONFIG_KEYS.some((key) => current[key] !== baseline[key]);
  }, [appConfig, selectedApp]);

  const showIosPanel = useMemo(
    () => Boolean((selectedApp?.ascAppId || '').trim()),
    [selectedApp]
  );
  const showPlayPanel = useMemo(
    () => Boolean((selectedApp?.androidPackageName || '').trim()),
    [selectedApp]
  );

  const handleReloadMeta = useCallback(async () => {
    try {
      await loadMeta();
      pushStatus('Kural metadata yenilendi.');
    } catch (error) {
      pushStatus(error instanceof Error ? error.message : String(error));
    }
  }, [loadMeta, pushStatus]);

  const handleRefreshApps = useCallback(async () => {
    try {
      await loadApps();
      pushStatus('Uygulama listesi yenilendi.');
    } catch (error) {
      pushStatus(error instanceof Error ? error.message : String(error));
    }
  }, [loadApps, pushStatus]);

  /**
   * Shared sync + refresh routine used by both the config/sync form
   * and the locale-change apply flow.
   *
   * 1. Calls POST /api/apps/:id/locales/sync with the given storeScope
   * 2. Refreshes sidebar counts and store panels via loadApps
   * 3. Returns the sync errors array (empty on full success)
   *
   * The caller is responsible for setting/clearing isApplyingConfig.
   */
  const syncAndRefresh = useCallback(
    async (
      appId: number,
      storeScope: 'both' | 'app_store' | 'play_store',
      options?: { skipDiff?: boolean }
    ): Promise<string[]> => {
      const scopeLabel =
        storeScope === 'both'
          ? 'Her iki store'
          : storeScope === 'app_store'
            ? 'App Store'
            : 'Play Store';
      pushStatus(`${scopeLabel} eşzamanlanıyor...`);

      let syncErrors: string[] = [];
      try {
        const syncResult = await api<SyncResponse>(
          `/api/apps/${appId}/locales/sync`,
          { method: 'POST', body: JSON.stringify({ storeScope }) }
        );
        syncErrors = (syncResult?.errors ?? []).map(
          (e: { store?: string; message?: string }) =>
            `[${e.store ?? '?'}] ${e.message ?? 'Bilinmeyen hata'}`
        );
      } catch (syncError) {
        syncErrors = [syncError instanceof Error ? syncError.message : String(syncError)];
      }

      await loadApps(appId);

      if (syncErrors.length > 0) {
        pushStatus(`Eşzamanlama kısmi tamamlandı (${syncErrors.length} hata).`);
        for (const msg of syncErrors) {
          pushStatus(`  ${msg}`);
        }
      } else {
        pushStatus('Eşzamanlama tamamlandı.');
      }

      // Auto-diff iOS ↔ Play Store after sync and populate queue (both directions)
      if (!options?.skipDiff) {
        let totalDiffs = 0;
        try {
          const raw = await api<RawIosToPlayResponse>(`/api/apps/${appId}/prepare-ios-to-play`);
          const diff = normalizeIosToPlayDiff(raw);
          if (diff.entries.length > 0) {
            populateQueueFromDiffRef.current(diff, { silent: true });
            totalDiffs += diff.entries.length;
          }
        } catch { /* best-effort */ }
        try {
          const raw = await api<RawPlayToIosResponse>(`/api/apps/${appId}/prepare-play-to-ios`);
          const diff = normalizePlayToIosDiff(raw);
          if (diff.entries.length > 0) {
            populateQueueFromDiffRef.current(diff, { silent: true });
            totalDiffs += diff.entries.length;
          }
        } catch { /* best-effort */ }
        if (totalDiffs > 0) {
          pushStatus(`iOS ↔ Play Store: ${totalDiffs} locale farkı kuyruğa eklendi.`);
        }
      }

      return syncErrors;
    },
    [loadApps, pushStatus]
  );

  const handleCreateFormChange = useCallback((field: AppConfigField, value: string) => {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleAppConfigChange = useCallback((field: AppConfigField, value: string) => {
    setAppConfig((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleCreateSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      try {
        const result = await api<AppResponse>('/api/apps', {
          method: 'POST',
          body: JSON.stringify(toUpdatePayload(createForm)),
        });

        setCreateForm(EMPTY_CREATE_FORM);
        setIsCreateOpen(false);
        await loadApps(result.app.id);
        pushStatus('Uygulama oluşturuldu.');
      } catch (error) {
        pushStatus(error instanceof Error ? error.message : String(error));
      }
    },
    [createForm, loadApps, pushStatus]
  );

  const handleUpdateConfigSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!selectedAppId) return;

      setIsApplyingConfig(true);
      try {
        if (hasConfigChanges) {
          await api<AppResponse>(`/api/apps/${selectedAppId}`, {
            method: 'PUT',
            body: JSON.stringify(toUpdatePayload(appConfig)),
          });
          pushStatus('Konfigürasyon kaydedildi.');
        }

        await syncAndRefresh(selectedAppId, 'both');
      } catch (error) {
        pushStatus(error instanceof Error ? error.message : String(error));
      } finally {
        setIsApplyingConfig(false);
      }
    },
    [appConfig, hasConfigChanges, pushStatus, selectedAppId, syncAndRefresh]
  );

  const populateQueueFromDiff = useCallback(
    (result: StoreDiffResponse, options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;

      if (result.entries.length === 0) {
        if (!silent && result.skipped.length > 0) {
          for (const s of result.skipped) {
            pushStatus(`Atlandı: ${s.locale} — ${s.reason}`);
          }
        }
        if (!silent) pushStatus('Store\'lar arasında fark yok.');
        return;
      }

      const directionLabel = result.entries[0]?.targetStore === 'play_store'
        ? 'iOS → Play Store'
        : 'Play Store → iOS';

      setPendingStoreChanges((prev) => {
        const next: PendingStoreChangeMap = { ...prev };
        let addedCount = 0;

        for (const entry of result.entries) {
          const { targetStore, targetLocale } = entry;

          // Add locale "add" entry if new locale
          if (entry.isNewLocale) {
            const localeKey = toStoreLocaleChangeKey(targetStore, targetLocale);
            if (!next[localeKey]) {
              next[localeKey] = {
                kind: 'locale',
                key: localeKey,
                store: targetStore,
                locale: targetLocale,
                action: 'add',
              };
            }
          }

          // Add field changes (only if not already in queue — queue takes priority)
          for (const fd of entry.fields) {
            const key = toStoreChangeKey(targetStore, targetLocale, fd.field);
            if (next[key]) continue; // queue takes priority
            next[key] = {
              kind: 'field',
              key,
              store: targetStore,
              locale: targetLocale,
              field: fd.field,
              oldValue: fd.oldValue,
              newValue: fd.newValue,
            };
          }

          addedCount++;
        }

        if (!silent) {
          pushStatus(`Kuyruğa ${addedCount} locale farkı eklendi (${directionLabel}).`);
        }
        return next;
      });

      if (!silent && result.skipped.length > 0) {
        for (const s of result.skipped) {
          pushStatus(`Atlandı: ${s.locale} — ${s.reason}`);
        }
      }
    },
    [pushStatus]
  );
  populateQueueFromDiffRef.current = populateQueueFromDiff;

  const handleCopyIosToPlay = useCallback(async () => {
    if (!selectedAppId) return;

    try {
      const raw = await api<RawIosToPlayResponse>(
        `/api/apps/${selectedAppId}/prepare-ios-to-play`
      );
      populateQueueFromDiff(normalizeIosToPlayDiff(raw));
      setIsChangeDrawerOpen(true);
    } catch (error) {
      pushStatus(error instanceof Error ? error.message : String(error));
    }
  }, [populateQueueFromDiff, pushStatus, selectedAppId]);

  const handleCopyPlayToIos = useCallback(async () => {
    if (!selectedAppId) return;

    try {
      const raw = await api<RawPlayToIosResponse>(
        `/api/apps/${selectedAppId}/prepare-play-to-ios`
      );
      populateQueueFromDiff(normalizePlayToIosDiff(raw));
      setIsChangeDrawerOpen(true);
    } catch (error) {
      pushStatus(error instanceof Error ? error.message : String(error));
    }
  }, [populateQueueFromDiff, pushStatus, selectedAppId]);

  const handleGenerateTranslations = useCallback(
    async (store: StoreId, locales: string[], masterPrompt: string) => {
      if (!selectedAppId) return;

      const storeName = store === 'app_store' ? 'App Store' : 'Play Store';
      setIsApplyingConfig(true);
      pushStatus(`✨ ${storeName} çevirileri oluşturuluyor (${locales.length} locale)...`);

      try {
        const response = await fetch(
          `/api/apps/${selectedAppId}/generate-translations?store=${encodeURIComponent(store)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ store, locales, masterPrompt: masterPrompt || undefined }),
          }
        );

        if (!response.ok) {
          const errBody = await response.text();
          let message = `HTTP ${response.status}`;
          try {
            const parsed = JSON.parse(errBody);
            if (parsed.error) message = parsed.error;
          } catch { /* ignore */ }
          pushStatus(`Hata: ${message}`);
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          pushStatus('Hata: Stream okunamadı.');
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';
        const collectedLocales: Array<{
          locale: string;
          isNewLocale: boolean;
          fields: Array<{ field: string; value: string; oldValue: string }>;
        }> = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.trim()) continue;
            let event: Record<string, unknown>;
            try {
              event = JSON.parse(line);
            } catch {
              continue;
            }

            const type = event.type as string;

            if (type === 'start') {
              pushStatus(`${event.totalLocales} locale çevrilecek (${storeName})`);
            } else if (type === 'progress') {
              const status = event.status as string;
              const locale = event.locale as string;
              const field = event.field as string;
              const chars = event.chars as number;
              const maxChars = event.maxChars as number;
              if (status === 'translated') {
                pushStatus(`  ${locale}: ${field} çevrildi (${chars}/${maxChars})`);
              } else if (status === 'shortened') {
                pushStatus(`  ${locale}: ${field} kısaltıldı (${chars}/${maxChars})`);
              }
            } else if (type === 'locale_done') {
              const locale = event.locale as string;
              const isNewLocale = event.isNewLocale as boolean;
              const fields = event.fields as Array<{
                field: string;
                value: string;
                oldValue: string;
              }>;
              collectedLocales.push({ locale, isNewLocale, fields });
              pushStatus(`✓ ${locale}: ${fields.length} alan çevrildi`);
            } else if (type === 'locale_skip') {
              pushStatus(`⚠ ${event.locale}: Atlandı — ${event.reason}`);
            } else if (type === 'error') {
              pushStatus(`✗ ${event.locale}/${event.field}: ${event.error}`);
            } else if (type === 'done') {
              pushStatus(`✨ Çeviri tamamlandı (${collectedLocales.length} locale)`);
            } else if (type === 'fatal') {
              pushStatus(`Kritik hata: ${event.error}`);
            }
          }
        }

        // Populate change queue from collected results
        if (collectedLocales.length > 0) {
          const diffResult: StoreDiffResponse = {
            entries: collectedLocales.map((cl) => ({
              sourceLocale: '',
              targetLocale: cl.locale,
              targetStore: store,
              isNewLocale: cl.isNewLocale,
              fields: cl.fields.map((f) => ({
                field: f.field,
                newValue: f.value,
                oldValue: f.oldValue,
              })),
            })),
            skipped: [],
          };
          populateQueueFromDiff(diffResult);
          setIsChangeDrawerOpen(true);
        }
      } catch (error) {
        pushStatus(error instanceof Error ? error.message : String(error));
      } finally {
        setIsApplyingConfig(false);
      }
    },
    [populateQueueFromDiff, pushStatus, selectedAppId]
  );

  const handleStartGenerate = useCallback(
    (locales: string[], masterPrompt: string) => {
      const store = generateModalStore;
      if (!store) return;
      setGenerateModalStore(null);
      void handleGenerateTranslations(store, locales, masterPrompt);
    },
    [generateModalStore, handleGenerateTranslations]
  );

  const handleDownloadAppleCfBundleList = useCallback(async () => {
    if (!selectedAppId) return;

    try {
      const payload = await api<AppleCfBundleListResponse>(
        `/api/apps/${selectedAppId}/apple-cfbundle-list`
      );

      const fileBase = (selectedApp?.canonicalName || `app-${selectedAppId}`)
        .replace(/[^a-zA-Z0-9-_]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();
      const fileName = `${fileBase || `app-${selectedAppId}`}-apple-cfbundle-list.json`;
      const text = JSON.stringify({ locales: payload.locales }, null, 2);
      const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      if (payload.unsupportedInCatalog.length > 0) {
        pushStatus(
          `Apple CFBundleList indirildi (${payload.localeCount} locale). Katalog dışı locale: ${payload.unsupportedInCatalog.join(', ')}`
        );
      } else {
        pushStatus(`Apple CFBundleList indirildi (${payload.localeCount} locale).`);
      }
    } catch (error) {
      pushStatus(error instanceof Error ? error.message : String(error));
    }
  }, [pushStatus, selectedApp?.canonicalName, selectedAppId]);

  const handleDeleteApp = useCallback(async () => {
    if (!selectedAppId) return;

    const approved = window.confirm('Bu uygulama silinsin mi?');
    if (!approved) return;

    try {
      await api<null>(`/api/apps/${selectedAppId}`, { method: 'DELETE' });
      clearSelectedDetail();
      await loadApps();
      pushStatus('Uygulama silindi.');
    } catch (error) {
      pushStatus(error instanceof Error ? error.message : String(error));
    }
  }, [clearSelectedDetail, loadApps, pushStatus, selectedAppId]);

  const handleSelectIosLocale = useCallback(
    async (locale: string) => {
      setIosSelectedLocale(locale);

      const appId = selectedAppIdRef.current;
      if (!appId || !locale || !effectiveIosLocales.includes(locale)) {
        setIosDetail(null);
        return;
      }

      if (!iosLocales.includes(locale)) {
        setIosDetail(null);
        return;
      }

      setIsIosLoading(true);
      try {
        const detail = await loadIosLocaleDetail(appId, locale);
        setIosDetail(detail);
      } catch (error) {
        pushStatus(error instanceof Error ? error.message : String(error));
      } finally {
        setIsIosLoading(false);
      }
    },
    [effectiveIosLocales, iosLocales, loadIosLocaleDetail, pushStatus]
  );

  const handleSelectPlayLocale = useCallback(
    async (locale: string) => {
      setPlaySelectedLocale(locale);

      const appId = selectedAppIdRef.current;
      if (!appId || !locale || !effectivePlayLocales.includes(locale)) {
        setPlayDetail(null);
        return;
      }

      if (!playLocales.includes(locale)) {
        setPlayDetail(null);
        return;
      }

      setIsPlayLoading(true);
      try {
        const detail = await loadPlayLocaleDetail(appId, locale);
        setPlayDetail(detail);
      } catch (error) {
        pushStatus(error instanceof Error ? error.message : String(error));
      } finally {
        setIsPlayLoading(false);
      }
    },
    [effectivePlayLocales, loadPlayLocaleDetail, playLocales, pushStatus]
  );

  const handleQueueLocaleChange = useCallback(
    (store: StoreId, locale: string, action: 'add' | 'remove') => {
      const targetLocale = locale.trim();
      if (!targetLocale) return;

      const isSupportedForStore = localeCatalog.some(
        (entry) =>
          entry.locale === targetLocale &&
          (store === 'app_store' ? entry.iosSupported : entry.androidSupported)
      );
      if (action === 'add' && !isSupportedForStore) {
        pushStatus(
          `${store === 'app_store' ? 'iOS' : 'Play Store'} için desteklenmeyen locale: ${targetLocale}`
        );
        return;
      }

      const baselineLocales = store === 'app_store' ? iosLocales : playLocales;
      const existsInBaseline = baselineLocales.includes(targetLocale);
      const localeChangeKey = toStoreLocaleChangeKey(store, targetLocale);

      setPendingStoreChanges((prev) => {
        const next: PendingStoreChangeMap = { ...prev };
        const existing = prev[localeChangeKey];
        const existingLocaleAction =
          existing && existing.kind === 'locale' ? existing.action : null;

        if (action === 'add' && existsInBaseline) {
          if (existingLocaleAction === 'remove') {
            delete next[localeChangeKey];
            return next;
          }
          return prev;
        }

        if (action === 'remove' && !existsInBaseline) {
          if (existingLocaleAction === 'add') {
            delete next[localeChangeKey];
            return next;
          }
          return prev;
        }

        if (existingLocaleAction === action) {
          delete next[localeChangeKey];
          return next;
        }

        if (action === 'remove') {
          for (const [key, change] of Object.entries(next)) {
            if (change.kind !== 'field') continue;
            if (change.store === store && change.locale === targetLocale) {
              delete next[key];
            }
          }
        }

        next[localeChangeKey] = {
          kind: 'locale',
          key: localeChangeKey,
          store,
          locale: targetLocale,
          action,
        };
        return next;
      });
    },
    [iosLocales, localeCatalog, playLocales, pushStatus]
  );

  useEffect(() => {
    if (!effectiveIosLocales.includes(iosSelectedLocale)) {
      const fallback = pickDefaultLocale(appConfig.sourceLocale, effectiveIosLocales);
      if (fallback !== iosSelectedLocale) {
        void handleSelectIosLocale(fallback);
        return;
      }
      if (!fallback || !iosLocales.includes(fallback)) {
        setIosDetail(null);
      }
    }
  }, [
    appConfig.sourceLocale,
    effectiveIosLocales,
    handleSelectIosLocale,
    iosLocales,
    iosSelectedLocale,
  ]);

  useEffect(() => {
    if (!effectivePlayLocales.includes(playSelectedLocale)) {
      const fallback = pickDefaultLocale(appConfig.sourceLocale, effectivePlayLocales);
      if (fallback !== playSelectedLocale) {
        void handleSelectPlayLocale(fallback);
        return;
      }
      if (!fallback || !playLocales.includes(fallback)) {
        setPlayDetail(null);
      }
    }
  }, [
    appConfig.sourceLocale,
    effectivePlayLocales,
    handleSelectPlayLocale,
    playLocales,
    playSelectedLocale,
  ]);

  const handleStoreFieldChange = useCallback(
    (payload: {
      store: StoreId;
      locale: string;
      field: string;
      nextValue: string;
      originalValue: string;
    }) => {
      const store = payload.store;
      const locale = payload.locale.trim();
      const field = payload.field.trim();
      const nextValue = payload.nextValue;
      const originalValue = payload.originalValue;

      if (!store || !locale || !field) return;
      const key = toStoreChangeKey(store, locale, field);

      setPendingStoreChanges((prev) => {
        const existing = prev[key];
        const oldValue =
          existing && existing.kind === 'field' ? existing.oldValue : originalValue;

        if (nextValue === oldValue) {
          if (!existing || existing.kind !== 'field') return prev;
          const next = { ...prev };
          delete next[key];
          return next;
        }

        return {
          ...prev,
          [key]: {
            kind: 'field',
            key,
            store,
            locale,
            field,
            oldValue,
            newValue: nextValue,
          },
        };
      });
    },
    []
  );

  const handleClearPendingChanges = useCallback(() => {
    setPendingStoreChanges({});
  }, []);

  const handleApplyPendingChanges = useCallback(
    async (storeFilter?: StoreId) => {
      if (!selectedAppId) return;

      const allEntries = Object.values(pendingStoreChanges).filter(
        (entry) => !storeFilter || entry.store === storeFilter
      );
      const localeEntries = allEntries.filter(
        (entry): entry is PendingStoreLocaleChange => entry.kind === 'locale'
      );
      const fieldEntries = allEntries.filter(
        (entry): entry is PendingStoreFieldChange => entry.kind === 'field'
      );

      // Find field-only updates: fields for locales that have no locale add/remove entry
      const localeActionKeys = new Set(localeEntries.map((e) => `${e.store}::${e.locale}`));
      const fieldOnlyByLocale = new Map<string, PendingStoreFieldChange[]>();
      for (const fe of fieldEntries) {
        const localeKey = `${fe.store}::${fe.locale}`;
        if (localeActionKeys.has(localeKey)) continue; // handled by locale add/remove
        if (!fieldOnlyByLocale.has(localeKey)) fieldOnlyByLocale.set(localeKey, []);
        fieldOnlyByLocale.get(localeKey)!.push(fe);
      }

      if (localeEntries.length === 0 && fieldOnlyByLocale.size === 0) {
        pushStatus(
          storeFilter ? `${storeFilter} için değişiklik yok.` : 'Değişiklik yok.'
        );
        return;
      }

      // Validate: new locale adds must have required fields in the change queue
      const rules = meta?.storeRules;
      const addEntries = localeEntries.filter((e) => e.action === 'add');

      for (const addEntry of addEntries) {
        const ruleSet = rules?.[addEntry.store];
        if (!ruleSet) continue;

        const missingFields: string[] = [];
        for (const [fieldKey, fieldRule] of Object.entries(ruleSet.fields)) {
          if (!fieldRule.requiredForSave) continue;
          const changeKey = toStoreChangeKey(addEntry.store, addEntry.locale, fieldKey);
          const fieldChange = pendingStoreChanges[changeKey];
          if (!fieldChange || fieldChange.kind !== 'field' || !fieldChange.newValue.trim()) {
            missingFields.push(fieldKey);
          }
        }

        if (missingFields.length > 0) {
          pushStatus(
            `${addEntry.store}/${addEntry.locale} eklemek için zorunlu alanlar eksik: ${missingFields.join(', ')}. ` +
            `Önce bu alanları doldurun.`
          );
          return;
        }
      }

      // Build changes payload: locale add/remove + field-only updates
      const changes: Array<{
        store: StoreId;
        locale: string;
        action: string;
        fields?: Record<string, string>;
      }> = [];

      for (const entry of localeEntries) {
        if (entry.action !== 'add') {
          changes.push({ store: entry.store, locale: entry.locale, action: entry.action });
          continue;
        }

        const fields: Record<string, string> = {};
        for (const change of allEntries) {
          if (
            change.kind === 'field' &&
            change.store === entry.store &&
            change.locale === entry.locale
          ) {
            fields[change.field] = change.newValue;
          }
        }

        changes.push({ store: entry.store, locale: entry.locale, action: entry.action, fields });
      }

      // Add field-only updates as "update" action
      for (const [, fieldChanges] of fieldOnlyByLocale) {
        const first = fieldChanges[0];
        const fields: Record<string, string> = {};
        for (const fc of fieldChanges) {
          fields[fc.field] = fc.newValue;
        }
        changes.push({ store: first.store, locale: first.locale, action: 'update', fields });
      }

      type ApplyResponse = {
        succeeded: Array<{ store: StoreId; locale: string; action: string }>;
        failed: Array<{ store: StoreId; locale: string; action: string; error: string }>;
        appStoreLocales: string[];
        playStoreLocales: string[];
      };

      setIsApplyingConfig(true);
      try {
        pushStatus(`${changes.length} değişiklik uygulanıyor...`);

        const result = await api<ApplyResponse>(
          `/api/apps/${selectedAppId}/locales/apply`,
          { method: 'POST', body: JSON.stringify({ changes }) }
        );

        // Remove succeeded changes from pending
        setPendingStoreChanges((prev) => {
          const next = { ...prev };
          for (const s of result.succeeded) {
            if (s.action === 'add' || s.action === 'remove') {
              const localeKey = toStoreLocaleChangeKey(s.store, s.locale);
              delete next[localeKey];
            }
            // Remove associated field changes for add and update actions
            if (s.action === 'add' || s.action === 'update') {
              for (const key of Object.keys(next)) {
                if (key.startsWith(`${s.store}::${s.locale}::`) && next[key]?.kind === 'field') {
                  delete next[key];
                }
              }
            }
          }
          return next;
        });

        if (result.failed.length > 0) {
          pushStatus(
            `Kısmi başarı: ${result.succeeded.length} başarılı, ${result.failed.length} başarısız.`
          );
          for (const f of result.failed) {
            pushStatus(`  HATA [${f.store}/${f.locale}/${f.action}]: ${f.error}`);
          }
        } else {
          pushStatus(`${result.succeeded.length} değişiklik uygulandı.`);
        }

        // Auto-sync affected stores via shared routine
        const succeededStores = new Set(result.succeeded.map((s) => s.store));
        if (succeededStores.size > 0) {
          const storeScope =
            succeededStores.has('app_store') && succeededStores.has('play_store')
              ? 'both'
              : succeededStores.has('app_store')
                ? 'app_store'
                : 'play_store';
          await syncAndRefresh(selectedAppId, storeScope, { skipDiff: true });
        }
      } catch (error) {
        pushStatus(
          `Locale değişikliği sırasında hata: ${error instanceof Error ? error.message : String(error)}`
        );
      } finally {
        setIsApplyingConfig(false);
      }
    },
    [meta?.storeRules, pendingStoreChanges, pushStatus, selectedAppId, syncAndRefresh]
  );

  return (
    <>
      <div className="bg-shape bg-shape-a"></div>
      <div className="bg-shape bg-shape-b"></div>

      <div
        className={`app-shell ${isConsoleExpanded ? 'console-expanded' : 'console-collapsed'} ${
          isChangeDrawerOpen ? 'changes-open' : 'changes-closed'
        }`}
      >
        <HeaderBar />

        <main className="layout">
          <div className="layout-sidebar-cell">
            <AppListSidebar
              apps={apps}
              selectedAppId={selectedAppId}
              onSelectApp={(appId) => {
                void selectApp(appId);
              }}
              onRefreshApps={() => {
                void handleRefreshApps();
              }}
              onOpenCreate={() => setIsCreateOpen(true)}
              onOpenRules={() => setIsRulesOpen(true)}
            />
          </div>

          <AppDetailsPanel
            selectedApp={selectedApp}
            appConfig={appConfig}
            localeOptions={localeOptions}
            hasConfigChanges={hasConfigChanges}
            isApplyingConfig={isApplyingConfig}
            onChangeConfig={handleAppConfigChange}
            onSubmitConfig={(event) => {
              void handleUpdateConfigSubmit(event);
            }}
            onGenerateAppStore={() => setGenerateModalStore('app_store')}
            onGeneratePlay={() => setGenerateModalStore('play_store')}
            onCopyIosToPlay={() => {
              void handleCopyIosToPlay();
            }}
            onCopyPlayToIos={() => {
              void handleCopyPlayToIos();
            }}
            onDownloadAppleCfBundleList={() => {
              void handleDownloadAppleCfBundleList();
            }}
            onDeleteApp={() => {
              void handleDeleteApp();
            }}
          />
        </main>

        <section className="card store-section">
          <div className="card-head">
            <h3>Store Görünümleri</h3>
          </div>

          {selectedApp ? (
            <StoreLocalePanels
              sourceLocale={appConfig.sourceLocale}
              storeRules={meta?.storeRules}
              localeCatalog={localeCatalog}
              pendingValueMap={pendingValueMap}
              ios={{
                locales: effectiveIosLocales,
                selectedLocale: iosSelectedLocale,
                detail: iosDetail,
                isLoading: isIosLoading,
                visible: showIosPanel,
              }}
              play={{
                locales: effectivePlayLocales,
                selectedLocale: playSelectedLocale,
                detail: playDetail,
                isLoading: isPlayLoading,
                visible: showPlayPanel,
              }}
              onSelectIosLocale={(locale) => {
                void handleSelectIosLocale(locale);
              }}
              onSelectPlayLocale={(locale) => {
                void handleSelectPlayLocale(locale);
              }}
              onDeleteIosLocale={(locale) => {
                handleQueueLocaleChange('app_store', locale, 'remove');
              }}
              onDeletePlayLocale={(locale) => {
                handleQueueLocaleChange('play_store', locale, 'remove');
              }}
              onAddIosLocale={(locale) => {
                handleQueueLocaleChange('app_store', locale, 'add');
              }}
              onAddPlayLocale={(locale) => {
                handleQueueLocaleChange('play_store', locale, 'add');
              }}
              onChangeStoreField={handleStoreFieldChange}
            />
          ) : (
            <section className="store-panels-empty">
              <p>Store görünümlerini görmek için soldan bir uygulama seçmelisin.</p>
            </section>
          )}
        </section>
      </div>

      <ChangeQueueDrawer
        isOpen={isChangeDrawerOpen}
        isBusy={isApplyingConfig}
        changes={pendingChangeEntries}
        onToggle={() => setIsChangeDrawerOpen((prev) => !prev)}
        onClear={handleClearPendingChanges}
        onApplyStore={handleApplyPendingChanges}
        onApply={() => handleApplyPendingChanges()}
      />

      <section className={`console-dock ${isConsoleExpanded ? 'expanded' : 'collapsed'} ${isChangeDrawerOpen ? 'changes-open' : ''}`}>
        <div className="card-head console-head">
          <h3>Konsol</h3>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setIsConsoleExpanded((prev) => !prev)}
          >
            {isConsoleExpanded ? 'Küçült' : 'Büyüt'}
          </Button>
        </div>
        {isConsoleExpanded ? (
          <pre className="code-box console-box">{statusLogs.join('\n') || latestStatusLine}</pre>
        ) : (
          <div className="console-line">{latestStatusLine}</div>
        )}
      </section>

      <CreateAppDialog
        isOpen={isCreateOpen}
        form={createForm}
        localeOptions={localeOptions}
        onClose={() => setIsCreateOpen(false)}
        onChange={handleCreateFormChange}
        onSubmit={(event) => {
          void handleCreateSubmit(event);
        }}
      />

      <RulesDialog
        isOpen={isRulesOpen}
        stores={stores}
        onClose={() => setIsRulesOpen(false)}
        onReload={() => {
          void handleReloadMeta();
        }}
      />

      <GenerateTranslationsDialog
        isOpen={generateModalStore !== null}
        store={generateModalStore ?? 'app_store'}
        missingLocales={generateMissingLocales}
        onClose={() => setGenerateModalStore(null)}
        onStart={handleStartGenerate}
        isRunning={isApplyingConfig}
      />
    </>
  );
}
