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
export const IOS_SCREENSHOT_DEVICE_FAMILIES = [
  {
    id: 'iphone',
    label: 'iPhone',
  },
  {
    id: 'ipad',
    label: 'iPad',
  },
] as const;
export type IosScreenshotDeviceFamily = (typeof IOS_SCREENSHOT_DEVICE_FAMILIES)[number]['id'];

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

export function parseIosScreenshotDeviceFamily(
  raw: string | undefined
): IosScreenshotDeviceFamily | undefined {
  if (!raw) return undefined;
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'ipad') return 'ipad';
  if (normalized === 'iphone') return 'iphone';
  return undefined;
}

export function resolveIosScreenshotDeviceFamily(
  value: unknown
): IosScreenshotDeviceFamily {
  return parseIosScreenshotDeviceFamily(typeof value === 'string' ? value : undefined) ?? 'iphone';
}

export function getIosScreenshotDeviceFamilyLabel(
  family: IosScreenshotDeviceFamily
): string {
  return IOS_SCREENSHOT_DEVICE_FAMILIES.find((item) => item.id === family)?.label ?? family;
}

export function getScreenshotTargetLabel(
  store: ScreenshotStore,
  iosDeviceFamily?: IosScreenshotDeviceFamily
): string {
  if (store !== 'ios') return getScreenshotStoreLabel(store);
  return `iOS ${getIosScreenshotDeviceFamilyLabel(resolveIosScreenshotDeviceFamily(iosDeviceFamily))}`;
}
