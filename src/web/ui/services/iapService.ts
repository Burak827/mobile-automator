import { api } from '../lib/api';
import type { IapListPayload, StoreId } from '../types';

export async function fetchIaps(appId: number): Promise<IapListPayload> {
  return api<IapListPayload>(`/api/apps/${appId}/iaps`);
}

export async function requestIapTranslationStream(
  appId: number,
  store: StoreId
): Promise<Response> {
  return fetch(`/api/apps/${appId}/generate-iap-translations?store=${encodeURIComponent(store)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ store }),
  });
}
