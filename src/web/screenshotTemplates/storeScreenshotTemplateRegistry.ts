import type { ScreenshotStore } from './screenshotStores.js';

export const VARIANT3_IOS_CANVAS_WIDTH = 1284;
export const VARIANT3_IOS_CANVAS_HEIGHT = 2778;
export const VARIANT3_PLAY_STORE_CANVAS_WIDTH = 1080;
export const VARIANT3_PLAY_STORE_CANVAS_HEIGHT = 1920;

export const SCREENSHOT_TEMPLATE_SLOTS = [1, 2, 3, 4, 5, 6] as const;

export type ScreenshotTemplateSlot = (typeof SCREENSHOT_TEMPLATE_SLOTS)[number];

export type ScreenshotTemplatePalette = {
  accent: string;
  bgDark: string;
  bgInk: string;
  cream: string;
  muted: string;
  phoneColor: string;
};

export type ScreenshotTemplatePaletteField = {
  key: keyof ScreenshotTemplatePalette;
  label: string;
  description: string;
};

const IOS_HERO_PALETTE_FIELDS: ScreenshotTemplatePaletteField[] = [
  { key: 'accent', label: 'Accent', description: 'Poster arka planı ve vurgu çizgileri.' },
  { key: 'bgInk', label: 'Ink', description: 'Koyu yazılar ve ikincil şekiller.' },
  { key: 'phoneColor', label: 'Phone', description: 'Telefon gövde rengi.' },
];

const IOS_POSTER_PALETTE_FIELDS: ScreenshotTemplatePaletteField[] = [
  { key: 'accent', label: 'Accent', description: 'Poster arka planı ve vurgu çizgileri.' },
  { key: 'cream', label: 'Cream', description: 'Açık yüzeyler ve açık başlık rengi.' },
  { key: 'phoneColor', label: 'Phone', description: 'Telefon gövde rengi.' },
];

const PLAY_STORE_PALETTE_FIELDS: ScreenshotTemplatePaletteField[] = [
  { key: 'accent', label: 'Accent', description: 'Android vurgu rengi ve aktif chip yüzeyleri.' },
  { key: 'bgInk', label: 'Ink', description: 'Kartlar ve ikinci seviye koyu bloklar.' },
  { key: 'cream', label: 'Light', description: 'Açık kartlar ve açık metin yüzeyi.' },
  { key: 'muted', label: 'Muted', description: 'İkincil metin ve soft dekor tonları.' },
];

const DEFAULT_IOS_PALETTE: ScreenshotTemplatePalette = {
  accent: '#f38219',
  bgDark: '#161515',
  bgInk: '#232324',
  cream: '#f7f2ed',
  muted: '#d7dadd',
  phoneColor: '#000000',
};

const DEFAULT_PLAY_STORE_PALETTE: ScreenshotTemplatePalette = { ...DEFAULT_IOS_PALETTE };

export function getScreenshotTemplateCanvasSize(store: ScreenshotStore): {
  width: number;
  height: number;
} {
  return store === 'play_store'
    ? { width: VARIANT3_PLAY_STORE_CANVAS_WIDTH, height: VARIANT3_PLAY_STORE_CANVAS_HEIGHT }
    : { width: VARIANT3_IOS_CANVAS_WIDTH, height: VARIANT3_IOS_CANVAS_HEIGHT };
}

export function getScreenshotTemplateId(store: ScreenshotStore): string {
  return store === 'play_store' ? 'variant3-play-store' : 'variant3-ios';
}

export function getScreenshotTemplateDefaultPalette(store: ScreenshotStore): ScreenshotTemplatePalette {
  return store === 'play_store'
    ? { ...DEFAULT_PLAY_STORE_PALETTE }
    : { ...DEFAULT_IOS_PALETTE };
}

export function getScreenshotTemplatePaletteFields(
  store: ScreenshotStore,
  slot?: ScreenshotTemplateSlot
): ScreenshotTemplatePaletteField[] {
  if (store === 'play_store') return PLAY_STORE_PALETTE_FIELDS;
  if (slot === 1) {
    return IOS_HERO_PALETTE_FIELDS.filter((field) => field.key !== 'bgInk');
  }
  if (slot === 2) {
    return IOS_HERO_PALETTE_FIELDS.filter((field) => field.key !== 'accent');
  }
  if (slot != null && slot >= 3) return IOS_POSTER_PALETTE_FIELDS;
  return IOS_HERO_PALETTE_FIELDS;
}

export function resolveScreenshotTemplatePalette(
  store: ScreenshotStore,
  input?: Partial<ScreenshotTemplatePalette> | null
): ScreenshotTemplatePalette {
  const defaults = store === 'play_store' ? DEFAULT_PLAY_STORE_PALETTE : DEFAULT_IOS_PALETTE;
  return {
    accent: normalizeHexColor(input?.accent, defaults.accent),
    bgDark: normalizeHexColor(input?.bgDark, defaults.bgDark),
    bgInk: normalizeHexColor(input?.bgInk, defaults.bgInk),
    cream: normalizeHexColor(input?.cream, defaults.cream),
    muted: normalizeHexColor(input?.muted, defaults.muted),
    phoneColor: normalizeHexColor(input?.phoneColor, defaults.phoneColor),
  };
}

function normalizeHexColor(value: string | undefined, fallback: string): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) return fallback;
  const withHash = normalized.startsWith('#') ? normalized : `#${normalized}`;
  return /^#[0-9a-fA-F]{6}$/.test(withHash) ? withHash.toLowerCase() : fallback;
}
