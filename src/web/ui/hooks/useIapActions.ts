import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type {
  AIProvider,
  IapListPayload,
  PendingStoreChangeMap,
  PendingStoreIapFieldChange,
  StoreIapEntry,
  StoreId,
} from '../types';
import { fetchIaps, requestIapTranslationStream } from '../services/iapService';

type IapGenerateLocaleDoneEvent = {
  productId?: string;
  iapType?: string;
  locale?: string;
  fields?: Array<{
    field?: string;
    value?: string;
    oldValue?: string;
  }>;
};

export function useIapActions(params: {
  selectedAppId: number | null;
  selectedAppSourceLocale?: string;
  appConfigSourceLocale: string;
  pushStatus: (message: unknown) => void;
  setIsIapLoading: Dispatch<SetStateAction<boolean>>;
  setAppStoreIaps: Dispatch<SetStateAction<StoreIapEntry[]>>;
  setPlayStoreIaps: Dispatch<SetStateAction<StoreIapEntry[]>>;
  setIsGeneratingIap: Dispatch<SetStateAction<boolean>>;
  setPendingStoreChanges: Dispatch<SetStateAction<PendingStoreChangeMap>>;
  setIsChangeDrawerOpen: Dispatch<SetStateAction<boolean>>;
  toStoreIapChangeKey: (store: StoreId, productId: string, locale: string, field: string) => string;
}) {
  const {
    selectedAppId,
    selectedAppSourceLocale,
    appConfigSourceLocale,
    pushStatus,
    setIsIapLoading,
    setAppStoreIaps,
    setPlayStoreIaps,
    setIsGeneratingIap,
    setPendingStoreChanges,
    setIsChangeDrawerOpen,
    toStoreIapChangeKey,
  } = params;

  const loadIaps = useCallback(async (appId: number) => {
    setIsIapLoading(true);
    try {
      const payload: IapListPayload = await fetchIaps(appId);
      setAppStoreIaps(Array.isArray(payload?.appStoreIaps) ? payload.appStoreIaps : []);
      setPlayStoreIaps(Array.isArray(payload?.playStoreIaps) ? payload.playStoreIaps : []);
    } catch (error) {
      setAppStoreIaps([]);
      setPlayStoreIaps([]);
      pushStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setIsIapLoading(false);
    }
  }, [pushStatus, setAppStoreIaps, setIsIapLoading, setPlayStoreIaps]);

  const handleGenerateIapTranslations = useCallback(async (store: StoreId, provider?: AIProvider) => {
    if (!selectedAppId) return;

    const storeName = store === 'app_store' ? 'App Store' : 'Play Store';
    const sourceLocale = selectedAppSourceLocale || appConfigSourceLocale || 'en-US';
    setIsGeneratingIap(true);
    pushStatus(`✨ ${storeName} IAP çevirileri oluşturuluyor (source: ${sourceLocale})...`);

    try {
      const response = await requestIapTranslationStream(selectedAppId, store, provider);

      if (!response.ok) {
        const errBody = await response.text();
        let message = `HTTP ${response.status}`;
        try {
          const parsed = JSON.parse(errBody) as { error?: string };
          if (parsed.error) message = parsed.error;
        } catch {
          // no-op
        }
        pushStatus(`IAP generate hatası: ${message}`);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        pushStatus('IAP generate stream okunamadı.');
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      const collectedChanges = new Map<string, PendingStoreIapFieldChange>();

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
            event = JSON.parse(line) as Record<string, unknown>;
          } catch {
            continue;
          }

          const type = event.type;
          if (type === 'start') {
            const totalIaps = typeof event.totalIaps === 'number' ? event.totalIaps : 0;
            const totalLocales = typeof event.totalLocales === 'number' ? event.totalLocales : 0;
            pushStatus(`IAP generate başladı (${totalIaps} ürün / ${totalLocales} locale).`);
            continue;
          }

          if (type === 'iap_start') {
            const productId = typeof event.productId === 'string' ? event.productId.trim() : '';
            const iapType = typeof event.iapType === 'string' ? event.iapType.trim() : '';
            if (productId) {
              pushStatus(`→ ${productId}${iapType ? ` (${iapType})` : ''} çevriliyor...`);
            }
            continue;
          }

          if (type === 'progress') {
            const productId = typeof event.productId === 'string' ? event.productId.trim() : '';
            const locale = typeof event.locale === 'string' ? event.locale.trim() : '';
            const field = typeof event.field === 'string' ? event.field.trim() : '';
            if (productId && locale && field) {
              pushStatus(`  ${productId} ${locale}/${field}: çevrildi`);
            }
            continue;
          }

          if (type === 'locale_done') {
            const doneEvent = event as unknown as IapGenerateLocaleDoneEvent;
            const productId = doneEvent.productId?.trim() || '';
            const locale = doneEvent.locale?.trim() || '';
            const iapType = doneEvent.iapType?.trim() || undefined;
            const fields = Array.isArray(doneEvent.fields) ? doneEvent.fields : [];
            if (!productId || !locale || fields.length === 0) continue;

            for (const field of fields) {
              const fieldId = typeof field.field === 'string' ? field.field.trim() : '';
              if (!fieldId) continue;
              const key = toStoreIapChangeKey(store, productId, locale, fieldId);
              collectedChanges.set(key, {
                kind: 'iap_field',
                key,
                store,
                productId,
                iapType,
                locale,
                field: fieldId,
                oldValue: typeof field.oldValue === 'string' ? field.oldValue : '',
                newValue: typeof field.value === 'string' ? field.value : '',
              });
            }

            pushStatus(`✓ ${productId} ${locale}: ${fields.length} alan`);
            continue;
          }

          if (type === 'iap_skip') {
            const productId = typeof event.productId === 'string' ? event.productId.trim() : '';
            const reason = typeof event.reason === 'string' ? event.reason.trim() : 'Atlandı';
            pushStatus(`⚠ ${productId || 'IAP'}: ${reason}`);
            continue;
          }

          if (type === 'locale_skip') {
            const productId = typeof event.productId === 'string' ? event.productId.trim() : '';
            const locale = typeof event.locale === 'string' ? event.locale.trim() : '';
            const reason = typeof event.reason === 'string' ? event.reason.trim() : 'Atlandı';
            pushStatus(`⚠ ${productId} ${locale}: ${reason}`);
            continue;
          }

          if (type === 'error') {
            const productId = typeof event.productId === 'string' ? event.productId.trim() : '';
            const locale = typeof event.locale === 'string' ? event.locale.trim() : '';
            const field = typeof event.field === 'string' ? event.field.trim() : '';
            const reason = typeof event.error === 'string' ? event.error.trim() : 'Bilinmeyen hata';
            pushStatus(`✗ ${productId} ${locale}/${field}: ${reason}`);
            continue;
          }

          if (type === 'done') {
            const translatedLocales = typeof event.translatedLocales === 'number' ? event.translatedLocales : 0;
            const changedFields = typeof event.changedFields === 'number' ? event.changedFields : 0;
            pushStatus(`IAP generate tamamlandı (${translatedLocales} locale, ${changedFields} alan).`);
            continue;
          }

          if (type === 'fatal') {
            const reason = typeof event.error === 'string' ? event.error.trim() : 'Bilinmeyen hata';
            pushStatus(`IAP generate kritik hata: ${reason}`);
          }
        }
      }

      if (collectedChanges.size > 0) {
        setPendingStoreChanges((prev) => {
          const next: PendingStoreChangeMap = { ...prev };
          for (const [key, change] of collectedChanges.entries()) {
            next[key] = change;
          }
          return next;
        });
        setIsChangeDrawerOpen(true);
        pushStatus(`IAP generate: ${collectedChanges.size} alan değişiklik listesine eklendi.`);
      } else {
        pushStatus('IAP generate: değişiklik oluşmadı.');
      }
    } catch (error) {
      pushStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setIsGeneratingIap(false);
    }
  }, [
    appConfigSourceLocale,
    pushStatus,
    selectedAppId,
    selectedAppSourceLocale,
    setIsChangeDrawerOpen,
    setIsGeneratingIap,
    setPendingStoreChanges,
    toStoreIapChangeKey,
  ]);

  return {
    loadIaps,
    handleGenerateIapTranslations,
  };
}
