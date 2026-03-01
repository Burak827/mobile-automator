import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import Button from './components/atoms/Button';
import AppDetailsPanel from './components/organisms/AppDetailsPanel';
import AppListSidebar from './components/organisms/AppListSidebar';
import ChangeQueueDrawer from './components/organisms/ChangeQueueDrawer';
import CreateAppDialog from './components/organisms/CreateAppDialog';
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

export default function App() {
  const [meta, setMeta] = useState<MetaPayload | null>(null);
  const [apps, setApps] = useState<AppListItem[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<number | null>(null);
  const [selectedApp, setSelectedApp] = useState<AppRecord | null>(null);
  const selectedAppIdRef = useRef<number | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);

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
        }

        try {
          const syncResult = await api<SyncResponse>(`/api/apps/${selectedAppId}/locales/sync`, {
            method: 'POST',
            body: JSON.stringify({ storeScope: 'both' }),
          });

          await selectApp(selectedAppId);

          const errors = Array.isArray(syncResult?.errors) ? syncResult.errors : [];
          if (hasConfigChanges) {
            if (errors.length > 0) {
              pushStatus(
                `Konfigürasyon kaydedildi. Sync kısmi tamamlandı (${errors.length} hata).`
              );
            } else {
              pushStatus('Konfigürasyon kaydedildi ve store verileri sync edildi.');
            }
          } else if (errors.length > 0) {
            pushStatus(`Sync kısmi tamamlandı (${errors.length} hata).`);
          } else {
            pushStatus('Store verileri sync edildi.');
          }
        } catch (syncError) {
          await selectApp(selectedAppId);
          pushStatus(
            `${hasConfigChanges ? 'Konfigürasyon kaydedildi fakat s' : 'S'}ync sırasında hata oluştu: ${
              syncError instanceof Error ? syncError.message : String(syncError)
            }`
          );
        }
      } catch (error) {
        pushStatus(error instanceof Error ? error.message : String(error));
      } finally {
        setIsApplyingConfig(false);
      }
    },
    [appConfig, hasConfigChanges, pushStatus, selectApp, selectedAppId]
  );

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
    (storeFilter?: StoreId) => {
      const entries = Object.values(pendingStoreChanges).filter(
        (entry) => !storeFilter || entry.store === storeFilter
      );
      if (entries.length === 0) {
        pushStatus(storeFilter ? `${storeFilter} için değişiklik yok.` : 'Değişiklik yok.');
        return;
      }
      pushStatus(
        `Store update işlemi henüz devreye alınmadı. ${entries.length} değişiklik listede tutuluyor.`
      );
    },
    [pendingStoreChanges, pushStatus]
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
        isConsoleExpanded={isConsoleExpanded}
        changes={pendingChangeEntries}
        onToggle={() => setIsChangeDrawerOpen((prev) => !prev)}
        onClear={handleClearPendingChanges}
        onApplyStore={handleApplyPendingChanges}
        onApply={() => handleApplyPendingChanges()}
      />

      <section className={`console-dock ${isConsoleExpanded ? 'expanded' : 'collapsed'}`}>
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
    </>
  );
}
