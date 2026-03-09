import { useCallback } from 'react';
import { syncAppLocales } from '../services/syncService';

export function useSyncActions(params: {
  pushStatus: (message: unknown) => void;
  loadApps: (selectId?: number) => Promise<void>;
}) {
  const { pushStatus, loadApps } = params;

  const syncAndRefresh = useCallback(async (
    appId: number,
    storeScope: 'both' | 'app_store' | 'play_store'
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
      const syncResult = await syncAppLocales(appId, storeScope);
      syncErrors = (syncResult?.errors ?? []).map(
        (e: { store?: string; message?: string }) =>
          `[${e.store ?? '?'}] ${e.message ?? 'Bilinmeyen hata'}`
      );

      const appStoreIapError = syncResult?.appStore?.iapError?.trim();
      if (appStoreIapError) {
        pushStatus(`App Store IAP uyarısı: ${appStoreIapError}`);
      }
      const playStoreIapError = syncResult?.playStore?.iapError?.trim();
      if (playStoreIapError) {
        pushStatus(`Play Store IAP uyarısı: ${playStoreIapError}`);
      }
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

    return syncErrors;
  }, [loadApps, pushStatus]);

  return { syncAndRefresh };
}
