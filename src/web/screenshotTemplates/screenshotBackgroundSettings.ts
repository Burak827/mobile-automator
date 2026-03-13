import {
  SCREENSHOT_TEMPLATE_SLOTS,
  type ScreenshotTemplateSlot,
} from './storeScreenshotTemplateRegistry.js';

export type ScreenshotBackgroundSettings = {
  topStop: number;
  midStop: number;
  bottomStop: number;
  midMix: number;
  bottomMix: number;
};

export type ScreenshotSlotBackgroundSettingsMap = Record<
  ScreenshotTemplateSlot,
  ScreenshotBackgroundSettings
>;

export const DEFAULT_SCREENSHOT_BACKGROUND_SETTINGS: ScreenshotBackgroundSettings = {
  topStop: 0,
  midStop: 0.44,
  bottomStop: 1,
  midMix: 0.76,
  bottomMix: 0.58,
};

export function resolveScreenshotBackgroundSettings(
  value?: Partial<ScreenshotBackgroundSettings> | null
): ScreenshotBackgroundSettings {
  const topStop = clampUnit(Number(value?.topStop ?? DEFAULT_SCREENSHOT_BACKGROUND_SETTINGS.topStop));
  const bottomStop = clampRange(
    Number(value?.bottomStop ?? DEFAULT_SCREENSHOT_BACKGROUND_SETTINGS.bottomStop),
    topStop,
    1
  );
  const midStop = clampRange(
    Number(value?.midStop ?? DEFAULT_SCREENSHOT_BACKGROUND_SETTINGS.midStop),
    topStop,
    bottomStop
  );

  return {
    topStop,
    midStop,
    bottomStop,
    midMix: clampUnit(Number(value?.midMix ?? DEFAULT_SCREENSHOT_BACKGROUND_SETTINGS.midMix)),
    bottomMix: clampUnit(
      Number(value?.bottomMix ?? DEFAULT_SCREENSHOT_BACKGROUND_SETTINGS.bottomMix)
    ),
  };
}

export function createDefaultScreenshotBackgroundSettingsMap(): ScreenshotSlotBackgroundSettingsMap {
  return SCREENSHOT_TEMPLATE_SLOTS.reduce((acc, slot) => {
    acc[slot] = resolveScreenshotBackgroundSettings(DEFAULT_SCREENSHOT_BACKGROUND_SETTINGS);
    return acc;
  }, {} as ScreenshotSlotBackgroundSettingsMap);
}

export function resolveStoredScreenshotBackgroundSettingsMap(
  value: unknown
): ScreenshotSlotBackgroundSettingsMap {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const next = createDefaultScreenshotBackgroundSettingsMap();

  for (const slot of SCREENSHOT_TEMPLATE_SLOTS) {
    const entry = raw[String(slot)];
    next[slot] =
      entry && typeof entry === 'object'
        ? resolveScreenshotBackgroundSettings(entry as Partial<ScreenshotBackgroundSettings>)
        : resolveScreenshotBackgroundSettings(DEFAULT_SCREENSHOT_BACKGROUND_SETTINGS);
  }

  return next;
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function clampRange(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
