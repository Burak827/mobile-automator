import { api } from '../lib/api';
import type {
  StoreId,
  StoreLocaleDetail,
  StoreLocaleDetailPayload,
  StoreLocalesPayload,
  StoreLocaleDetailsListPayload,
} from '../types';

export async function fetchStoreLocales(appId: number): Promise<StoreLocalesPayload> {
  return api<StoreLocalesPayload>(`/api/apps/${appId}/locales`);
}

export async function fetchAppStoreLocaleDetail(
  appId: number,
  locale: string
): Promise<StoreLocaleDetailPayload> {
  return api<StoreLocaleDetailPayload>(
    `/api/apps/${appId}/locales/details/app_store/${encodeURIComponent(locale)}`
  );
}

export async function fetchPlayStoreLocaleDetail(
  appId: number,
  locale: string
): Promise<StoreLocaleDetailPayload> {
  return api<StoreLocaleDetailPayload>(
    `/api/apps/${appId}/locales/details/play_store/${encodeURIComponent(locale)}`
  );
}

export async function fetchStoreLocaleDetailsList(
  appId: number,
  store: 'app_store' | 'play_store'
): Promise<StoreLocaleDetailsListPayload> {
  return api<StoreLocaleDetailsListPayload>(`/api/apps/${appId}/locales/details?store=${store}`);
}

export async function fetchStoreTitleMap(
  appId: number,
  store: StoreId
): Promise<Map<string, string>> {
  const payload = await fetchStoreLocaleDetailsList(appId, store);
  const map = new Map<string, string>();
  for (const entry of payload.entries) {
    const locale = entry.locale.trim();
    if (!locale) continue;
    map.set(locale, readStoreTitleFromDetail(store, entry.detail));
  }
  return map;
}

function readStoreTitleFromDetail(store: StoreId, detail: StoreLocaleDetail | unknown): string {
  if (!detail || typeof detail !== 'object') return '';

  if (store === 'app_store') {
    const appInfo = (detail as StoreLocaleDetail & { appInfo?: { name?: string } }).appInfo;
    return appInfo?.name?.trim() || '';
  }

  const listing = (detail as StoreLocaleDetail & { listing?: { title?: string } }).listing;
  return listing?.title?.trim() || '';
}
