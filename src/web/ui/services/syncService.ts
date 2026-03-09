import { api } from '../lib/api';
import type { SyncResponse } from '../types';

export async function syncAppLocales(
  appId: number,
  storeScope: 'both' | 'app_store' | 'play_store'
): Promise<SyncResponse> {
  return api<SyncResponse>(`/api/apps/${appId}/locales/sync`, {
    method: 'POST',
    body: JSON.stringify({ storeScope }),
  });
}
