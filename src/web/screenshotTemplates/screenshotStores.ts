export const SCREENSHOT_STORES = [
  {
    id: 'ios',
    label: 'iOS',
    pathToken: 'ios',
    endpointSegment: 'ios',
  },
  {
    id: 'play_store',
    label: 'Play Store',
    pathToken: 'play-store',
    endpointSegment: 'play-store',
  },
] as const;

export type ScreenshotStore = (typeof SCREENSHOT_STORES)[number]['id'];

export function parseScreenshotStore(raw: string | undefined): ScreenshotStore | undefined {
  if (!raw) return undefined;
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'ios') return 'ios';
  if (normalized === 'play_store' || normalized === 'play-store') return 'play_store';
  return undefined;
}

export function getScreenshotStoreLabel(store: ScreenshotStore): string {
  return SCREENSHOT_STORES.find((item) => item.id === store)?.label ?? store;
}

export function getScreenshotStorePathToken(store: ScreenshotStore): string {
  return SCREENSHOT_STORES.find((item) => item.id === store)?.pathToken ?? store;
}

export function getScreenshotStoreEndpointSegment(store: ScreenshotStore): string {
  return SCREENSHOT_STORES.find((item) => item.id === store)?.endpointSegment ?? store;
}
