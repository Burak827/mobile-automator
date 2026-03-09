import {
  SCREENSHOT_TEMPLATE_SLOTS,
  type ScreenshotTemplateSlot,
} from './storeScreenshotTemplateRegistry.js';
import type { ScreenshotStore } from './screenshotStores.js';

export type ScreenshotTitleTypography = {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
};

export type ScreenshotSlotTitleTypographyMap = Record<ScreenshotTemplateSlot, ScreenshotTitleTypography>;

export const DEFAULT_SCREENSHOT_TITLE_FONT_FAMILY = 'Archivo';

const DEFAULT_IOS_TITLE_TYPOGRAPHY: ScreenshotSlotTitleTypographyMap = {
  1: { fontFamily: DEFAULT_SCREENSHOT_TITLE_FONT_FAMILY, fontSize: 86, fontWeight: 815 },
  2: { fontFamily: DEFAULT_SCREENSHOT_TITLE_FONT_FAMILY, fontSize: 68, fontWeight: 720 },
  3: { fontFamily: DEFAULT_SCREENSHOT_TITLE_FONT_FAMILY, fontSize: 82, fontWeight: 790 },
  4: { fontFamily: DEFAULT_SCREENSHOT_TITLE_FONT_FAMILY, fontSize: 82, fontWeight: 790 },
  5: { fontFamily: DEFAULT_SCREENSHOT_TITLE_FONT_FAMILY, fontSize: 82, fontWeight: 790 },
  6: { fontFamily: DEFAULT_SCREENSHOT_TITLE_FONT_FAMILY, fontSize: 82, fontWeight: 790 },
};

const DEFAULT_PLAY_STORE_TITLE_TYPOGRAPHY: ScreenshotSlotTitleTypographyMap = {
  1: { fontFamily: DEFAULT_SCREENSHOT_TITLE_FONT_FAMILY, fontSize: 68, fontWeight: 780 },
  2: { fontFamily: DEFAULT_SCREENSHOT_TITLE_FONT_FAMILY, fontSize: 68, fontWeight: 780 },
  3: { fontFamily: DEFAULT_SCREENSHOT_TITLE_FONT_FAMILY, fontSize: 68, fontWeight: 780 },
  4: { fontFamily: DEFAULT_SCREENSHOT_TITLE_FONT_FAMILY, fontSize: 68, fontWeight: 780 },
  5: { fontFamily: DEFAULT_SCREENSHOT_TITLE_FONT_FAMILY, fontSize: 68, fontWeight: 780 },
  6: { fontFamily: DEFAULT_SCREENSHOT_TITLE_FONT_FAMILY, fontSize: 68, fontWeight: 780 },
};

export function getDefaultScreenshotTitleTypography(
  store: ScreenshotStore,
  slot: ScreenshotTemplateSlot
): ScreenshotTitleTypography {
  const defaults = store === 'play_store'
    ? DEFAULT_PLAY_STORE_TITLE_TYPOGRAPHY
    : DEFAULT_IOS_TITLE_TYPOGRAPHY;
  return { ...defaults[slot] };
}

export function createDefaultScreenshotTitleTypographyMap(
  store: ScreenshotStore
): ScreenshotSlotTitleTypographyMap {
  const next = {} as ScreenshotSlotTitleTypographyMap;
  for (const slot of SCREENSHOT_TEMPLATE_SLOTS) {
    next[slot] = getDefaultScreenshotTitleTypography(store, slot);
  }
  return next;
}

export function resolveScreenshotTitleTypography(
  store: ScreenshotStore,
  slot: ScreenshotTemplateSlot,
  value?: Partial<ScreenshotTitleTypography> | null
): ScreenshotTitleTypography {
  const fallback = getDefaultScreenshotTitleTypography(store, slot);
  const fontFamily = normalizeFontFamily(value?.fontFamily, fallback.fontFamily);
  return {
    fontFamily,
    fontSize: positiveFiniteNumber(value?.fontSize, fallback.fontSize),
    fontWeight: positiveFiniteNumber(value?.fontWeight, fallback.fontWeight),
  };
}

export function resolveScreenshotTitleTypographyMap(
  store: ScreenshotStore,
  value?: Partial<Record<ScreenshotTemplateSlot, Partial<ScreenshotTitleTypography>>> | null
): ScreenshotSlotTitleTypographyMap {
  const next = {} as ScreenshotSlotTitleTypographyMap;
  const raw = value ?? {};
  for (const slot of SCREENSHOT_TEMPLATE_SLOTS) {
    next[slot] = resolveScreenshotTitleTypography(store, slot, raw[slot]);
  }
  return next;
}

function normalizeFontFamily(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().replace(/^['"]+|['"]+$/g, '');
  return normalized.length > 0 ? normalized : fallback;
}

function positiveFiniteNumber(value: unknown, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return numeric;
}
