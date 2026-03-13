import {
  SCREENSHOT_TEMPLATE_SLOTS,
  type ScreenshotTemplateSlot,
} from './storeScreenshotTemplateRegistry.js';

export type ScreenshotSlotTitleCenterMap = Record<ScreenshotTemplateSlot, boolean>;

export function createDefaultScreenshotTitleCenterMap(): ScreenshotSlotTitleCenterMap {
  return SCREENSHOT_TEMPLATE_SLOTS.reduce((acc, slot) => {
    acc[slot] = false;
    return acc;
  }, {} as ScreenshotSlotTitleCenterMap);
}

export function resolveStoredScreenshotTitleCenterMap(
  value: unknown
): ScreenshotSlotTitleCenterMap {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const next = createDefaultScreenshotTitleCenterMap();

  for (const slot of SCREENSHOT_TEMPLATE_SLOTS) {
    next[slot] = parseBoolean(raw[String(slot)], false);
  }

  return next;
}

export function parseScreenshotTitleCenterInput(value: unknown, fallback = false): boolean {
  return parseBoolean(value, fallback);
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  }
  return fallback;
}
