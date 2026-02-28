import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppDetailsPanel from './components/organisms/AppDetailsPanel.jsx';
import AppListSidebar from './components/organisms/AppListSidebar.jsx';
import CreateAppDialog from './components/organisms/CreateAppDialog.jsx';
import HeaderBar from './components/organisms/HeaderBar.jsx';
import RulesDialog from './components/organisms/RulesDialog.jsx';
import StoreLocalePanels from './components/organisms/StoreLocalePanels.jsx';
import { api, formatOutput } from './lib/api.js';

const EMPTY_CREATE_FORM = {
  canonicalName: '',
  sourceLocale: 'en-US',
  ascAppId: '',
  androidPackageName: '',
};

const EMPTY_APP_CONFIG = {
  canonicalName: '',
  sourceLocale: 'en-US',
  ascAppId: '',
  androidPackageName: '',
};

function normalizeLocaleCatalog(rows) {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => {
      if (typeof row === 'string') {
        return {
          locale: row,
          iosSupported: true,
          androidSupported: true,
        };
      }

      const locale = typeof row?.locale === 'string' ? row.locale.trim() : '';
      if (!locale) return null;

      return {
        locale,
        iosSupported: Boolean(row.iosSupported),
        androidSupported: Boolean(row.androidSupported),
      };
    })
    .filter((row) => Boolean(row));
}

function toUpdatePayload(form) {
  return {
    canonicalName: form.canonicalName.trim(),
    sourceLocale: form.sourceLocale.trim(),
    ascAppId: form.ascAppId.trim(),
    androidPackageName: form.androidPackageName.trim(),
  };
}

function normalizeConfigForCompare(config) {
  return {
    canonicalName: (config?.canonicalName || '').trim(),
    sourceLocale: (config?.sourceLocale || '').trim(),
    ascAppId: (config?.ascAppId || '').trim(),
    androidPackageName: (config?.androidPackageName || '').trim(),
  };
}

function toSortedUniqueLocales(entries) {
  return Array.from(
    new Set(
      (entries || [])
        .map((entry) => (typeof entry?.locale === 'string' ? entry.locale.trim() : ''))
        .filter((locale) => locale.length > 0)
    )
  ).sort((a, b) => a.localeCompare(b));
}

function pickDefaultLocale(sourceLocale, localeList) {
  const normalizedSource = (sourceLocale || '').trim();
  if (normalizedSource && localeList.includes(normalizedSource)) {
    return normalizedSource;
  }
  return localeList[0] || normalizedSource;
}

export default function App() {
  const [meta, setMeta] = useState(null);
  const [apps, setApps] = useState([]);
  const [selectedAppId, setSelectedAppId] = useState(null);
  const [selectedApp, setSelectedApp] = useState(null);
  const selectedAppIdRef = useRef(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);

  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [appConfig, setAppConfig] = useState(EMPTY_APP_CONFIG);

  const [localeCatalog, setLocaleCatalog] = useState([]);
  const [statusLogs, setStatusLogs] = useState([]);
  const [isApplyingConfig, setIsApplyingConfig] = useState(false);

  const [iosLocales, setIosLocales] = useState([]);
  const [playLocales, setPlayLocales] = useState([]);
  const [iosSelectedLocale, setIosSelectedLocale] = useState('');
  const [playSelectedLocale, setPlaySelectedLocale] = useState('');
  const [iosDetail, setIosDetail] = useState(null);
  const [playDetail, setPlayDetail] = useState(null);
  const [isIosLoading, setIsIosLoading] = useState(false);
  const [isPlayLoading, setIsPlayLoading] = useState(false);

  useEffect(() => {
    selectedAppIdRef.current = selectedAppId;
  }, [selectedAppId]);

  const pushStatus = useCallback((message) => {
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
  }, []);

  const loadMeta = useCallback(async () => {
    const payload = await api('/api/meta');
    setMeta(payload);
    setLocaleCatalog(normalizeLocaleCatalog(payload?.localeCatalog));
  }, []);

  const loadStoreLocaleDetail = useCallback(async (appId, store, locale) => {
    if (!locale) return null;
    const payload = await api(
      `/api/apps/${appId}/locales/details/${store}/${encodeURIComponent(locale)}`
    );
    return payload?.detail ?? null;
  }, []);

  const loadStorePanels = useCallback(
    async (appId, sourceLocale) => {
      setIsIosLoading(true);
      setIsPlayLoading(true);

      try {
        const [iosPayload, playPayload] = await Promise.all([
          api(`/api/apps/${appId}/locales/details?store=app_store`),
          api(`/api/apps/${appId}/locales/details?store=play_store`),
        ]);

        const nextIosLocales = toSortedUniqueLocales(iosPayload?.entries);
        const nextPlayLocales = toSortedUniqueLocales(playPayload?.entries);

        const nextIosSelectedLocale = pickDefaultLocale(sourceLocale, nextIosLocales);
        const nextPlaySelectedLocale = pickDefaultLocale(sourceLocale, nextPlayLocales);

        setIosLocales(nextIosLocales);
        setPlayLocales(nextPlayLocales);
        setIosSelectedLocale(nextIosSelectedLocale);
        setPlaySelectedLocale(nextPlaySelectedLocale);

        const [nextIosDetail, nextPlayDetail] = await Promise.all([
          nextIosLocales.includes(nextIosSelectedLocale)
            ? loadStoreLocaleDetail(appId, 'app_store', nextIosSelectedLocale).catch(() => null)
            : Promise.resolve(null),
          nextPlayLocales.includes(nextPlaySelectedLocale)
            ? loadStoreLocaleDetail(appId, 'play_store', nextPlaySelectedLocale).catch(() => null)
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
    [loadStoreLocaleDetail]
  );

  const selectApp = useCallback(
    async (appId) => {
      const payload = await api(`/api/apps/${appId}`);
      const app = payload.app;

      setSelectedAppId(app.id);
      setSelectedApp(app);
      setAppConfig({
        canonicalName: app.canonicalName || '',
        sourceLocale: app.sourceLocale || 'en-US',
        ascAppId: app.ascAppId || '',
        androidPackageName: app.androidPackageName || '',
      });

      await loadStorePanels(app.id, app.sourceLocale || 'en-US');
    },
    [loadStorePanels]
  );

  const loadApps = useCallback(
    async (selectId) => {
      const payload = await api('/api/apps');
      const nextApps = payload.apps || [];
      setApps(nextApps);

      if (selectId) {
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
    (async () => {
      try {
        await Promise.all([loadMeta(), loadApps()]);
      } catch (error) {
        pushStatus(error instanceof Error ? error.message : String(error));
      }
    })();
  }, [loadApps, loadMeta]);

  const stores = useMemo(() => Object.values(meta?.storeRules || {}), [meta]);

  const localeOptions = useMemo(() => {
    const fallback = [{ locale: 'en-US', iosSupported: true, androidSupported: true }];
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
    return Object.keys(current).some((key) => current[key] !== baseline[key]);
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

  const handleCreateFormChange = useCallback((field, value) => {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleAppConfigChange = useCallback((field, value) => {
    setAppConfig((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleCreateSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      try {
        const result = await api('/api/apps', {
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
    async (event) => {
      event.preventDefault();
      if (!selectedAppId) return;

      setIsApplyingConfig(true);
      try {
        if (hasConfigChanges) {
          await api(`/api/apps/${selectedAppId}`, {
            method: 'PUT',
            body: JSON.stringify(toUpdatePayload(appConfig)),
          });
        }

        try {
          const syncResult = await api(`/api/apps/${selectedAppId}/locales/sync`, {
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
          } else {
            if (errors.length > 0) {
              pushStatus(`Sync kısmi tamamlandı (${errors.length} hata).`);
            } else {
              pushStatus('Store verileri sync edildi.');
            }
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
      await api(`/api/apps/${selectedAppId}`, { method: 'DELETE' });
      clearSelectedDetail();
      await loadApps();
      pushStatus('Uygulama silindi.');
    } catch (error) {
      pushStatus(error instanceof Error ? error.message : String(error));
    }
  }, [clearSelectedDetail, loadApps, pushStatus, selectedAppId]);

  const handleSelectIosLocale = useCallback(
    async (locale) => {
      setIosSelectedLocale(locale);

      const appId = selectedAppIdRef.current;
      if (!appId || !locale || !iosLocales.includes(locale)) {
        setIosDetail(null);
        return;
      }

      setIsIosLoading(true);
      try {
        const detail = await loadStoreLocaleDetail(appId, 'app_store', locale);
        setIosDetail(detail);
      } catch (error) {
        pushStatus(error instanceof Error ? error.message : String(error));
      } finally {
        setIsIosLoading(false);
      }
    },
    [iosLocales, loadStoreLocaleDetail, pushStatus]
  );

  const handleSelectPlayLocale = useCallback(
    async (locale) => {
      setPlaySelectedLocale(locale);

      const appId = selectedAppIdRef.current;
      if (!appId || !locale || !playLocales.includes(locale)) {
        setPlayDetail(null);
        return;
      }

      setIsPlayLoading(true);
      try {
        const detail = await loadStoreLocaleDetail(appId, 'play_store', locale);
        setPlayDetail(detail);
      } catch (error) {
        pushStatus(error instanceof Error ? error.message : String(error));
      } finally {
        setIsPlayLoading(false);
      }
    },
    [loadStoreLocaleDetail, playLocales, pushStatus]
  );

  return (
    <>
      <div className="bg-shape bg-shape-a"></div>
      <div className="bg-shape bg-shape-b"></div>

      <div className="app-shell">
        <HeaderBar onOpenRules={() => setIsRulesOpen(true)} />

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
              ios={{
                locales: iosLocales,
                selectedLocale: iosSelectedLocale,
                detail: iosDetail,
                isLoading: isIosLoading,
                visible: showIosPanel,
              }}
              play={{
                locales: playLocales,
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
            />
          ) : (
            <section className="store-panels-empty">
              <p>Store görünümlerini görmek için soldan bir uygulama seçmelisin.</p>
            </section>
          )}
        </section>

        <section className="card console-dock">
          <div className="card-head">
            <h3>Konsol</h3>
          </div>
          <pre className="code-box console-box">
            {statusLogs.length > 0
              ? statusLogs.join('\n')
              : '[Sistem] Güncelleme ve olay logları burada görünecek.'}
          </pre>
        </section>
      </div>

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
