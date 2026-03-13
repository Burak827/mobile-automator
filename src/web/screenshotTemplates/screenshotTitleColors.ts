import {
  SCREENSHOT_TEMPLATE_SLOTS,
  type ScreenshotTemplatePalette,
  type ScreenshotTemplateSlot,
} from './storeScreenshotTemplateRegistry.js';
import type { ScreenshotStore } from './screenshotStores.js';

export type ScreenshotSlotTitleExtraLineColorsMap = Record<ScreenshotTemplateSlot, string[]>;
export const MAX_SCREENSHOT_TITLE_EXTRA_LINE_COLORS = 5;

export function createEmptyScreenshotTitleExtraLineColorsMap(): ScreenshotSlotTitleExtraLineColorsMap {
  return {
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
    6: [],
  };
}

export function getDefaultScreenshotTitlePrimaryColor(
  store: ScreenshotStore,
  slot: ScreenshotTemplateSlot,
  palette: ScreenshotTemplatePalette
): string {
  void store;
  void slot;
  return palette.bgInk;
}

export function syncScreenshotTitleExtraLineColors(
  extraLineColors: readonly string[] | undefined,
  lineCount: number,
  primaryColor: string
): string[] {
  const targetCount = Math.max(
    0,
    Math.min(MAX_SCREENSHOT_TITLE_EXTRA_LINE_COLORS, lineCount - 1)
  );
  const next = Array.isArray(extraLineColors)
    ? [...extraLineColors].slice(0, MAX_SCREENSHOT_TITLE_EXTRA_LINE_COLORS)
    : [];

  if (next.length > targetCount) {
    return next.slice(0, targetCount);
  }

  while (next.length < targetCount) {
    next.push(primaryColor);
  }

  return next.map((color) => normalizeHexColor(color, primaryColor));
}

export function resolveScreenshotTitleLineColors(
  store: ScreenshotStore,
  slot: ScreenshotTemplateSlot,
  palette: ScreenshotTemplatePalette,
  lineCount: number,
  extraLineColors?: readonly string[]
): string[] {
  const primaryColor = getDefaultScreenshotTitlePrimaryColor(store, slot, palette);
  const syncedExtraColors = syncScreenshotTitleExtraLineColors(
    extraLineColors,
    lineCount,
    primaryColor
  );
  const overflowCount = Math.max(0, lineCount - 1 - syncedExtraColors.length);
  return [
    primaryColor,
    ...syncedExtraColors,
    ...Array.from({ length: overflowCount }, () => primaryColor),
  ];
}

export function resolveStoredScreenshotTitleExtraLineColorsMap(
  value: unknown
): ScreenshotSlotTitleExtraLineColorsMap {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const next = createEmptyScreenshotTitleExtraLineColorsMap();

  for (const slot of SCREENSHOT_TEMPLATE_SLOTS) {
    const entry = raw[String(slot)];
    next[slot] = Array.isArray(entry)
      ? entry
          .slice(0, MAX_SCREENSHOT_TITLE_EXTRA_LINE_COLORS)
          .map((item) => normalizeHexColor(item, '#000000'))
          .filter(Boolean)
      : [];
  }

  return next;
}

function normalizeHexColor(value: unknown, fallback: string): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) return fallback;
  const withHash = normalized.startsWith('#') ? normalized : `#${normalized}`;
  return /^#[0-9a-fA-F]{6}$/.test(withHash) ? withHash.toLowerCase() : fallback;
}
