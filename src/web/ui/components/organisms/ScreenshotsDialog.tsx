import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import JSZip from 'jszip';
import { useDialogController } from '../../hooks/useDialogController';
import Button from '../atoms/Button';
import {
  buildTitleLines,
  type ScreenshotTitleTemplateContext,
  drawStoreScreenshotToContext,
  type ScreenshotCanvasImageLoader,
} from '../../../screenshotTemplates/storeScreenshotCanvas';
import {
  DEFAULT_PROCEDURAL_CAMERA_MODE,
  DEFAULT_PROCEDURAL_CAMERA_SETTINGS,
  DEFAULT_IOS_HERO_PHONE_LOCATION,
  DEFAULT_IOS_HERO_PHONE_POSE,
  getDefaultProceduralCameraSettings,
  getDefaultProceduralDeviceShape,
  getDefaultTitleTopPadding,
  proceduralKeyLightPositionFromSettings,
  resolveProceduralCameraMode,
  resolveProceduralCameraSettings,
  resolveIosHeroPhoneLocation,
  resolveIosHeroPhonePose,
  resolveProceduralDeviceShapeForStore,
  resolveProceduralKeyLightSettings,
  resolveProceduralLightPosition,
  type IosHeroPhonePose,
  type IosHeroPhoneShape,
  type ProceduralCameraMode,
  type ProceduralCameraSettings,
  type ProceduralDeviceLocation,
  type ProceduralKeyLightSettings,
  type ProceduralLightPosition,
} from '../../../screenshotTemplates/proceduralDeviceConfig';
import {
  createDefaultScreenshotTitleTypographyMap,
  resolveScreenshotTitleTypography,
  type ScreenshotSlotTitleTypographyMap,
  type ScreenshotTitleTypography,
} from '../../../screenshotTemplates/screenshotTitleTypography';
import {
  createDefaultScreenshotTitleCenterMap,
  parseScreenshotTitleCenterInput,
  resolveStoredScreenshotTitleCenterMap,
  type ScreenshotSlotTitleCenterMap,
} from '../../../screenshotTemplates/screenshotTitleAlignment';
import {
  createEmptyScreenshotTitleExtraLineColorsMap,
  getDefaultScreenshotTitlePrimaryColor,
  MAX_SCREENSHOT_TITLE_EXTRA_LINE_COLORS,
  resolveScreenshotTitleLineColors,
  resolveStoredScreenshotTitleExtraLineColorsMap,
  syncScreenshotTitleExtraLineColors,
  type ScreenshotSlotTitleExtraLineColorsMap,
} from '../../../screenshotTemplates/screenshotTitleColors';
import {
  createDefaultScreenshotBackgroundSettingsMap,
  resolveScreenshotBackgroundSettings,
  resolveStoredScreenshotBackgroundSettingsMap,
  type ScreenshotBackgroundSettings,
  type ScreenshotSlotBackgroundSettingsMap,
} from '../../../screenshotTemplates/screenshotBackgroundSettings';
import {
  DEFAULT_SLOT_1_SBE_SETTINGS,
  getDefaultSlotSbeSettings,
  resolveSlot1SbeSettings,
  type Slot1SbeSettings,
} from '../../../screenshotTemplates/slot1Sbe';
import {
  getActiveScreenshotTemplateSlots,
  getScreenshotTemplateCanvasSize,
  getScreenshotTemplateDefaultPalette,
  getScreenshotTemplatePaletteFields,
  resolveScreenshotTemplatePalette,
  SCREENSHOT_TEMPLATE_SLOTS,
  type ScreenshotTemplatePalette,
  type ScreenshotTemplateSlot,
} from '../../../screenshotTemplates/storeScreenshotTemplateRegistry';
import {
  IOS_SCREENSHOT_DEVICE_FAMILIES,
  SCREENSHOT_STORES,
  getIosScreenshotDeviceFamilyLabel,
  getScreenshotStorePathToken,
  resolveIosScreenshotDeviceFamily,
  type IosScreenshotDeviceFamily,
  type ScreenshotStore,
} from '../../../screenshotTemplates/screenshotStores';
import { createBrowserCanvasImageLoader } from '../../lib/browserCanvasImageLoader';
import { GOOGLE_FONT_FAMILIES } from '../../lib/googleFontsCatalog';
import { ensureGoogleFontsLoaded } from '../../lib/googleFontsLoader';
import type { AIProvider } from '../../types';
import {
  renderIosProceduralHeroComposite,
} from '../../lib/iosProceduralHeroRenderer';

export type ScreenshotRenderedSlotPayload = {
  slot: ScreenshotTemplateSlot;
  title: string;
  renderedImageBase64?: string | null;
  sourceImageBase64?: string | null;
  sourceFileName?: string | null;
  sourceMimeType?: string | null;
  rendererMode: 'canvas-2d' | 'procedural-three';
  palette: ScreenshotTemplatePalette;
  titleTypography: ScreenshotTitleTypography;
  titleExtraLineColors: string[];
  titleLineGap: number;
  titleTopPadding: number;
  titleCenter?: boolean;
};

export type ScreenshotLocaleBatchPayload = {
  locale: string;
  renderedSlots: ScreenshotRenderedSlotPayload[];
};

export type ScreenshotTitleTranslationsMap = Record<
  string,
  Partial<Record<ScreenshotTemplateSlot, string>>
>;

export type ScreenshotTitleTranslationGeneratePayload = {
  sourceLocale: string;
  sourceTitles: Partial<Record<ScreenshotTemplateSlot, string>>;
  locales: string[];
  verify?: boolean;
  masterPrompt?: string;
  provider?: AIProvider;
};

export type ScreenshotDialogStartPayload = {
  store: ScreenshotStore;
  iosDeviceFamily?: IosScreenshotDeviceFamily;
  locale: string;
  slot: ScreenshotTemplateSlot;
  title: string;
  file?: File | null;
  renderedImageBase64?: string | null;
  rendererMode?: 'canvas-2d' | 'procedural-three';
  palette: ScreenshotTemplatePalette;
  slotPalettes: Partial<Record<ScreenshotTemplateSlot, ScreenshotTemplatePalette>>;
  slotTitles: Partial<Record<ScreenshotTemplateSlot, string>>;
  slotTitleExtraLineColors: Partial<Record<ScreenshotTemplateSlot, string[]>>;
  slotTitleLineGaps: Partial<Record<ScreenshotTemplateSlot, number>>;
  slotTitleTopPaddings: Partial<Record<ScreenshotTemplateSlot, number>>;
  slotTitleCenters: Partial<Record<ScreenshotTemplateSlot, boolean>>;
  titleTypography: ScreenshotTitleTypography;
  slotTitleTypography: Partial<Record<ScreenshotTemplateSlot, ScreenshotTitleTypography>>;
  slotBackgroundSettings: Partial<Record<ScreenshotTemplateSlot, ScreenshotBackgroundSettings>>;
  heroPhonePose: IosHeroPhonePose | null;
  heroPhoneShape: IosHeroPhoneShape | null;
  heroPhoneLocation: ProceduralDeviceLocation | null;
  heroKeyLightPosition: ProceduralLightPosition | null;
  heroKeyLightSettings: ProceduralKeyLightSettings | null;
  slotSbeSettings: Partial<Record<ScreenshotTemplateSlot, Slot1SbeSettings>>;
  heroCameraMode: ProceduralCameraMode | null;
  heroCameraSettings: ProceduralCameraSettings | null;
  renderedSlots: ScreenshotRenderedSlotPayload[];
  localeBatches?: ScreenshotLocaleBatchPayload[];
  closeWhenDone?: boolean;
};

export type ScreenshotPresetConfig = {
  palette: ScreenshotTemplatePalette;
  slotPalettes?: Partial<Record<ScreenshotTemplateSlot, ScreenshotTemplatePalette>>;
  slotTitles?: Partial<Record<ScreenshotTemplateSlot, string>>;
  slotTitleExtraLineColors?: Partial<Record<ScreenshotTemplateSlot, string[]>>;
  slotTitleLineGaps?: Partial<Record<ScreenshotTemplateSlot, number>>;
  slotTitleTopPaddings?: Partial<Record<ScreenshotTemplateSlot, number>>;
  slotTitleCenters?: Partial<Record<ScreenshotTemplateSlot, boolean>>;
  slotTitleTypography?: Partial<Record<ScreenshotTemplateSlot, ScreenshotTitleTypography>>;
  slotBackgroundSettings?: Partial<Record<ScreenshotTemplateSlot, ScreenshotBackgroundSettings>>;
  heroPhonePose: IosHeroPhonePose | null;
  heroPhoneShape: IosHeroPhoneShape | null;
  heroPhoneLocation: ProceduralDeviceLocation | null;
  heroKeyLightPosition: ProceduralLightPosition | null;
  heroKeyLightSettings: ProceduralKeyLightSettings | null;
  slotSbeSettings?: Partial<Record<ScreenshotTemplateSlot, Slot1SbeSettings>>;
  heroCameraMode: ProceduralCameraMode | null;
  heroCameraSettings: ProceduralCameraSettings | null;
};

export type ScreenshotPresetMap = Partial<Record<ScreenshotStore, ScreenshotPresetConfig>>;

type Props = {
  appId?: number | null;
  isOpen: boolean;
  isBusy: boolean;
  defaultLocale: string;
  defaultStore?: ScreenshotStore;
  availableAiProviders?: AIProvider[];
  defaultAiProvider?: AIProvider;
  presets?: ScreenshotPresetMap;
  titleTranslations?: ScreenshotTitleTranslationsMap;
  onClose: () => void;
  onPresetChange?: (store: ScreenshotStore, preset: ScreenshotPresetConfig) => Promise<void> | void;
  onTitleTranslationsChange?: (translations: ScreenshotTitleTranslationsMap) => Promise<void> | void;
  onGenerateTitleTranslations?: (
    payload: ScreenshotTitleTranslationGeneratePayload
  ) => Promise<ScreenshotTitleTranslationsMap | void> | void;
  onResolveLocaleAppNames?: (
    store: ScreenshotStore
  ) => Promise<Record<string, string>> | Record<string, string>;
  onStart: (payload: ScreenshotDialogStartPayload) => Promise<void> | void;
};

type PreviewCardProps = {
  store: ScreenshotStore;
  iosDeviceFamily?: IosScreenshotDeviceFamily;
  slot: ScreenshotTemplateSlot;
  title: string;
  titleTemplateContext?: ScreenshotTitleTemplateContext | null;
  titleTypography: ScreenshotTitleTypography;
  titleExtraLineColors: string[];
  titleLineGap: number;
  titleTopPadding: number;
  titleCenter: boolean;
  backgroundSettings: ScreenshotBackgroundSettings;
  palette: ScreenshotTemplatePalette;
  heroPhonePose: IosHeroPhonePose | null;
  heroPhoneShape: IosHeroPhoneShape | null;
  heroPhoneLocation: ProceduralDeviceLocation | null;
  heroKeyLightPosition: ProceduralLightPosition | null;
  heroKeyLightSettings: ProceduralKeyLightSettings | null;
  slot1SbeSettings: Slot1SbeSettings | null;
  heroCameraMode: ProceduralCameraMode | null;
  heroCameraSettings: ProceduralCameraSettings | null;
  screenshotUrl: string;
  imageLoader: ScreenshotCanvasImageLoader;
  fontLoadVersion: number;
  disabled: boolean;
  selected: boolean;
  onSelect: (slot: ScreenshotTemplateSlot) => void;
};

type PanelKey = 'rotation' | 'color' | 'background' | 'shape' | 'location' | 'light' | 'sbe';
type ScreenshotSlotTitleMap = Record<ScreenshotTemplateSlot, string>;
type ScreenshotSlotPaletteMap = Record<ScreenshotTemplateSlot, ScreenshotTemplatePalette>;
type ScreenshotSlotTitleLineGapMap = Record<ScreenshotTemplateSlot, number>;
type ScreenshotSlotTitleTopPaddingMap = Record<ScreenshotTemplateSlot, number>;
type ScreenshotSlotTitleCenterStateMap = Record<ScreenshotTemplateSlot, boolean>;
type ScreenshotSlotBackgroundSettingsStateMap = Record<ScreenshotTemplateSlot, ScreenshotBackgroundSettings>;
type ScreenshotSlotFileMap = Record<ScreenshotTemplateSlot, File | null>;
type ScreenshotSlotPreviewUrlMap = Record<ScreenshotTemplateSlot, string>;
type ScreenshotSlotPreviewErrorMap = Record<ScreenshotTemplateSlot, string>;
type ScreenshotSlotSbeMap = Partial<Record<ScreenshotTemplateSlot, Slot1SbeSettings>>;
type ScreenshotZipEntry = {
  path: string;
  fileName: string;
  mimeType: string;
};
type ScreenshotZipLocaleMap = Record<
  string,
  Partial<Record<ScreenshotTemplateSlot, ScreenshotZipEntry>>
>;

type ScreenshotLocaleAppNameMap = Record<string, string>;

const PROVIDER_LABEL: Record<AIProvider, string> = {
  openai: 'ChatGPT',
  anthropic: 'Claude Opus',
};
const FALLBACK_AI_PROVIDER: AIProvider = 'openai';
const FALLBACK_AI_PROVIDERS: AIProvider[] = [FALLBACK_AI_PROVIDER];

function formatSlotRangeLabel(slots: ScreenshotTemplateSlot[]): string {
  if (slots.length === 0) return '';
  if (slots.length === 1) return String(slots[0]);
  return `${slots[0]}-${slots[slots.length - 1]}`;
}

function normalizeLocaleToken(locale: string): string {
  return locale.trim().replace(/_/g, '-').toLowerCase();
}

function resolveZipMimeType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

function parseScreenshotZipManifest(archive: JSZip): ScreenshotZipLocaleMap {
  const result: ScreenshotZipLocaleMap = {};
  archive.forEach((relativePath, entry) => {
    if (entry.dir) return;
    const normalizedPath = relativePath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    if (!normalizedPath) return;
    const parts = normalizedPath.split('/').filter(Boolean);
    if (parts.length < 2) return;
    const fileName = parts[parts.length - 1] ?? '';
    const slotToken = fileName.replace(/\.[^.]+$/, '');
    const slotNumeric = Number(slotToken);
    if (!SCREENSHOT_TEMPLATE_SLOTS.includes(slotNumeric as ScreenshotTemplateSlot)) return;
    const locale = parts[parts.length - 2] ?? '';
    if (!locale) return;
    if (!result[locale]) {
      result[locale] = {};
    }
    result[locale][slotNumeric as ScreenshotTemplateSlot] = {
      path: relativePath,
      fileName,
      mimeType: resolveZipMimeType(fileName),
    };
  });
  return result;
}

function findZipLocaleKey(
  localeMap: ScreenshotZipLocaleMap | undefined,
  locale: string
): string | null {
  if (!localeMap) return null;
  const normalized = locale.trim();
  if (!normalized) return null;
  if (localeMap[normalized]) return normalized;
  const lower = normalized.toLowerCase();
  const matched = Object.keys(localeMap).find((key) => key.toLowerCase() === lower);
  return matched ?? null;
}

function getZipEntryForSlot(
  entries: Partial<Record<ScreenshotTemplateSlot, ScreenshotZipEntry>> | undefined,
  slot: ScreenshotTemplateSlot
): ScreenshotZipEntry | null {
  if (!entries) return null;
  if (slot === 1 || slot === 2) {
    return entries[1] ?? entries[2] ?? null;
  }
  const fivePackKey = (slot - 1) as ScreenshotTemplateSlot;
  return entries[fivePackKey] ?? entries[slot] ?? null;
}

function createEmptySlotTitleMap(): ScreenshotSlotTitleMap {
  return {
    1: '',
    2: '',
    3: '',
    4: '',
    5: '',
    6: '',
  };
}

function resolveLocaleTitleEntry(
  translations: ScreenshotTitleTranslationsMap | undefined,
  locale: string
): Partial<Record<ScreenshotTemplateSlot, string>> | undefined {
  if (!translations) return undefined;
  const normalizedLocale = normalizeLocaleToken(locale);
  const matchedKeys = Object.keys(translations).filter(
    (key) => normalizeLocaleToken(key) === normalizedLocale
  );
  if (matchedKeys.length === 0) return undefined;
  const sortedKeys = [...matchedKeys].sort((left, right) => {
    const leftScore = left.includes('_') ? 0 : 1;
    const rightScore = right.includes('_') ? 0 : 1;
    return leftScore - rightScore;
  });
  return sortedKeys.reduce<Partial<Record<ScreenshotTemplateSlot, string>>>((acc, key) => {
    return {
      ...acc,
      ...(translations[key] ?? {}),
    };
  }, {});
}

function createTitleMapForLocale(
  translations: ScreenshotTitleTranslationsMap | undefined,
  locale: string,
  fallback?: Partial<Record<ScreenshotTemplateSlot, string>>
): ScreenshotSlotTitleMap {
  const resolved = resolveLocaleTitleEntry(translations, locale) ?? fallback ?? {};
  const next = createEmptySlotTitleMap();
  for (const slot of SCREENSHOT_TEMPLATE_SLOTS) {
    next[slot] = typeof resolved[slot] === 'string' ? resolved[slot] ?? '' : '';
  }
  return next;
}

function createEmptyLocaleAppNameMapByStore(): Record<ScreenshotStore, ScreenshotLocaleAppNameMap> {
  return {
    ios: {},
    play_store: {},
  };
}

function resolveLocaleAppNameFromMap(
  localeMap: ScreenshotLocaleAppNameMap | undefined,
  locale: string,
  fallbackLocale?: string
): string {
  if (!localeMap) return '';
  const normalizedLocale = normalizeLocaleToken(locale);
  const exactKey = Object.keys(localeMap).find(
    (entry) => normalizeLocaleToken(entry) === normalizedLocale
  );
  if (exactKey) {
    return localeMap[exactKey]?.trim() ?? '';
  }
  if (fallbackLocale) {
    const fallbackKey = Object.keys(localeMap).find(
      (entry) => normalizeLocaleToken(entry) === normalizeLocaleToken(fallbackLocale)
    );
    if (fallbackKey) {
      return localeMap[fallbackKey]?.trim() ?? '';
    }
  }
  return '';
}

function mergeScreenshotTitleTranslations(
  base: ScreenshotTitleTranslationsMap | undefined,
  draft: ScreenshotTitleTranslationsMap | undefined
): ScreenshotTitleTranslationsMap {
  const next: ScreenshotTitleTranslationsMap = {};
  for (const source of [base, draft]) {
    if (!source) continue;
    for (const [locale, slotTitles] of Object.entries(source)) {
      next[locale] = {
        ...(next[locale] ?? {}),
        ...(slotTitles ?? {}),
      };
    }
  }
  return next;
}

function createSlotTitleMap(preset?: ScreenshotPresetConfig): ScreenshotSlotTitleMap {
  const next = createEmptySlotTitleMap();
  const raw = preset?.slotTitles ?? {};

  for (const entry of SCREENSHOT_TEMPLATE_SLOTS) {
    next[entry] = typeof raw[entry] === 'string' ? raw[entry] : '';
  }

  return next;
}

function createSlotTitleTypographyMap(
  store: ScreenshotStore,
  preset?: ScreenshotPresetConfig
): ScreenshotSlotTitleTypographyMap {
  return {
    ...createDefaultScreenshotTitleTypographyMap(store),
    ...Object.fromEntries(
      SCREENSHOT_TEMPLATE_SLOTS.map((entry) => [
        entry,
        resolveScreenshotTitleTypography(store, entry, preset?.slotTitleTypography?.[entry]),
      ])
    ),
  } as ScreenshotSlotTitleTypographyMap;
}

function createSlotTitleExtraLineColorsMap(
  preset?: ScreenshotPresetConfig
): ScreenshotSlotTitleExtraLineColorsMap {
  return resolveStoredScreenshotTitleExtraLineColorsMap(preset?.slotTitleExtraLineColors);
}

function createEmptySlotTitleLineGapMap(): ScreenshotSlotTitleLineGapMap {
  return {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
  };
}

function createEmptySlotTitleTopPaddingMap(): ScreenshotSlotTitleTopPaddingMap {
  return {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
  };
}

function createEmptySlotFileMap(): ScreenshotSlotFileMap {
  return {
    1: null,
    2: null,
    3: null,
    4: null,
    5: null,
    6: null,
  };
}

function createEmptySlotPreviewUrlMap(): ScreenshotSlotPreviewUrlMap {
  return {
    1: '',
    2: '',
    3: '',
    4: '',
    5: '',
    6: '',
  };
}

function createEmptySlotPreviewErrorMap(): ScreenshotSlotPreviewErrorMap {
  return {
    1: '',
    2: '',
    3: '',
    4: '',
    5: '',
    6: '',
  };
}

function createDefaultSlotSbeMap(): ScreenshotSlotSbeMap {
  return {
    1: resolveSlot1SbeSettings(getDefaultSlotSbeSettings(1)),
    2: resolveSlot1SbeSettings(getDefaultSlotSbeSettings(2)),
  };
}

function createSlotSbeMap(preset?: ScreenshotPresetConfig): ScreenshotSlotSbeMap {
  const raw = preset?.slotSbeSettings;
  if (raw && typeof raw === 'object') {
    return {
      1: resolveSlot1SbeSettings(raw[1]),
      2: resolveSlot1SbeSettings(raw[2]),
    };
  }
  const legacy = resolveSlot1SbeSettings((preset as { slot1SbeSettings?: Slot1SbeSettings | null } | undefined)?.slot1SbeSettings);
  return {
    1: legacy,
    2: legacy,
  };
}

function createSlotTitleLineGapMap(preset?: ScreenshotPresetConfig): ScreenshotSlotTitleLineGapMap {
  const next = createEmptySlotTitleLineGapMap();
  const raw = preset?.slotTitleLineGaps ?? {};

  for (const entry of SCREENSHOT_TEMPLATE_SLOTS) {
    const numeric = Number(raw[entry]);
    next[entry] = Number.isFinite(numeric) ? numeric : 0;
  }

  return next;
}

function createSlotTitleTopPaddingMap(
  preset?: ScreenshotPresetConfig
): ScreenshotSlotTitleTopPaddingMap {
  const next = createEmptySlotTitleTopPaddingMap();
  const raw = preset?.slotTitleTopPaddings ?? {};

  for (const entry of SCREENSHOT_TEMPLATE_SLOTS) {
    const numeric = Number(raw[entry]);
    next[entry] = Number.isFinite(numeric) ? numeric : 0;
  }

  return next;
}

function createSlotTitleCenterMap(preset?: ScreenshotPresetConfig): ScreenshotSlotTitleCenterStateMap {
  return resolveStoredScreenshotTitleCenterMap(preset?.slotTitleCenters);
}

function createSlotPaletteMap(
  store: ScreenshotStore,
  preset?: ScreenshotPresetConfig
): ScreenshotSlotPaletteMap {
  const fallbackPalette = resolveScreenshotTemplatePalette(store, preset?.palette);
  const raw = preset?.slotPalettes ?? {};
  const next = {} as ScreenshotSlotPaletteMap;

  for (const entry of SCREENSHOT_TEMPLATE_SLOTS) {
    next[entry] = resolveScreenshotTemplatePalette(store, raw[entry] ?? fallbackPalette);
  }

  return next;
}

function createSlotBackgroundSettingsMap(
  preset?: ScreenshotPresetConfig
): ScreenshotSlotBackgroundSettingsStateMap {
  return resolveStoredScreenshotBackgroundSettingsMap(preset?.slotBackgroundSettings);
}

function getScreenshotDraftStorageKey(appId: number, store: ScreenshotStore): string {
  return `mobile-automator:screenshot-preset-draft:${appId}:${store}`;
}

function readScreenshotDraft(
  appId: number | null | undefined,
  store: ScreenshotStore
): ScreenshotPresetConfig | undefined {
  if (!appId || typeof window === 'undefined' || !window.localStorage) return undefined;
  try {
    const raw = window.localStorage.getItem(getScreenshotDraftStorageKey(appId, store));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as ScreenshotPresetConfig;
    return parsed && typeof parsed === 'object' ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function writeScreenshotDraft(
  appId: number | null | undefined,
  store: ScreenshotStore,
  preset: ScreenshotPresetConfig
): void {
  if (!appId || typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(getScreenshotDraftStorageKey(appId, store), JSON.stringify(preset));
  } catch {
    // Ignore storage quota / privacy mode failures.
  }
}

function mergeScreenshotPresetConfig(
  base: ScreenshotPresetConfig | undefined,
  draft: ScreenshotPresetConfig | undefined
): ScreenshotPresetConfig | undefined {
  if (!base && !draft) return undefined;
  if (!base) return draft;
  if (!draft) return base;
  return {
    ...base,
    ...draft,
    palette: draft.palette ?? base.palette,
    slotPalettes: draft.slotPalettes ?? base.slotPalettes,
    slotTitles: draft.slotTitles ?? base.slotTitles,
    slotTitleExtraLineColors: draft.slotTitleExtraLineColors ?? base.slotTitleExtraLineColors,
    slotTitleLineGaps: draft.slotTitleLineGaps ?? base.slotTitleLineGaps,
    slotTitleTopPaddings: draft.slotTitleTopPaddings ?? base.slotTitleTopPaddings,
    slotTitleCenters: draft.slotTitleCenters ?? base.slotTitleCenters,
    slotTitleTypography: draft.slotTitleTypography ?? base.slotTitleTypography,
    slotBackgroundSettings: draft.slotBackgroundSettings ?? base.slotBackgroundSettings,
    heroPhonePose: draft.heroPhonePose ?? base.heroPhonePose,
    heroPhoneShape: draft.heroPhoneShape ?? base.heroPhoneShape,
    heroPhoneLocation: draft.heroPhoneLocation ?? base.heroPhoneLocation,
    heroKeyLightPosition: draft.heroKeyLightPosition ?? base.heroKeyLightPosition,
    heroKeyLightSettings: draft.heroKeyLightSettings ?? base.heroKeyLightSettings,
    slotSbeSettings: draft.slotSbeSettings ?? base.slotSbeSettings,
    heroCameraMode: draft.heroCameraMode ?? base.heroCameraMode,
    heroCameraSettings: draft.heroCameraSettings ?? base.heroCameraSettings,
  };
}

function getSlotPaletteTargetsForKey(
  slot: ScreenshotTemplateSlot,
  key: keyof ScreenshotTemplatePalette
): ScreenshotTemplateSlot[] {
  if (key === 'phoneColor') {
    return [...SCREENSHOT_TEMPLATE_SLOTS];
  }
  if (slot === 1 || slot === 2) {
    if (key === 'accent') {
      return [1, 2];
    }
    return [slot];
  }
  return [slot];
}

function getSlotScreenshotTargets(slot: ScreenshotTemplateSlot): ScreenshotTemplateSlot[] {
  if (slot === 1 || slot === 2) {
    return [1, 2];
  }
  return [slot];
}

function getSlotBackgroundSettingsTargets(slot: ScreenshotTemplateSlot): ScreenshotTemplateSlot[] {
  if (slot === 1 || slot === 2) {
    return [1, 2];
  }
  return [slot];
}

function StampIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <path
        d="M8 4.5c0-1.93 1.57-3.5 3.5-3.5S15 2.57 15 4.5v2.04c0 1.26.5 2.47 1.39 3.36l.43.43c.76.76 1.18 1.8 1.18 2.88V15H5v-1.79c0-1.08.42-2.12 1.18-2.88l.43-.43c.89-.89 1.39-2.1 1.39-3.36V4.5Zm-1 13h10.5a1.5 1.5 0 0 1 0 3H7a1.5 1.5 0 0 1 0-3Z"
        fill="currentColor"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <path
        d="M12 2.5A9.5 9.5 0 1 0 21.5 12 9.51 9.51 0 0 0 12 2.5Zm0 4.25a1.25 1.25 0 1 1-1.25 1.25A1.25 1.25 0 0 1 12 6.75Zm1.5 10.5h-3v-1.5h.75v-4h-1v-1.5H12.5v5.5h1Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ApplyAllButton({
  label,
  disabled,
  onApply,
}: {
  label: string;
  disabled?: boolean;
  onApply: () => void;
}) {
  return (
    <Button
      type="button"
      variant="icon"
      className="screenshots-apply-all-button"
      title="Apply for all slots"
      aria-label={label}
      disabled={disabled}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onApply();
      }}
    >
      <StampIcon />
    </Button>
  );
}

function InfoButton({
  label,
  isOpen,
  onToggle,
}: {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      type="button"
      variant="icon"
      className="screenshots-info-button"
      title={label}
      aria-label={label}
      aria-expanded={isOpen}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
    >
      <InfoIcon />
    </Button>
  );
}

function formatFileSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return '0 KB';
  const kb = size / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Dosya preview icin okunamadi.'));
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.readAsDataURL(file);
  });
}

async function readZipEntryAsDataUrl(archive: JSZip, entryPath: string): Promise<string> {
  const entry = archive.file(entryPath);
  if (!entry) {
    throw new Error(`ZIP içindeki görsel bulunamadı: ${entryPath}`);
  }
  const blob = await entry.async('blob');
  return readFileAsDataUrl(blob);
}

function dataUrlToBase64(dataUrl: string): string | null {
  const [, base64 = ''] = dataUrl.split(',');
  return base64 || null;
}

function drawCanvasError(canvas: HTMLCanvasElement, message: string): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#161515';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#f7f2ed';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 40px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif';
  ctx.fillText('Preview error', canvas.width / 2, canvas.height / 2 - 28);
  ctx.font = '500 24px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif';
  ctx.fillText(message, canvas.width / 2, canvas.height / 2 + 28, canvas.width - 120);
}

const PreviewCanvasCard = memo(function PreviewCanvasCard({
  store,
  iosDeviceFamily,
  slot,
  title,
  titleTemplateContext,
  titleTypography,
  titleExtraLineColors,
  titleLineGap,
  titleTopPadding,
  backgroundSettings,
  palette,
  heroPhonePose,
  heroPhoneShape,
  heroPhoneLocation,
  heroKeyLightPosition,
  heroKeyLightSettings,
  slot1SbeSettings,
  heroCameraMode,
  heroCameraSettings,
  titleCenter,
  screenshotUrl,
  imageLoader,
  fontLoadVersion,
  disabled,
  selected,
  onSelect,
}: PreviewCardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderIdRef = useRef(0);
  const canvasSize = useMemo(
    () => getScreenshotTemplateCanvasSize(store, iosDeviceFamily),
    [iosDeviceFamily, store]
  );
  const previewWidth = canvasSize.width;
  const previewHeight = canvasSize.height;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = previewWidth;
    canvas.height = previewHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderId = ++renderIdRef.current;
    void (async () => {
      try {
        await ensureGoogleFontsLoaded([
          {
            family: titleTypography.fontFamily,
            weights: [titleTypography.fontWeight],
          },
        ]);
        if (renderIdRef.current !== renderId) return;

        if (slot <= 2) {
          const resultCanvas = await renderIosProceduralHeroComposite({
            store,
            slot: slot as 1 | 2,
            title,
            titleTemplateContext,
            titleTypography,
            titleExtraLineColors,
            titleLineGap,
            titleTopPadding,
            titleCenter,
            backgroundSettings,
            palette,
            screenshotUrl,
            imageLoader,
            heroPhonePose,
            heroPhoneShape,
            heroPhoneLocation,
            heroKeyLightPosition,
            heroKeyLightSettings,
            slot1SbeSettings,
            heroCameraMode,
            heroCameraSettings,
            width: previewWidth,
            height: previewHeight,
            previewRuntimeKey: canvas,
          });
          if (renderIdRef.current !== renderId) return;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(resultCanvas, 0, 0, canvas.width, canvas.height);
          return;
        }

        await drawStoreScreenshotToContext(ctx, imageLoader, {
          store,
          iosDeviceFamily,
          slot,
          title,
          titleTemplateContext,
          titleTypography,
          titleExtraLineColors,
          titleLineGap,
          titleTopPadding,
          titleCenter,
          backgroundSettings,
          palette,
          heroPhonePose,
          heroPhoneShape,
          screenshotSource: screenshotUrl || undefined,
        });
      } catch (error) {
        if (renderIdRef.current !== renderId) return;
        drawCanvasError(canvas, error instanceof Error ? error.message : String(error));
      }
    })();

    return () => { /* renderIdRef check guards stale renders */ };
  }, [backgroundSettings, fontLoadVersion, heroCameraMode, heroCameraSettings, heroKeyLightPosition, heroKeyLightSettings, heroPhoneLocation, heroPhonePose, heroPhoneShape, imageLoader, iosDeviceFamily, palette, previewHeight, previewWidth, screenshotUrl, slot, slot1SbeSettings, store, title, titleCenter, titleExtraLineColors, titleLineGap, titleTemplateContext, titleTopPadding, titleTypography]);

  return (
    <button
      type="button"
      className={`screenshots-thumb-card${selected ? ' selected' : ''}`}
      style={{ aspectRatio: `${previewWidth} / ${previewHeight}` }}
      onClick={() => onSelect(slot)}
      disabled={disabled}
    >
      <span className="screenshots-thumb-label">Slot {slot}</span>
      <canvas ref={canvasRef} className="screenshots-live-frame thumb" />
    </button>
  );
});
PreviewCanvasCard.displayName = 'PreviewCanvasCard';

export default function ScreenshotsDialog({
  appId,
  isOpen,
  isBusy,
  defaultLocale,
  defaultStore = 'ios',
  availableAiProviders = FALLBACK_AI_PROVIDERS,
  defaultAiProvider = FALLBACK_AI_PROVIDER,
  presets,
  titleTranslations,
  onClose,
  onPresetChange,
  onTitleTranslationsChange,
  onGenerateTitleTranslations,
  onResolveLocaleAppNames,
  onStart,
}: Props) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const resizePointerIdRef = useRef<number | null>(null);
  const titleInfoPopoverRef = useRef<HTMLDivElement | null>(null);
  const titleTranslationProviders = useMemo<AIProvider[]>(
    () => (availableAiProviders.length > 0 ? [...availableAiProviders] : FALLBACK_AI_PROVIDERS),
    [availableAiProviders]
  );
  const resolvedDefaultTitleTranslationProvider = useMemo<AIProvider>(
    () =>
      titleTranslationProviders.includes(defaultAiProvider)
        ? defaultAiProvider
        : titleTranslationProviders[0] ?? FALLBACK_AI_PROVIDER,
    [defaultAiProvider, titleTranslationProviders]
  );
  const [store, setStore] = useState<ScreenshotStore>('ios');
  const [slot, setSlot] = useState<ScreenshotTemplateSlot>(1);
  const [sourceLocale, setSourceLocale] = useState<string>('en_US');
  const [locale, setLocale] = useState<string>('en-US');
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isTitleInfoOpen, setIsTitleInfoOpen] = useState(false);
  const [iosDeviceFamily, setIosDeviceFamily] = useState<IosScreenshotDeviceFamily>('iphone');
  const [titleTranslationProvider, setTitleTranslationProvider] = useState<AIProvider>(
    resolvedDefaultTitleTranslationProvider
  );
  const [titleTranslationsState, setTitleTranslationsState] = useState<ScreenshotTitleTranslationsMap>({});
  const [localeAppNamesByStore, setLocaleAppNamesByStore] = useState<
    Record<ScreenshotStore, ScreenshotLocaleAppNameMap>
  >(createEmptyLocaleAppNameMapByStore());
  const [titlesByStore, setTitlesByStore] = useState<Record<ScreenshotStore, ScreenshotSlotTitleMap>>({
    ios: createEmptySlotTitleMap(),
    play_store: createEmptySlotTitleMap(),
  });
  const [titleTypographyByStore, setTitleTypographyByStore] = useState<
    Record<ScreenshotStore, ScreenshotSlotTitleTypographyMap>
  >({
    ios: createSlotTitleTypographyMap('ios'),
    play_store: createSlotTitleTypographyMap('play_store'),
  });
  const [titleLineGapByStore, setTitleLineGapByStore] = useState<
    Record<ScreenshotStore, ScreenshotSlotTitleLineGapMap>
  >({
    ios: createEmptySlotTitleLineGapMap(),
    play_store: createEmptySlotTitleLineGapMap(),
  });
  const [titleTopPaddingByStore, setTitleTopPaddingByStore] = useState<
    Record<ScreenshotStore, ScreenshotSlotTitleTopPaddingMap>
  >({
    ios: createEmptySlotTitleTopPaddingMap(),
    play_store: createEmptySlotTitleTopPaddingMap(),
  });
  const [titleCenterByStore, setTitleCenterByStore] = useState<
    Record<ScreenshotStore, ScreenshotSlotTitleCenterStateMap>
  >({
    ios: createDefaultScreenshotTitleCenterMap(),
    play_store: createDefaultScreenshotTitleCenterMap(),
  });
  const [titleExtraLineColorsByStore, setTitleExtraLineColorsByStore] = useState<
    Record<ScreenshotStore, ScreenshotSlotTitleExtraLineColorsMap>
  >({
    ios: createEmptyScreenshotTitleExtraLineColorsMap(),
    play_store: createEmptyScreenshotTitleExtraLineColorsMap(),
  });
  const [backgroundSettingsByStore, setBackgroundSettingsByStore] = useState<
    Record<ScreenshotStore, ScreenshotSlotBackgroundSettingsStateMap>
  >({
    ios: createDefaultScreenshotBackgroundSettingsMap(),
    play_store: createDefaultScreenshotBackgroundSettingsMap(),
  });
  const [filesByStore, setFilesByStore] = useState<Record<ScreenshotStore, ScreenshotSlotFileMap>>({
    ios: createEmptySlotFileMap(),
    play_store: createEmptySlotFileMap(),
  });
  const [zipFilesByStore, setZipFilesByStore] = useState<Record<ScreenshotStore, File | null>>({
    ios: null,
    play_store: null,
  });
  const [zipManifestByStore, setZipManifestByStore] = useState<Record<ScreenshotStore, ScreenshotZipLocaleMap>>({
    ios: {},
    play_store: {},
  });
  const [filePreviewUrlsByStore, setFilePreviewUrlsByStore] = useState<
    Record<ScreenshotStore, ScreenshotSlotPreviewUrlMap>
  >({
    ios: createEmptySlotPreviewUrlMap(),
    play_store: createEmptySlotPreviewUrlMap(),
  });
  const [filePreviewErrorsByStore, setFilePreviewErrorsByStore] = useState<
    Record<ScreenshotStore, ScreenshotSlotPreviewErrorMap>
  >({
    ios: createEmptySlotPreviewErrorMap(),
    play_store: createEmptySlotPreviewErrorMap(),
  });
  const [zipPreviewUrlsByStore, setZipPreviewUrlsByStore] = useState<
    Record<ScreenshotStore, ScreenshotSlotPreviewUrlMap>
  >({
    ios: createEmptySlotPreviewUrlMap(),
    play_store: createEmptySlotPreviewUrlMap(),
  });
  const [zipPreviewErrorsByStore, setZipPreviewErrorsByStore] = useState<
    Record<ScreenshotStore, ScreenshotSlotPreviewErrorMap>
  >({
    ios: createEmptySlotPreviewErrorMap(),
    play_store: createEmptySlotPreviewErrorMap(),
  });
  const [slotPalettesByStore, setSlotPalettesByStore] = useState<Record<ScreenshotStore, ScreenshotSlotPaletteMap>>({
    ios: createSlotPaletteMap('ios'),
    play_store: createSlotPaletteMap('play_store'),
  });
  const [heroPhonePoseByStore, setHeroPhonePoseByStore] = useState<Record<ScreenshotStore, IosHeroPhonePose | null>>({
    ios: resolveIosHeroPhonePose(DEFAULT_IOS_HERO_PHONE_POSE),
    play_store: resolveIosHeroPhonePose(DEFAULT_IOS_HERO_PHONE_POSE),
  });
  const [heroPhoneShapeByStore, setHeroPhoneShapeByStore] = useState<Record<ScreenshotStore, IosHeroPhoneShape | null>>({
    ios: resolveProceduralDeviceShapeForStore('ios', getDefaultProceduralDeviceShape('ios', iosDeviceFamily), iosDeviceFamily),
    play_store: resolveProceduralDeviceShapeForStore(
      'play_store',
      getDefaultProceduralDeviceShape('play_store')
    ),
  });
  const [heroPhoneLocationByStore, setHeroPhoneLocationByStore] = useState<Record<ScreenshotStore, ProceduralDeviceLocation | null>>({
    ios: resolveIosHeroPhoneLocation(DEFAULT_IOS_HERO_PHONE_LOCATION),
    play_store: resolveIosHeroPhoneLocation(DEFAULT_IOS_HERO_PHONE_LOCATION),
  });
  const [heroKeyLightPositionByStore, setHeroKeyLightPositionByStore] = useState<Record<ScreenshotStore, ProceduralLightPosition | null>>({
    ios: resolveProceduralLightPosition(),
    play_store: resolveProceduralLightPosition(),
  });
  const [heroKeyLightSettingsByStore, setHeroKeyLightSettingsByStore] = useState<Record<ScreenshotStore, ProceduralKeyLightSettings | null>>({
    ios: resolveProceduralKeyLightSettings(),
    play_store: resolveProceduralKeyLightSettings(),
  });
  const [slotSbeSettingsByStore, setSlotSbeSettingsByStore] = useState<Record<ScreenshotStore, ScreenshotSlotSbeMap>>({
    ios: createDefaultSlotSbeMap(),
    play_store: createDefaultSlotSbeMap(),
  });
  const [heroCameraModeByStore, setHeroCameraModeByStore] = useState<Record<ScreenshotStore, ProceduralCameraMode | null>>({
    ios: resolveProceduralCameraMode(DEFAULT_PROCEDURAL_CAMERA_MODE),
    play_store: resolveProceduralCameraMode(DEFAULT_PROCEDURAL_CAMERA_MODE),
  });
  const [heroCameraSettingsByStore, setHeroCameraSettingsByStore] = useState<Record<ScreenshotStore, ProceduralCameraSettings | null>>({
    ios: resolveProceduralCameraSettings(DEFAULT_PROCEDURAL_CAMERA_SETTINGS),
    play_store: resolveProceduralCameraSettings(DEFAULT_PROCEDURAL_CAMERA_SETTINGS),
  });
  // ── Per-device-family cache (iPhone vs iPad keep independent hero settings) ──
  type IosDeviceFamilyHeroCache = {
    heroPhonePose: IosHeroPhonePose | null;
    heroPhoneShape: IosHeroPhoneShape | null;
    heroPhoneLocation: ProceduralDeviceLocation | null;
    heroKeyLightPosition: ProceduralLightPosition | null;
    heroKeyLightSettings: ProceduralKeyLightSettings | null;
    slotSbeSettings: ScreenshotSlotSbeMap;
    heroCameraMode: ProceduralCameraMode | null;
    heroCameraSettings: ProceduralCameraSettings | null;
    titleTopPadding: ScreenshotSlotTitleTopPaddingMap;
  };
  const iosDeviceFamilyCacheRef = useRef<Partial<Record<IosScreenshotDeviceFamily, IosDeviceFamilyHeroCache>>>({});
  const prevIosDeviceFamilyRef = useRef(iosDeviceFamily);

  const switchIosDeviceFamily = useCallback((nextFamily: IosScreenshotDeviceFamily) => {
    const prevFamily = prevIosDeviceFamilyRef.current;
    if (nextFamily === prevFamily) return;

    // Save current iOS hero state for the outgoing family
    iosDeviceFamilyCacheRef.current[prevFamily] = {
      heroPhonePose: heroPhonePoseByStore.ios,
      heroPhoneShape: heroPhoneShapeByStore.ios,
      heroPhoneLocation: heroPhoneLocationByStore.ios,
      heroKeyLightPosition: heroKeyLightPositionByStore.ios,
      heroKeyLightSettings: heroKeyLightSettingsByStore.ios,
      slotSbeSettings: slotSbeSettingsByStore.ios,
      heroCameraMode: heroCameraModeByStore.ios,
      heroCameraSettings: heroCameraSettingsByStore.ios,
      titleTopPadding: titleTopPaddingByStore.ios,
    };

    // Restore cached state for the incoming family, or use defaults
    const cached = iosDeviceFamilyCacheRef.current[nextFamily];
    if (cached) {
      setHeroPhonePoseByStore((prev) => ({ ...prev, ios: cached.heroPhonePose }));
      setHeroPhoneShapeByStore((prev) => ({ ...prev, ios: cached.heroPhoneShape }));
      setHeroPhoneLocationByStore((prev) => ({ ...prev, ios: cached.heroPhoneLocation }));
      setHeroKeyLightPositionByStore((prev) => ({ ...prev, ios: cached.heroKeyLightPosition }));
      setHeroKeyLightSettingsByStore((prev) => ({ ...prev, ios: cached.heroKeyLightSettings }));
      setSlotSbeSettingsByStore((prev) => ({ ...prev, ios: cached.slotSbeSettings }));
      setHeroCameraModeByStore((prev) => ({ ...prev, ios: cached.heroCameraMode }));
      setHeroCameraSettingsByStore((prev) => ({ ...prev, ios: cached.heroCameraSettings }));
      setTitleTopPaddingByStore((prev) => ({ ...prev, ios: cached.titleTopPadding }));
    } else {
      // First time switching to this family — apply defaults
      setHeroPhonePoseByStore((prev) => ({ ...prev, ios: resolveIosHeroPhonePose(DEFAULT_IOS_HERO_PHONE_POSE) }));
      setHeroPhoneShapeByStore((prev) => ({
        ...prev,
        ios: resolveProceduralDeviceShapeForStore('ios', getDefaultProceduralDeviceShape('ios', nextFamily), nextFamily),
      }));
      setHeroPhoneLocationByStore((prev) => ({ ...prev, ios: resolveIosHeroPhoneLocation(DEFAULT_IOS_HERO_PHONE_LOCATION) }));
      setHeroKeyLightPositionByStore((prev) => ({ ...prev, ios: resolveProceduralLightPosition() }));
      setHeroKeyLightSettingsByStore((prev) => ({ ...prev, ios: resolveProceduralKeyLightSettings() }));
      setSlotSbeSettingsByStore((prev) => ({ ...prev, ios: createDefaultSlotSbeMap() }));
      setHeroCameraModeByStore((prev) => ({ ...prev, ios: resolveProceduralCameraMode(DEFAULT_PROCEDURAL_CAMERA_MODE) }));
      setHeroCameraSettingsByStore((prev) => ({
        ...prev,
        ios: resolveProceduralCameraSettings(getDefaultProceduralCameraSettings(nextFamily)),
      }));
      const defaultTopPad = getDefaultTitleTopPadding(nextFamily);
      setTitleTopPaddingByStore((prev) => ({
        ...prev,
        ios: { 1: defaultTopPad, 2: defaultTopPad, 3: defaultTopPad, 4: defaultTopPad, 5: defaultTopPad, 6: defaultTopPad },
      }));
    }

    prevIosDeviceFamilyRef.current = nextFamily;
    setIosDeviceFamily(nextFamily);
  }, [
    heroCameraModeByStore, heroCameraSettingsByStore, heroKeyLightPositionByStore,
    heroKeyLightSettingsByStore, heroPhoneLocationByStore, heroPhonePoseByStore,
    heroPhoneShapeByStore, slotSbeSettingsByStore, titleTopPaddingByStore,
  ]);

  const [panelState, setPanelState] = useState({
    rotation: false,
    color: false,
    background: false,
    shape: false,
    location: false,
    light: false,
    sbe: false,
  });
  const fileReadRequestIdsRef = useRef<Record<string, number>>({});
  const zipPreviewRequestIdsRef = useRef<Record<string, number>>({});
  const zipArchivesRef = useRef<Record<ScreenshotStore, JSZip | null>>({
    ios: null,
    play_store: null,
  });
  const wasOpenRef = useRef(false);
  const [fontLoadVersion, setFontLoadVersion] = useState(0);
  const [isPersistingPreset, setIsPersistingPreset] = useState(false);
  const [isGeneratingTitleTranslations, setIsGeneratingTitleTranslations] = useState(false);
  const presetSaveTimeoutsRef = useRef<Record<ScreenshotStore, number | null>>({
    ios: null,
    play_store: null,
  });
  const titleTranslationsSaveTimeoutRef = useRef<number | null>(null);
  const persistedPresetKeysRef = useRef<Record<ScreenshotStore, string>>({
    ios: JSON.stringify({
      palette: getScreenshotTemplateDefaultPalette('ios'),
      slotPalettes: createSlotPaletteMap('ios'),
      slotTitles: createSlotTitleMap(),
      slotTitleExtraLineColors: createEmptyScreenshotTitleExtraLineColorsMap(),
      slotTitleLineGaps: createEmptySlotTitleLineGapMap(),
      slotTitleTopPaddings: createEmptySlotTitleTopPaddingMap(),
      slotTitleCenters: createDefaultScreenshotTitleCenterMap(),
      slotTitleTypography: createSlotTitleTypographyMap('ios'),
      slotBackgroundSettings: createDefaultScreenshotBackgroundSettingsMap(),
      heroPhonePose: resolveIosHeroPhonePose(DEFAULT_IOS_HERO_PHONE_POSE),
      heroPhoneShape: resolveProceduralDeviceShapeForStore('ios', getDefaultProceduralDeviceShape('ios'), iosDeviceFamily),
      heroPhoneLocation: resolveIosHeroPhoneLocation(DEFAULT_IOS_HERO_PHONE_LOCATION),
      heroKeyLightPosition: resolveProceduralLightPosition(),
      heroKeyLightSettings: resolveProceduralKeyLightSettings(),
      slotSbeSettings: createDefaultSlotSbeMap(),
      heroCameraMode: resolveProceduralCameraMode(DEFAULT_PROCEDURAL_CAMERA_MODE),
      heroCameraSettings: resolveProceduralCameraSettings(DEFAULT_PROCEDURAL_CAMERA_SETTINGS),
    }),
    play_store: JSON.stringify({
      palette: getScreenshotTemplateDefaultPalette('play_store'),
      slotPalettes: createSlotPaletteMap('play_store'),
      slotTitles: createSlotTitleMap(),
      slotTitleExtraLineColors: createEmptyScreenshotTitleExtraLineColorsMap(),
      slotTitleLineGaps: createEmptySlotTitleLineGapMap(),
      slotTitleTopPaddings: createEmptySlotTitleTopPaddingMap(),
      slotTitleCenters: createDefaultScreenshotTitleCenterMap(),
      slotTitleTypography: createSlotTitleTypographyMap('play_store'),
      slotBackgroundSettings: createDefaultScreenshotBackgroundSettingsMap(),
      heroPhonePose: resolveIosHeroPhonePose(DEFAULT_IOS_HERO_PHONE_POSE),
      heroPhoneShape: resolveProceduralDeviceShapeForStore(
        'play_store',
        getDefaultProceduralDeviceShape('play_store')
      ),
      heroPhoneLocation: resolveIosHeroPhoneLocation(DEFAULT_IOS_HERO_PHONE_LOCATION),
      heroKeyLightPosition: resolveProceduralLightPosition(),
      heroKeyLightSettings: resolveProceduralKeyLightSettings(),
      slotSbeSettings: createDefaultSlotSbeMap(),
      heroCameraMode: resolveProceduralCameraMode(DEFAULT_PROCEDURAL_CAMERA_MODE),
      heroCameraSettings: resolveProceduralCameraSettings(DEFAULT_PROCEDURAL_CAMERA_SETTINGS),
    }),
  });
  const persistedTitleTranslationsKeyRef = useRef<string>('{}');
  const browserImageLoader = useMemo(() => createBrowserCanvasImageLoader(), []);

  useEffect(() => {
    if (!isResizingSidebar) return;

    const handlePointerMove = (event: PointerEvent) => {
      const editor = editorRef.current;
      if (!editor) return;
      const rect = editor.getBoundingClientRect();
      const nextWidth = rect.right - event.clientX;
      const minWidth = 220;
      const maxWidth = Math.max(minWidth, Math.floor(rect.width * 0.65));
      setSidebarWidth(Math.min(maxWidth, Math.max(minWidth, nextWidth)));
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (resizePointerIdRef.current !== null && event.pointerId !== resizePointerIdRef.current) {
        return;
      }
      resizePointerIdRef.current = null;
      setIsResizingSidebar(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizingSidebar]);

  const handleSidebarResizeStart = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    resizePointerIdRef.current = event.pointerId;
    setIsResizingSidebar(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setTitleTranslationProvider(resolvedDefaultTitleTranslationProvider);
  }, [isOpen, resolvedDefaultTitleTranslationProvider]);

  useEffect(() => {
    if (!isOpen) return;
    setIosDeviceFamily('iphone');
    prevIosDeviceFamilyRef.current = 'iphone';
    iosDeviceFamilyCacheRef.current = {};
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;

    const nextLocale = defaultLocale.trim() || 'en-US';
    const nextSourceLocale = 'en_US';
    const initialIosPreset = mergeScreenshotPresetConfig(
      presets?.ios,
      readScreenshotDraft(appId, 'ios')
    );
    const initialPlayPreset = mergeScreenshotPresetConfig(
      presets?.play_store,
      readScreenshotDraft(appId, 'play_store')
    );
    const sharedPresetSource = initialIosPreset ?? initialPlayPreset;
    const mergedTitleTranslations = mergeScreenshotTitleTranslations(titleTranslations, undefined);
    const legacySourceTitles = createSlotTitleMap(sharedPresetSource);
    const hasLegacySourceTitles = SCREENSHOT_TEMPLATE_SLOTS.some(
      (targetSlot) => legacySourceTitles[targetSlot].trim().length > 0
    );
    if (hasLegacySourceTitles && !resolveLocaleTitleEntry(mergedTitleTranslations, nextLocale)) {
      mergedTitleTranslations[nextLocale] = { ...legacySourceTitles };
    }
    const nextSlotPalettes: Record<ScreenshotStore, ScreenshotSlotPaletteMap> = {
      ios: createSlotPaletteMap('ios', sharedPresetSource),
      play_store: createSlotPaletteMap('play_store', sharedPresetSource),
    };
    const sharedSlotTitles = createTitleMapForLocale(
      mergedTitleTranslations,
      nextLocale,
      legacySourceTitles
    );
    const nextSlotTitles: Record<ScreenshotStore, ScreenshotSlotTitleMap> = {
      ios: { ...sharedSlotTitles },
      play_store: { ...sharedSlotTitles },
    };
    const sharedSlotTitleExtraLineColors = createSlotTitleExtraLineColorsMap(sharedPresetSource);
    const nextSlotTitleExtraLineColors: Record<ScreenshotStore, ScreenshotSlotTitleExtraLineColorsMap> = {
      ios: { ...sharedSlotTitleExtraLineColors },
      play_store: { ...sharedSlotTitleExtraLineColors },
    };
    const sharedSlotTitleTypography = createSlotTitleTypographyMap('ios', sharedPresetSource);
    const nextSlotTitleTypography: Record<ScreenshotStore, ScreenshotSlotTitleTypographyMap> = {
      ios: { ...sharedSlotTitleTypography },
      play_store: { ...sharedSlotTitleTypography },
    };
    const sharedSlotTitleCenters = createSlotTitleCenterMap(sharedPresetSource);
    const nextSlotTitleCenters: Record<ScreenshotStore, ScreenshotSlotTitleCenterStateMap> = {
      ios: { ...sharedSlotTitleCenters },
      play_store: { ...sharedSlotTitleCenters },
    };
    const sharedSlotBackgroundSettings = createSlotBackgroundSettingsMap(sharedPresetSource);
    const nextSlotBackgroundSettings: Record<
      ScreenshotStore,
      ScreenshotSlotBackgroundSettingsStateMap
    > = {
      ios: { ...sharedSlotBackgroundSettings },
      play_store: { ...sharedSlotBackgroundSettings },
    };
    const sharedTitleLineGap = createSlotTitleLineGapMap(sharedPresetSource);
    const nextTitleLineGap: Record<ScreenshotStore, ScreenshotSlotTitleLineGapMap> = {
      ios: { ...sharedTitleLineGap },
      play_store: { ...sharedTitleLineGap },
    };
    const sharedTitleTopPadding = createSlotTitleTopPaddingMap(sharedPresetSource);
    const nextTitleTopPadding: Record<ScreenshotStore, ScreenshotSlotTitleTopPaddingMap> = {
      ios: { ...sharedTitleTopPadding },
      play_store: { ...sharedTitleTopPadding },
    };
    const nextHeroPhonePose: Record<ScreenshotStore, IosHeroPhonePose | null> = {
      ios: resolveIosHeroPhonePose(initialIosPreset?.heroPhonePose),
      play_store: resolveIosHeroPhonePose(initialPlayPreset?.heroPhonePose),
    };
    const nextHeroPhoneShape: Record<ScreenshotStore, IosHeroPhoneShape | null> = {
      ios: resolveProceduralDeviceShapeForStore('ios', initialIosPreset?.heroPhoneShape, iosDeviceFamily),
      play_store: resolveProceduralDeviceShapeForStore('play_store', initialPlayPreset?.heroPhoneShape),
    };
    const nextHeroPhoneLocation: Record<ScreenshotStore, ProceduralDeviceLocation | null> = {
      ios: resolveIosHeroPhoneLocation(initialIosPreset?.heroPhoneLocation),
      play_store: resolveIosHeroPhoneLocation(initialPlayPreset?.heroPhoneLocation),
    };
    const nextHeroKeyLightPosition: Record<ScreenshotStore, ProceduralLightPosition | null> = {
      ios: resolveProceduralLightPosition(initialIosPreset?.heroKeyLightPosition),
      play_store: resolveProceduralLightPosition(initialPlayPreset?.heroKeyLightPosition),
    };
    const nextHeroKeyLightSettings: Record<ScreenshotStore, ProceduralKeyLightSettings | null> = {
      ios: resolveProceduralKeyLightSettings(
        initialIosPreset?.heroKeyLightSettings,
        initialIosPreset?.heroKeyLightPosition
      ),
      play_store: resolveProceduralKeyLightSettings(
        initialPlayPreset?.heroKeyLightSettings,
        initialPlayPreset?.heroKeyLightPosition
      ),
    };
    const sharedSbeSettings = createSlotSbeMap(sharedPresetSource);
    const nextSlotSbeSettings: Record<ScreenshotStore, ScreenshotSlotSbeMap> = {
      ios: { ...sharedSbeSettings },
      play_store: { ...sharedSbeSettings },
    };
    const nextHeroCameraMode: Record<ScreenshotStore, ProceduralCameraMode | null> = {
      ios: resolveProceduralCameraMode(initialIosPreset?.heroCameraMode),
      play_store: resolveProceduralCameraMode(initialPlayPreset?.heroCameraMode),
    };
    const nextHeroCameraSettings: Record<ScreenshotStore, ProceduralCameraSettings | null> = {
      ios: resolveProceduralCameraSettings(initialIosPreset?.heroCameraSettings),
      play_store: resolveProceduralCameraSettings(initialPlayPreset?.heroCameraSettings),
    };
    setStore(defaultStore);
    setIosDeviceFamily('iphone');
    prevIosDeviceFamilyRef.current = 'iphone';
    iosDeviceFamilyCacheRef.current = {};
    setSourceLocale(nextSourceLocale);
    setLocale(nextLocale);
    setSlot(1);
    setTitleTranslationsState(mergedTitleTranslations);
    setTitlesByStore(nextSlotTitles);
    setTitleLineGapByStore(nextTitleLineGap);
    setTitleTopPaddingByStore(nextTitleTopPadding);
    setTitleCenterByStore(nextSlotTitleCenters);
    setTitleExtraLineColorsByStore(nextSlotTitleExtraLineColors);
    setTitleTypographyByStore(nextSlotTitleTypography);
    setBackgroundSettingsByStore(nextSlotBackgroundSettings);
    setFilesByStore({
      ios: createEmptySlotFileMap(),
      play_store: createEmptySlotFileMap(),
    });
    zipArchivesRef.current = {
      ios: null,
      play_store: null,
    };
    setZipFilesByStore({
      ios: null,
      play_store: null,
    });
    setZipManifestByStore({
      ios: {},
      play_store: {},
    });
    setFilePreviewUrlsByStore({
      ios: createEmptySlotPreviewUrlMap(),
      play_store: createEmptySlotPreviewUrlMap(),
    });
    setFilePreviewErrorsByStore({
      ios: createEmptySlotPreviewErrorMap(),
      play_store: createEmptySlotPreviewErrorMap(),
    });
    setZipPreviewUrlsByStore({
      ios: createEmptySlotPreviewUrlMap(),
      play_store: createEmptySlotPreviewUrlMap(),
    });
    setZipPreviewErrorsByStore({
      ios: createEmptySlotPreviewErrorMap(),
      play_store: createEmptySlotPreviewErrorMap(),
    });
    setSlotPalettesByStore(nextSlotPalettes);
    setHeroPhonePoseByStore(nextHeroPhonePose);
    setHeroPhoneShapeByStore(nextHeroPhoneShape);
    setHeroPhoneLocationByStore(nextHeroPhoneLocation);
    setHeroKeyLightPositionByStore(nextHeroKeyLightPosition);
    setHeroKeyLightSettingsByStore(nextHeroKeyLightSettings);
    setSlotSbeSettingsByStore(nextSlotSbeSettings);
    setHeroCameraModeByStore(nextHeroCameraMode);
    setHeroCameraSettingsByStore(nextHeroCameraSettings);
    setPanelState({
      rotation: false,
      color: false,
      background: false,
      shape: false,
      location: false,
      light: false,
      sbe: false,
    });
    persistedPresetKeysRef.current = {
      ios: JSON.stringify({
        palette: nextSlotPalettes.ios[1],
        slotPalettes: nextSlotPalettes.ios,
        slotTitles: nextSlotTitles.ios,
        slotTitleExtraLineColors: nextSlotTitleExtraLineColors.ios,
        slotTitleLineGaps: nextTitleLineGap.ios,
        slotTitleTopPaddings: nextTitleTopPadding.ios,
        slotTitleCenters: nextSlotTitleCenters.ios,
        slotTitleTypography: nextSlotTitleTypography.ios,
        slotBackgroundSettings: nextSlotBackgroundSettings.ios,
        heroPhonePose: nextHeroPhonePose.ios,
        heroPhoneShape: nextHeroPhoneShape.ios,
        heroPhoneLocation: nextHeroPhoneLocation.ios,
        heroKeyLightPosition: nextHeroKeyLightPosition.ios,
        heroKeyLightSettings: nextHeroKeyLightSettings.ios,
        slotSbeSettings: nextSlotSbeSettings.ios,
        heroCameraMode: nextHeroCameraMode.ios,
        heroCameraSettings: nextHeroCameraSettings.ios,
      }),
      play_store: JSON.stringify({
        palette: nextSlotPalettes.play_store[1],
        slotPalettes: nextSlotPalettes.play_store,
        slotTitles: nextSlotTitles.play_store,
        slotTitleExtraLineColors: nextSlotTitleExtraLineColors.play_store,
        slotTitleLineGaps: nextTitleLineGap.play_store,
        slotTitleTopPaddings: nextTitleTopPadding.play_store,
        slotTitleCenters: nextSlotTitleCenters.play_store,
        slotTitleTypography: nextSlotTitleTypography.play_store,
        slotBackgroundSettings: nextSlotBackgroundSettings.play_store,
        heroPhonePose: nextHeroPhonePose.play_store,
        heroPhoneShape: nextHeroPhoneShape.play_store,
        heroPhoneLocation: nextHeroPhoneLocation.play_store,
        heroKeyLightPosition: nextHeroKeyLightPosition.play_store,
        heroKeyLightSettings: nextHeroKeyLightSettings.play_store,
        slotSbeSettings: nextSlotSbeSettings.play_store,
        heroCameraMode: nextHeroCameraMode.play_store,
        heroCameraSettings: nextHeroCameraSettings.play_store,
      }),
    };
    persistedTitleTranslationsKeyRef.current = JSON.stringify(mergedTitleTranslations);
  }, [appId, defaultLocale, defaultStore, isOpen, presets, titleTranslations]);

  useEffect(() => {
    if (!isOpen || !onResolveLocaleAppNames) return;

    let isCancelled = false;
    void Promise.all(
      SCREENSHOT_STORES.map(async ({ id }) => {
        const resolved = await Promise.resolve(onResolveLocaleAppNames(id));
        return [id, resolved] as const;
      })
    )
      .then((entries) => {
        if (isCancelled) return;
        setLocaleAppNamesByStore({
          ios: entries.find(([storeId]) => storeId === 'ios')?.[1] ?? {},
          play_store: entries.find(([storeId]) => storeId === 'play_store')?.[1] ?? {},
        });
      })
      .catch(() => {
        if (isCancelled) return;
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, onResolveLocaleAppNames]);

  useEffect(() => {
    if (!isOpen) return;
    const resolvedLocaleKey = locale.trim() || defaultLocale.trim() || 'en-US';
    const nextTitles = createTitleMapForLocale(
      titleTranslationsState,
      resolvedLocaleKey,
      createEmptySlotTitleMap()
    );
    setTitlesByStore({
      ios: { ...nextTitles },
      play_store: { ...nextTitles },
    });
  }, [defaultLocale, isOpen, locale, titleTranslationsState]);

  const activeScreenshotSlots = useMemo(
    () => getActiveScreenshotTemplateSlots(store, iosDeviceFamily),
    [iosDeviceFamily, store]
  );
  const activeSlotRangeLabel = useMemo(
    () => formatSlotRangeLabel(activeScreenshotSlots),
    [activeScreenshotSlots]
  );
  const outputPath = useMemo(() => {
    const normalizedLocale = locale.trim() || 'en-US';
    const storePath =
      store === 'ios'
        ? `${getScreenshotStorePathToken(store)}/${resolveIosScreenshotDeviceFamily(iosDeviceFamily)}`
        : getScreenshotStorePathToken(store);
    return `screenshots/${storePath}/${normalizedLocale}/${slot}.png`;
  }, [iosDeviceFamily, locale, slot, store]);
  const zipLocaleKeys = useMemo(
    () => Object.keys(zipManifestByStore[store]).sort((a, b) => a.localeCompare(b)),
    [store, zipManifestByStore]
  );
  const zipLocaleSummary = useMemo(
    () =>
      zipLocaleKeys.map((localeKey) => {
        const entries = zipManifestByStore[store][localeKey] ?? {};
        const availableSlots = activeScreenshotSlots.filter((targetSlot) =>
          Boolean(getZipEntryForSlot(entries, targetSlot))
        );
        const missingSlots = activeScreenshotSlots.filter(
          (targetSlot) => !getZipEntryForSlot(entries, targetSlot)
        );
        return {
          locale: localeKey,
          availableSlots,
          missingSlots,
          isComplete: missingSlots.length === 0,
        };
      }),
    [activeScreenshotSlots, store, zipLocaleKeys, zipManifestByStore]
  );
  const zipCompleteLocaleCount = useMemo(
    () => zipLocaleSummary.filter((entry) => entry.isComplete).length,
    [zipLocaleSummary]
  );
  const activeZipLocaleKey = useMemo(
    () => findZipLocaleKey(zipManifestByStore[store], locale),
    [locale, store, zipManifestByStore]
  );
  const activeZipLocaleEntries = activeZipLocaleKey ? zipManifestByStore[store][activeZipLocaleKey] : undefined;
  const activeLocaleKey = useMemo(
    () => locale.trim() || defaultLocale.trim() || 'en-US',
    [defaultLocale, locale]
  );
  const sourceLocaleKey = useMemo(
    () => sourceLocale.trim().replace(/_/g, '-') || 'en-US',
    [sourceLocale]
  );
  const sourceZipLocaleKey = useMemo(
    () => findZipLocaleKey(zipManifestByStore[store], sourceLocaleKey),
    [sourceLocaleKey, store, zipManifestByStore]
  );
  const sourceZipLocaleEntries = sourceZipLocaleKey
    ? zipManifestByStore[store][sourceZipLocaleKey]
    : undefined;
  const resolveTitleTemplateContext = useCallback(
    (targetStore: ScreenshotStore, targetLocale: string): ScreenshotTitleTemplateContext => ({
      localeAppName: resolveLocaleAppNameFromMap(
        localeAppNamesByStore[targetStore],
        targetLocale,
        defaultLocale
      ),
    }),
    [defaultLocale, localeAppNamesByStore]
  );
  const resolvedTitleTemplateContext = useMemo(
    () => resolveTitleTemplateContext(store, activeLocaleKey),
    [activeLocaleKey, resolveTitleTemplateContext, store]
  );
  const activeLocaleTitleMap = useMemo(
    () =>
      createTitleMapForLocale(
        titleTranslationsState,
        activeLocaleKey,
        createEmptySlotTitleMap()
      ),
    [activeLocaleKey, titleTranslationsState]
  );

  const resolvedPalette = useMemo(
    () => resolveScreenshotTemplatePalette(store, slotPalettesByStore[store]?.[slot]),
    [slot, slotPalettesByStore, store]
  );
  const resolvedTitle = useMemo(
    () => activeLocaleTitleMap[slot] ?? '',
    [activeLocaleTitleMap, slot]
  );
  const resolvedTitleTypography = useMemo(
    () => resolveScreenshotTitleTypography(store, slot, titleTypographyByStore[store]?.[slot]),
    [slot, store, titleTypographyByStore]
  );
  const resolvedTitleLines = useMemo(
    () => buildTitleLines(slot, resolvedTitle, resolvedTitleTemplateContext),
    [resolvedTitle, resolvedTitleTemplateContext, slot]
  );
  const resolvedPrimaryTitleColor = useMemo(
    () => getDefaultScreenshotTitlePrimaryColor(store, slot, resolvedPalette),
    [resolvedPalette, slot, store]
  );
  const resolvedTitleExtraLineColors = useMemo(
    () =>
      syncScreenshotTitleExtraLineColors(
        titleExtraLineColorsByStore[store]?.[slot],
        resolvedTitleLines.length,
        resolvedPrimaryTitleColor
      ),
    [resolvedPrimaryTitleColor, resolvedTitleLines.length, slot, store, titleExtraLineColorsByStore]
  );
  const resolvedTitleLineColors = useMemo(
    () =>
      resolveScreenshotTitleLineColors(
        store,
        slot,
        resolvedPalette,
        resolvedTitleLines.length,
        titleExtraLineColorsByStore[store]?.[slot]
      ),
    [resolvedPalette, resolvedTitleLines.length, slot, store, titleExtraLineColorsByStore]
  );
  const resolvedTitleLineGap = titleLineGapByStore[store]?.[slot] ?? 0;
  const resolvedTitleTopPadding = titleTopPaddingByStore[store]?.[slot] ?? 0;
  const resolvedTitleCenter = parseScreenshotTitleCenterInput(titleCenterByStore[store]?.[slot], false);
  const resolvedBackgroundSettings = useMemo(
    () => resolveScreenshotBackgroundSettings(backgroundSettingsByStore[store]?.[slot]),
    [backgroundSettingsByStore, slot, store]
  );
  const resolvedHeroPhonePose = useMemo(
    () => resolveIosHeroPhonePose(heroPhonePoseByStore[store]),
    [heroPhonePoseByStore, store]
  );
  const resolvedHeroPhoneShape = useMemo(
    () => resolveProceduralDeviceShapeForStore(store, heroPhoneShapeByStore[store], iosDeviceFamily),
    [heroPhoneShapeByStore, iosDeviceFamily, store]
  );
  const resolvedHeroPhoneLocation = useMemo(
    () => resolveIosHeroPhoneLocation(heroPhoneLocationByStore[store]),
    [heroPhoneLocationByStore, store]
  );
  const resolvedHeroKeyLightPosition = useMemo(
    () => resolveProceduralLightPosition(heroKeyLightPositionByStore[store]),
    [heroKeyLightPositionByStore, store]
  );
  const resolvedHeroKeyLightSettings = useMemo(
    () =>
      resolveProceduralKeyLightSettings(
        heroKeyLightSettingsByStore[store],
        heroKeyLightPositionByStore[store]
      ),
    [heroKeyLightPositionByStore, heroKeyLightSettingsByStore, store]
  );
  const resolvedSelectedSlotSbeSettings = useMemo(
    () => resolveSlot1SbeSettings(slotSbeSettingsByStore[store]?.[slot]),
    [slot, slotSbeSettingsByStore, store]
  );
  const resolvedHeroCameraMode = useMemo(
    () => resolveProceduralCameraMode(heroCameraModeByStore[store]),
    [heroCameraModeByStore, store]
  );
  const resolvedHeroCameraSettings = useMemo(
    () => resolveProceduralCameraSettings(heroCameraSettingsByStore[store]),
    [heroCameraSettingsByStore, store]
  );
  const persistedTitleExtraLineColorsForStore = useMemo(
    () => ({
      ...titleExtraLineColorsByStore[store],
      [slot]: resolvedTitleExtraLineColors,
    }),
    [resolvedTitleExtraLineColors, slot, store, titleExtraLineColorsByStore]
  );
  const buildPresetStateForStore = useCallback((targetStore: ScreenshotStore) => {
    const slotPalettes = slotPalettesByStore[targetStore];
    const slotTitles = activeLocaleTitleMap;
    const rawSlotTitleExtraLineColors =
      targetStore === store
        ? persistedTitleExtraLineColorsForStore
        : titleExtraLineColorsByStore[targetStore];
    const slotTitleExtraLineColors = SCREENSHOT_TEMPLATE_SLOTS.reduce((acc, targetSlot) => {
      const targetPalette = resolveScreenshotTemplatePalette(targetStore, slotPalettes[targetSlot]);
      const targetTitle = slotTitles[targetSlot] ?? '';
      const targetLines = buildTitleLines(
        targetSlot,
        targetTitle,
        resolveTitleTemplateContext(targetStore, activeLocaleKey)
      );
      const targetPrimaryColor = getDefaultScreenshotTitlePrimaryColor(
        targetStore,
        targetSlot,
        targetPalette
      );
      acc[targetSlot] = syncScreenshotTitleExtraLineColors(
        rawSlotTitleExtraLineColors?.[targetSlot],
        targetLines.length,
        targetPrimaryColor
      );
      return acc;
    }, {} as ScreenshotSlotTitleExtraLineColorsMap);
    const slotTitleLineGaps = titleLineGapByStore[targetStore];
    const slotTitleTopPaddings = titleTopPaddingByStore[targetStore];
    const slotTitleCenters = titleCenterByStore[targetStore];
    const slotTitleTypography = titleTypographyByStore[targetStore];
    const palette = resolveScreenshotTemplatePalette(targetStore, slotPalettes[1]);
    const heroPhonePose = resolveIosHeroPhonePose(heroPhonePoseByStore[targetStore]);
    const resolvedHeroPhoneShapeForStore = resolveProceduralDeviceShapeForStore(
      targetStore,
      heroPhoneShapeByStore[targetStore],
      targetStore === 'ios' ? iosDeviceFamily : undefined
    );
    const heroPhoneLocation = resolveIosHeroPhoneLocation(heroPhoneLocationByStore[targetStore]);
    const heroKeyLightPosition = resolveProceduralLightPosition(heroKeyLightPositionByStore[targetStore]);
    const heroKeyLightSettings = resolveProceduralKeyLightSettings(
      heroKeyLightSettingsByStore[targetStore],
      heroKeyLightPositionByStore[targetStore]
    );
    const slotSbeSettings = {
      1: resolveSlot1SbeSettings(slotSbeSettingsByStore[targetStore]?.[1]),
      2: resolveSlot1SbeSettings(slotSbeSettingsByStore[targetStore]?.[2]),
    } satisfies ScreenshotSlotSbeMap;
    const heroCameraMode = resolveProceduralCameraMode(heroCameraModeByStore[targetStore]);
    const heroCameraSettings = resolveProceduralCameraSettings(heroCameraSettingsByStore[targetStore]);
    const preset = {
      palette,
      slotPalettes,
      slotTitles,
      slotTitleExtraLineColors,
      slotTitleLineGaps,
      slotTitleTopPaddings,
      slotTitleCenters,
      slotTitleTypography,
      slotBackgroundSettings: backgroundSettingsByStore[targetStore],
      heroPhonePose,
      heroPhoneShape: resolvedHeroPhoneShapeForStore,
      heroPhoneLocation,
      heroKeyLightPosition,
      heroKeyLightSettings,
      slotSbeSettings,
      heroCameraMode,
      heroCameraSettings,
    };
    return {
      preset,
      key: JSON.stringify(preset),
    };
  }, [activeLocaleKey, activeLocaleTitleMap, backgroundSettingsByStore, heroCameraModeByStore, heroCameraSettingsByStore, heroKeyLightPositionByStore, heroKeyLightSettingsByStore, heroPhoneLocationByStore, heroPhonePoseByStore, heroPhoneShapeByStore, persistedTitleExtraLineColorsForStore, resolveTitleTemplateContext, slotPalettesByStore, slotSbeSettingsByStore, store, titleCenterByStore, titleExtraLineColorsByStore, titleLineGapByStore, titleTopPaddingByStore, titleTypographyByStore]);
  const previewCanvasSize = useMemo(
    () => getScreenshotTemplateCanvasSize(store, iosDeviceFamily),
    [iosDeviceFamily, store]
  );
  const paletteFields = useMemo(() => getScreenshotTemplatePaletteFields(store, slot), [slot, store]);
  const isLocked = isBusy;
  const isIosStore = store === 'ios';
  const isHeroSlot = slot <= 2;
  const selectedSlotFile = filesByStore[store]?.[slot] ?? null;
  const selectedZipEntry = getZipEntryForSlot(activeZipLocaleEntries, slot);
  const selectedSlotPreviewError =
    zipPreviewErrorsByStore[store]?.[slot] ||
    filePreviewErrorsByStore[store]?.[slot] ||
    '';
  const hasAnySlotScreenshot = useMemo(
    () => activeScreenshotSlots.some((targetSlot) => Boolean(filesByStore[store]?.[targetSlot])),
    [activeScreenshotSlots, filesByStore, store]
  );
  const hasAnyZipScreenshot = useMemo(
    () =>
      Object.values(zipManifestByStore[store]).some((localeEntries) =>
        activeScreenshotSlots.some((targetSlot) => Boolean(localeEntries[targetSlot]))
      ),
    [activeScreenshotSlots, store, zipManifestByStore]
  );
  const canStart = !isLocked && (hasAnySlotScreenshot || hasAnyZipScreenshot);
  const canSaveSettings = Boolean(appId) && !isLocked && !isPersistingPreset;
  const titleTranslationSourceSlots = useMemo(() => {
    if (!sourceZipLocaleEntries) {
      return [...activeScreenshotSlots];
    }
    return activeScreenshotSlots.filter((targetSlot) =>
      Boolean(getZipEntryForSlot(sourceZipLocaleEntries, targetSlot))
    );
  }, [activeScreenshotSlots, sourceZipLocaleEntries]);
  const titleTranslationTargetLocales = useMemo(
    () =>
      zipLocaleKeys.filter(
        (targetLocale) => normalizeLocaleToken(targetLocale) !== normalizeLocaleToken(sourceLocaleKey)
      ),
    [sourceLocaleKey, zipLocaleKeys]
  );
  const sourceLocaleTitleMap = useMemo(
    () =>
      createTitleMapForLocale(
        titleTranslationsState,
        sourceLocaleKey,
        normalizeLocaleToken(sourceLocaleKey) === normalizeLocaleToken(activeLocaleKey)
          ? activeLocaleTitleMap
          : resolveLocaleTitleEntry(titleTranslationsState, sourceLocaleKey) ??
              createEmptySlotTitleMap()
      ),
    [activeLocaleKey, activeLocaleTitleMap, sourceLocaleKey, titleTranslationsState]
  );
  const canGenerateTitleTranslations =
    !isLocked &&
    !isGeneratingTitleTranslations &&
    titleTranslationTargetLocales.length > 0 &&
    titleTranslationSourceSlots.some(
      (targetSlot) => (sourceLocaleTitleMap[targetSlot] ?? '').trim().length > 0
    );

  const handleSlotFileChange = useCallback((nextFile: File | null) => {
    if (!nextFile) return;

    const targetSlots = getSlotScreenshotTargets(slot);
    const requestKey = `${store}:${targetSlots.join('-')}`;
    const requestId = (fileReadRequestIdsRef.current[requestKey] ?? 0) + 1;
    fileReadRequestIdsRef.current[requestKey] = requestId;

    setFilesByStore((prev) => ({
      ...prev,
      [store]: {
        ...prev[store],
        ...Object.fromEntries(targetSlots.map((targetSlot) => [targetSlot, nextFile])),
      },
    }));
    setFilePreviewErrorsByStore((prev) => ({
      ...prev,
      [store]: {
        ...prev[store],
        ...Object.fromEntries(targetSlots.map((targetSlot) => [targetSlot, ''])),
      },
    }));

    void readFileAsDataUrl(nextFile)
      .then((nextValue) => {
        if (fileReadRequestIdsRef.current[requestKey] !== requestId) return;
        setFilePreviewUrlsByStore((prev) => ({
          ...prev,
          [store]: {
            ...prev[store],
            ...Object.fromEntries(targetSlots.map((targetSlot) => [targetSlot, nextValue])),
          },
        }));
      })
      .catch(() => {
        if (fileReadRequestIdsRef.current[requestKey] !== requestId) return;
        setFilePreviewUrlsByStore((prev) => ({
          ...prev,
          [store]: {
            ...prev[store],
            ...Object.fromEntries(targetSlots.map((targetSlot) => [targetSlot, ''])),
          },
        }));
        setFilePreviewErrorsByStore((prev) => ({
          ...prev,
          [store]: {
            ...prev[store],
            ...Object.fromEntries(
              targetSlots.map((targetSlot) => [targetSlot, 'Dosya preview için okunamadı.'])
            ),
          },
        }));
      });
  }, [slot, store]);

  const handleZipFileChange = useCallback((nextFile: File | null) => {
    if (!nextFile) return;
    void (async () => {
      const archive = await JSZip.loadAsync(nextFile);
      const manifest = parseScreenshotZipManifest(archive);
      const locales = Object.keys(manifest).sort((a, b) => a.localeCompare(b));
      if (locales.length === 0) {
        throw new Error('ZIP içinde locale klasörü ve 1..6 adlı görseller bulunamadı.');
      }
      zipArchivesRef.current[store] = archive;
      setZipFilesByStore((prev) => ({
        ...prev,
        [store]: nextFile,
      }));
      setZipManifestByStore((prev) => ({
        ...prev,
        [store]: manifest,
      }));
      setZipPreviewErrorsByStore((prev) => ({
        ...prev,
        [store]: createEmptySlotPreviewErrorMap(),
      }));
      if (!findZipLocaleKey(manifest, locale)) {
        setLocale(locales[0] ?? 'en-US');
      }
    })().catch((error) => {
      zipArchivesRef.current[store] = null;
      setZipFilesByStore((prev) => ({
        ...prev,
        [store]: null,
      }));
      setZipManifestByStore((prev) => ({
        ...prev,
        [store]: {},
      }));
      setZipPreviewUrlsByStore((prev) => ({
        ...prev,
        [store]: createEmptySlotPreviewUrlMap(),
      }));
      setZipPreviewErrorsByStore((prev) => ({
        ...prev,
        [store]: {
          ...createEmptySlotPreviewErrorMap(),
          [slot]:
            error instanceof Error ? error.message : 'ZIP içeriği okunamadı.',
        },
      }));
    });
  }, [locale, slot, store]);

  const loadZipLocaleScreenshotDataUrls = useCallback(async (
    targetStore: ScreenshotStore,
    targetLocale: string
  ): Promise<Partial<Record<ScreenshotTemplateSlot, string>>> => {
    const archive = zipArchivesRef.current[targetStore];
    const localeKey = findZipLocaleKey(zipManifestByStore[targetStore], targetLocale);
    if (!archive || !localeKey) return {};
    const localeEntries = zipManifestByStore[targetStore][localeKey];
    const dataUrlByPath = new Map<string, string>();
    const pairs = await Promise.all(
      SCREENSHOT_TEMPLATE_SLOTS.map(async (targetSlot) => {
        const entry = getZipEntryForSlot(localeEntries, targetSlot);
        if (!entry) return null;
        if (!dataUrlByPath.has(entry.path)) {
          dataUrlByPath.set(entry.path, await readZipEntryAsDataUrl(archive, entry.path));
        }
        return [targetSlot, dataUrlByPath.get(entry.path) ?? ''] as const;
      })
    );
    return pairs.reduce((acc, pair) => {
      if (!pair) return acc;
      acc[pair[0]] = pair[1];
      return acc;
    }, {} as Partial<Record<ScreenshotTemplateSlot, string>>);
  }, [zipManifestByStore]);

  const handlePaletteChange = useCallback(
    (key: keyof ScreenshotTemplatePalette, value: string) => {
      setSlotPalettesByStore((prev) => {
        const nextPalettes: Record<ScreenshotStore, ScreenshotSlotPaletteMap> = {
          ios: { ...prev.ios },
          play_store: { ...prev.play_store },
        };
        const targets = getSlotPaletteTargetsForKey(slot, key);
        for (const { id: targetStore } of SCREENSHOT_STORES) {
          for (const targetSlot of targets) {
            const basePalette = resolveScreenshotTemplatePalette(targetStore, nextPalettes[targetStore][targetSlot]);
            nextPalettes[targetStore][targetSlot] = resolveScreenshotTemplatePalette(targetStore, {
              ...basePalette,
              [key]: value,
            });
          }
        }
        return nextPalettes;
      });
    },
    [slot, store]
  );

  const handleTitleChange = useCallback((value: string) => {
    setTitleTranslationsState((prev) => ({
      ...prev,
      [activeLocaleKey]: {
        ...(resolveLocaleTitleEntry(prev, activeLocaleKey) ?? {}),
        [slot]: value,
      },
    }));
    setTitlesByStore((prev) => ({
      ios: {
        ...prev.ios,
        [slot]: value,
      },
      play_store: {
        ...prev.play_store,
        [slot]: value,
      },
    }));
  }, [activeLocaleKey, slot]);

  const handleTitleTypographyChange = useCallback(
    (key: keyof ScreenshotTitleTypography, value: string | number) => {
      setTitleTypographyByStore((prev) => ({
        ios: {
          ...prev.ios,
          [slot]: resolveScreenshotTitleTypography('ios', slot, {
            ...prev.ios[slot],
            [key]: value,
          }),
        },
        play_store: {
          ...prev.play_store,
          [slot]: resolveScreenshotTitleTypography('play_store', slot, {
            ...prev.play_store[slot],
            [key]: value,
          }),
        },
      }));
    },
    [slot]
  );

  const handleTitleLineGapChange = useCallback((value: number) => {
    const nextValue = Number.isFinite(value) ? value : 0;
    setTitleLineGapByStore((prev) => ({
      ios: {
        ...prev.ios,
        [slot]: nextValue,
      },
      play_store: {
        ...prev.play_store,
        [slot]: nextValue,
      },
    }));
  }, [slot]);

  const handleTitleTopPaddingChange = useCallback((value: number) => {
    const nextValue = Number.isFinite(value) ? value : 0;
    setTitleTopPaddingByStore((prev) => ({
      ios: {
        ...prev.ios,
        [slot]: nextValue,
      },
      play_store: {
        ...prev.play_store,
        [slot]: nextValue,
      },
    }));
  }, [slot]);

  const handleTitleCenterChange = useCallback((value: boolean) => {
    setTitleCenterByStore((prev) => ({
      ios: {
        ...prev.ios,
        [slot]: value,
      },
      play_store: {
        ...prev.play_store,
        [slot]: value,
      },
    }));
  }, [slot]);

  const handleApplyTitleCenterToAllSlots = useCallback(() => {
    setTitleCenterByStore({
      ios: SCREENSHOT_TEMPLATE_SLOTS.reduce((acc, targetSlot) => {
        acc[targetSlot] = resolvedTitleCenter;
        return acc;
      }, { ...titleCenterByStore.ios }),
      play_store: SCREENSHOT_TEMPLATE_SLOTS.reduce((acc, targetSlot) => {
        acc[targetSlot] = resolvedTitleCenter;
        return acc;
      }, { ...titleCenterByStore.play_store }),
    });
  }, [resolvedTitleCenter, titleCenterByStore.ios, titleCenterByStore.play_store]);

  const handleTitleExtraLineColorChange = useCallback(
    (lineIndex: number, value: string) => {
      setTitleExtraLineColorsByStore((prev) => {
        const nextSlotColors = [...(prev[store]?.[slot] ?? [])].slice(
          0,
          MAX_SCREENSHOT_TITLE_EXTRA_LINE_COLORS
        );
        nextSlotColors[lineIndex] = value;
        return {
          ios: {
            ...prev.ios,
            [slot]: nextSlotColors.slice(0, MAX_SCREENSHOT_TITLE_EXTRA_LINE_COLORS),
          },
          play_store: {
            ...prev.play_store,
            [slot]: nextSlotColors.slice(0, MAX_SCREENSHOT_TITLE_EXTRA_LINE_COLORS),
          },
        };
      });
    },
    [slot, store]
  );

  const handleBackgroundSettingsChange = useCallback(
    (key: keyof ScreenshotBackgroundSettings, value: number) => {
      setBackgroundSettingsByStore((prev) => {
        const next = {
          ios: { ...prev.ios },
          play_store: { ...prev.play_store },
        } satisfies Record<ScreenshotStore, ScreenshotSlotBackgroundSettingsStateMap>;
        const targetSlots = getSlotBackgroundSettingsTargets(slot);
        for (const { id: targetStore } of SCREENSHOT_STORES) {
          for (const targetSlot of targetSlots) {
            next[targetStore][targetSlot] = resolveScreenshotBackgroundSettings({
              ...next[targetStore][targetSlot],
              [key]: value,
            });
          }
        }
        return next;
      });
    },
    [slot]
  );

  const handleApplyTitleValueToAllSlots = useCallback(() => {
    const nextTitleTranslations = {
      ...titleTranslationsState,
      [activeLocaleKey]: SCREENSHOT_TEMPLATE_SLOTS.reduce((acc, targetSlot) => {
        acc[targetSlot] = resolvedTitle;
        return acc;
      }, {
        ...(resolveLocaleTitleEntry(titleTranslationsState, activeLocaleKey) ?? {}),
      } as Partial<Record<ScreenshotTemplateSlot, string>>),
    };
    setTitleTranslationsState(nextTitleTranslations);
    setTitlesByStore({
      ios: SCREENSHOT_TEMPLATE_SLOTS.reduce((acc, targetSlot) => {
        acc[targetSlot] = resolvedTitle;
        return acc;
      }, { ...titlesByStore.ios }),
      play_store: SCREENSHOT_TEMPLATE_SLOTS.reduce((acc, targetSlot) => {
        acc[targetSlot] = resolvedTitle;
        return acc;
      }, { ...titlesByStore.play_store }),
    });
  }, [
    activeLocaleKey,
    resolvedTitle,
    titleTranslationsState,
    titlesByStore.ios,
    titlesByStore.play_store,
  ]);

  const handleApplyTitleLineGapToAllSlots = useCallback(() => {
    setTitleLineGapByStore({
      ios: SCREENSHOT_TEMPLATE_SLOTS.reduce((acc, targetSlot) => {
        acc[targetSlot] = resolvedTitleLineGap;
        return acc;
      }, { ...titleLineGapByStore.ios }),
      play_store: SCREENSHOT_TEMPLATE_SLOTS.reduce((acc, targetSlot) => {
        acc[targetSlot] = resolvedTitleLineGap;
        return acc;
      }, { ...titleLineGapByStore.play_store }),
    });
  }, [resolvedTitleLineGap, titleLineGapByStore.ios, titleLineGapByStore.play_store]);

  const handleApplyTitleTopPaddingToAllSlots = useCallback(() => {
    setTitleTopPaddingByStore({
      ios: SCREENSHOT_TEMPLATE_SLOTS.reduce((acc, targetSlot) => {
        acc[targetSlot] = resolvedTitleTopPadding;
        return acc;
      }, { ...titleTopPaddingByStore.ios }),
      play_store: SCREENSHOT_TEMPLATE_SLOTS.reduce((acc, targetSlot) => {
        acc[targetSlot] = resolvedTitleTopPadding;
        return acc;
      }, { ...titleTopPaddingByStore.play_store }),
    });
  }, [resolvedTitleTopPadding, titleTopPaddingByStore.ios, titleTopPaddingByStore.play_store]);

  const handleApplyTitleTypographyFieldToAllSlots = useCallback((key: keyof ScreenshotTitleTypography) => {
    setTitleTypographyByStore({
      ios: SCREENSHOT_TEMPLATE_SLOTS.reduce((acc, targetSlot) => {
        acc[targetSlot] = resolveScreenshotTitleTypography('ios', targetSlot, {
          ...acc[targetSlot],
          [key]: resolvedTitleTypography[key],
        });
        return acc;
      }, { ...titleTypographyByStore.ios }),
      play_store: SCREENSHOT_TEMPLATE_SLOTS.reduce((acc, targetSlot) => {
        acc[targetSlot] = resolveScreenshotTitleTypography('play_store', targetSlot, {
          ...acc[targetSlot],
          [key]: resolvedTitleTypography[key],
        });
        return acc;
      }, { ...titleTypographyByStore.play_store }),
    });
  }, [resolvedTitleTypography, titleTypographyByStore.ios, titleTypographyByStore.play_store]);

  const handleApplyExtraLineColorToAllSlots = useCallback((lineIndex: number) => {
    const targetColor = resolvedTitleExtraLineColors[lineIndex];
    if (!targetColor) return;
    setTitleExtraLineColorsByStore({
      ios: SCREENSHOT_TEMPLATE_SLOTS.reduce((acc, targetSlot) => {
        const nextColors = [...(acc[targetSlot] ?? [])].slice(0, MAX_SCREENSHOT_TITLE_EXTRA_LINE_COLORS);
        nextColors[lineIndex] = targetColor;
        acc[targetSlot] = nextColors.slice(0, MAX_SCREENSHOT_TITLE_EXTRA_LINE_COLORS);
        return acc;
      }, { ...titleExtraLineColorsByStore.ios }),
      play_store: SCREENSHOT_TEMPLATE_SLOTS.reduce((acc, targetSlot) => {
        const nextColors = [...(acc[targetSlot] ?? [])].slice(0, MAX_SCREENSHOT_TITLE_EXTRA_LINE_COLORS);
        nextColors[lineIndex] = targetColor;
        acc[targetSlot] = nextColors.slice(0, MAX_SCREENSHOT_TITLE_EXTRA_LINE_COLORS);
        return acc;
      }, { ...titleExtraLineColorsByStore.play_store }),
    });
  }, [resolvedTitleExtraLineColors, titleExtraLineColorsByStore.ios, titleExtraLineColorsByStore.play_store]);

  const handleApplyPaletteFieldToAllSlots = useCallback((key: keyof ScreenshotTemplatePalette) => {
    const nextPalettes: Record<ScreenshotStore, ScreenshotSlotPaletteMap> = {
      ios: { ...slotPalettesByStore.ios },
      play_store: { ...slotPalettesByStore.play_store },
    };
    for (const { id: targetStore } of SCREENSHOT_STORES) {
      for (const targetSlot of SCREENSHOT_TEMPLATE_SLOTS) {
        const basePalette = resolveScreenshotTemplatePalette(
          targetStore,
          nextPalettes[targetStore][targetSlot]
        );
        nextPalettes[targetStore][targetSlot] = resolveScreenshotTemplatePalette(targetStore, {
          ...basePalette,
          [key]: resolvedPalette[key],
        });
      }
    }
    setSlotPalettesByStore(nextPalettes);
  }, [resolvedPalette, slotPalettesByStore.ios, slotPalettesByStore.play_store]);

  const handleApplyBackgroundSettingToAllSlots = useCallback((key: keyof ScreenshotBackgroundSettings) => {
    setBackgroundSettingsByStore({
      ios: SCREENSHOT_TEMPLATE_SLOTS.reduce((acc, targetSlot) => {
        acc[targetSlot] = resolveScreenshotBackgroundSettings({
          ...acc[targetSlot],
          [key]: resolvedBackgroundSettings[key],
        });
        return acc;
      }, { ...backgroundSettingsByStore.ios }),
      play_store: SCREENSHOT_TEMPLATE_SLOTS.reduce((acc, targetSlot) => {
        acc[targetSlot] = resolveScreenshotBackgroundSettings({
          ...acc[targetSlot],
          [key]: resolvedBackgroundSettings[key],
        });
        return acc;
      }, { ...backgroundSettingsByStore.play_store }),
    });
  }, [backgroundSettingsByStore.ios, backgroundSettingsByStore.play_store, resolvedBackgroundSettings]);

  const handleSaveCurrentSettings = useCallback(async () => {
    if (!appId) return;

    const { preset, key } = buildPresetStateForStore(store);
    writeScreenshotDraft(appId, store, preset);
    const pendingTimeout = presetSaveTimeoutsRef.current[store];
    if (pendingTimeout) {
      window.clearTimeout(pendingTimeout);
      presetSaveTimeoutsRef.current[store] = null;
    }
    if (titleTranslationsSaveTimeoutRef.current) {
      window.clearTimeout(titleTranslationsSaveTimeoutRef.current);
      titleTranslationsSaveTimeoutRef.current = null;
    }

    if (!onPresetChange && !onTitleTranslationsChange) {
      persistedPresetKeysRef.current[store] = key;
      persistedTitleTranslationsKeyRef.current = JSON.stringify(titleTranslationsState);
      return;
    }

    setIsPersistingPreset(true);
    try {
      await Promise.all([
        onPresetChange ? Promise.resolve(onPresetChange(store, preset)) : Promise.resolve(),
        onTitleTranslationsChange
          ? Promise.resolve(onTitleTranslationsChange(titleTranslationsState))
          : Promise.resolve(),
      ]);
      persistedPresetKeysRef.current[store] = key;
      persistedTitleTranslationsKeyRef.current = JSON.stringify(titleTranslationsState);
    } finally {
      setIsPersistingPreset(false);
    }
  }, [appId, buildPresetStateForStore, onPresetChange, onTitleTranslationsChange, store, titleTranslationsState]);

  const handleResetSelectedSlot = useCallback(() => {
    setTitleTranslationsState((prev) => ({
      ...prev,
      [activeLocaleKey]: {
        ...(resolveLocaleTitleEntry(prev, activeLocaleKey) ?? {}),
        [slot]: '',
      },
    }));
    setTitlesByStore((prev) => ({
      ios: {
        ...prev.ios,
        [slot]: '',
      },
      play_store: {
        ...prev.play_store,
        [slot]: '',
      },
    }));

    setSlotPalettesByStore((prev) => {
      const nextPalettes: Record<ScreenshotStore, ScreenshotSlotPaletteMap> = {
        ios: { ...prev.ios },
        play_store: { ...prev.play_store },
      };
      for (const { id: targetStore } of SCREENSHOT_STORES) {
        const resetPalette = getScreenshotTemplateDefaultPalette(targetStore);
        for (const field of getScreenshotTemplatePaletteFields(targetStore, slot)) {
          for (const targetSlot of getSlotPaletteTargetsForKey(slot, field.key)) {
            const basePalette = resolveScreenshotTemplatePalette(
              targetStore,
              nextPalettes[targetStore][targetSlot]
            );
            nextPalettes[targetStore][targetSlot] = resolveScreenshotTemplatePalette(targetStore, {
              ...basePalette,
              [field.key]: resetPalette[field.key],
            });
          }
        }
      }
      return nextPalettes;
    });

    setTitleTypographyByStore((prev) => ({
      ios: {
        ...prev.ios,
        [slot]: resolveScreenshotTitleTypography('ios', slot, undefined),
      },
      play_store: {
        ...prev.play_store,
        [slot]: resolveScreenshotTitleTypography('play_store', slot, undefined),
      },
    }));
    setTitleLineGapByStore((prev) => ({
      ios: {
        ...prev.ios,
        [slot]: 0,
      },
      play_store: {
        ...prev.play_store,
        [slot]: 0,
      },
    }));
    setTitleTopPaddingByStore((prev) => ({
      ios: {
        ...prev.ios,
        [slot]: getDefaultTitleTopPadding(iosDeviceFamily),
      },
      play_store: {
        ...prev.play_store,
        [slot]: 0,
      },
    }));
    setTitleCenterByStore((prev) => ({
      ios: {
        ...prev.ios,
        [slot]: false,
      },
      play_store: {
        ...prev.play_store,
        [slot]: false,
      },
    }));
    setTitleExtraLineColorsByStore((prev) => ({
      ios: {
        ...prev.ios,
        [slot]: [],
      },
      play_store: {
        ...prev.play_store,
        [slot]: [],
      },
    }));
    setBackgroundSettingsByStore((prev) => {
      const next = {
        ios: { ...prev.ios },
        play_store: { ...prev.play_store },
      } satisfies Record<ScreenshotStore, ScreenshotSlotBackgroundSettingsStateMap>;
      for (const { id: targetStore } of SCREENSHOT_STORES) {
        for (const targetSlot of getSlotBackgroundSettingsTargets(slot)) {
          next[targetStore][targetSlot] = resolveScreenshotBackgroundSettings();
        }
      }
      return next;
    });

    if (slot > 2) return;

    setHeroPhonePoseByStore((prev) => ({
      ...prev,
      [store]: resolveIosHeroPhonePose(DEFAULT_IOS_HERO_PHONE_POSE),
    }));
    setHeroPhoneShapeByStore((prev) => ({
      ...prev,
      [store]: resolveProceduralDeviceShapeForStore(store, getDefaultProceduralDeviceShape(store, iosDeviceFamily), iosDeviceFamily),
    }));
    setHeroPhoneLocationByStore((prev) => ({
      ...prev,
      [store]: resolveIosHeroPhoneLocation(DEFAULT_IOS_HERO_PHONE_LOCATION),
    }));
    setHeroKeyLightPositionByStore((prev) => ({
      ...prev,
      [store]: resolveProceduralLightPosition(),
    }));
    setHeroKeyLightSettingsByStore((prev) => ({
      ...prev,
      [store]: resolveProceduralKeyLightSettings(),
    }));
    if (slot === 1 || slot === 2) {
      setSlotSbeSettingsByStore((prev) => ({
        ios: {
          ...prev.ios,
          [slot]: resolveSlot1SbeSettings(getDefaultSlotSbeSettings(slot)),
        },
        play_store: {
          ...prev.play_store,
          [slot]: resolveSlot1SbeSettings(getDefaultSlotSbeSettings(slot)),
        },
      }));
    }
    setHeroCameraModeByStore((prev) => ({
      ...prev,
      [store]: resolveProceduralCameraMode(DEFAULT_PROCEDURAL_CAMERA_MODE),
    }));
    setHeroCameraSettingsByStore((prev) => ({
      ...prev,
      [store]: resolveProceduralCameraSettings(getDefaultProceduralCameraSettings(iosDeviceFamily)),
    }));
  }, [activeLocaleKey, iosDeviceFamily, slot, store]);

  const handleGenerateCurrentTitleTranslations = useCallback(async () => {
    if (!onGenerateTitleTranslations) return;
    const sourceTitles = titleTranslationSourceSlots.reduce((acc, targetSlot) => {
      acc[targetSlot] = sourceLocaleTitleMap[targetSlot] ?? '';
      return acc;
    }, {} as Partial<Record<ScreenshotTemplateSlot, string>>);
    setIsGeneratingTitleTranslations(true);
    try {
      const nextTranslations = await Promise.resolve(
        onGenerateTitleTranslations({
          sourceLocale: sourceLocaleKey,
          sourceTitles,
          locales: titleTranslationTargetLocales,
          verify: true,
          provider: titleTranslationProvider,
        })
      );
      if (nextTranslations && typeof nextTranslations === 'object') {
        setTitleTranslationsState((prev) => mergeScreenshotTitleTranslations(prev, nextTranslations));
      }
    } finally {
      setIsGeneratingTitleTranslations(false);
    }
  }, [
    onGenerateTitleTranslations,
    sourceLocaleKey,
    sourceLocaleTitleMap,
    titleTranslationProvider,
    titleTranslationSourceSlots,
    titleTranslationTargetLocales,
  ]);

  const handleHeroPhonePoseChange = useCallback(
    (key: keyof IosHeroPhonePose, value: number) => {
    setHeroPhonePoseByStore((prev) => ({
      ...prev,
      [store]: resolveIosHeroPhonePose({
          ...(prev[store] ?? DEFAULT_IOS_HERO_PHONE_POSE),
          [key]: value,
        }),
    }));
    },
    [store]
  );

  const handleHeroPhoneShapeChange = useCallback(
    (key: keyof IosHeroPhoneShape, value: number) => {
      setHeroPhoneShapeByStore((prev) => ({
        ...prev,
        [store]: resolveProceduralDeviceShapeForStore(store, {
          ...(prev[store] ?? getDefaultProceduralDeviceShape(store, iosDeviceFamily)),
          [key]: value,
        }, iosDeviceFamily),
      }));
    },
    [iosDeviceFamily, store]
  );

  const handleHeroPhoneLocationChange = useCallback(
    (key: keyof ProceduralDeviceLocation, value: number) => {
    setHeroPhoneLocationByStore((prev) => ({
      ...prev,
      [store]: resolveIosHeroPhoneLocation({
          ...(prev[store] ?? DEFAULT_IOS_HERO_PHONE_LOCATION),
          [key]: value,
        }),
    }));
    },
    [store]
  );

  const handleHeroKeyLightSettingsChange = useCallback(
    (
      key: keyof ProceduralKeyLightSettings,
      value: number | string
    ) => {
      setHeroKeyLightSettingsByStore((prev) => {
        const nextSettings = resolveProceduralKeyLightSettings({
          ...(prev[store] ?? resolveProceduralKeyLightSettings()),
          [key]: value,
        });
        setHeroKeyLightPositionByStore((prevPositions) => ({
          ...prevPositions,
          [store]: proceduralKeyLightPositionFromSettings(nextSettings),
        }));
        return {
          ...prev,
          [store]: nextSettings,
        };
      });
    },
    [store]
  );

  const handleHeroCameraSettingsChange = useCallback(
    (key: keyof ProceduralCameraSettings, value: number) => {
      setHeroCameraSettingsByStore((prev) => ({
        ...prev,
        [store]: resolveProceduralCameraSettings({
          ...(prev[store] ?? DEFAULT_PROCEDURAL_CAMERA_SETTINGS),
          [key]: value,
        }),
      }));
    },
    [store]
  );

  const handleSlot1SbeSettingsChange = useCallback(
    (key: keyof Slot1SbeSettings, value: number | string) => {
      if (slot > 2) return;
      const heroSlot = slot === 2 ? 2 : 1;
      setSlotSbeSettingsByStore((prev) => ({
        ios: {
          ...prev.ios,
          [slot]: resolveSlot1SbeSettings({
            ...(prev.ios?.[slot] ?? getDefaultSlotSbeSettings(heroSlot)),
            [key]: value,
          }),
        },
        play_store: {
          ...prev.play_store,
          [slot]: resolveSlot1SbeSettings({
            ...(prev.play_store?.[slot] ?? getDefaultSlotSbeSettings(heroSlot)),
            [key]: value,
          }),
        },
      }));
    },
    [slot]
  );

  const renderBrowserScreenshotCanvas = useCallback(async (
    targetSlot: ScreenshotTemplateSlot,
    screenshotDataUrl?: string,
    targetLocale = activeLocaleKey,
    targetTitles?: Partial<Record<ScreenshotTemplateSlot, string>>
  ) => {
    const slotTitle =
      targetTitles?.[targetSlot] ??
      createTitleMapForLocale(
        titleTranslationsState,
        targetLocale,
        activeLocaleTitleMap
      )[targetSlot] ??
      '';
    const titleTemplateContext = resolveTitleTemplateContext(store, targetLocale);
    const slotTitleTypography = resolveScreenshotTitleTypography(
      store,
      targetSlot,
      titleTypographyByStore[store]?.[targetSlot]
    );
    const slotPalette = resolveScreenshotTemplatePalette(
      store,
      slotPalettesByStore[store]?.[targetSlot]
    );
    const slotTitleLines = buildTitleLines(targetSlot, slotTitle, titleTemplateContext);
    const slotPrimaryColor = getDefaultScreenshotTitlePrimaryColor(store, targetSlot, slotPalette);
    const slotTitleExtraLineColors = syncScreenshotTitleExtraLineColors(
      titleExtraLineColorsByStore[store]?.[targetSlot],
      slotTitleLines.length,
      slotPrimaryColor
    );
    const slotTitleLineGap = titleLineGapByStore[store]?.[targetSlot] ?? 0;
    const slotTitleTopPadding = titleTopPaddingByStore[store]?.[targetSlot] ?? 0;
    const slotTitleCenter = parseScreenshotTitleCenterInput(
      titleCenterByStore[store]?.[targetSlot],
      false
    );
    const slotBackgroundSettings = resolveScreenshotBackgroundSettings(
      backgroundSettingsByStore[store]?.[targetSlot]
    );

    const targetSlotSbeSettings =
      targetSlot <= 2 ? resolveSlot1SbeSettings(slotSbeSettingsByStore[store]?.[targetSlot]) : null;

    await ensureGoogleFontsLoaded([
      {
        family: slotTitleTypography.fontFamily,
        weights: [slotTitleTypography.fontWeight],
      },
    ]);

    const canvas = document.createElement('canvas');
    canvas.width = previewCanvasSize.width;
    canvas.height = previewCanvasSize.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Screenshot canvas context alınamadı.');
    }

    if (targetSlot <= 2) {
      return renderIosProceduralHeroComposite({
        store,
        slot: targetSlot as 1 | 2,
        title: slotTitle,
        titleTemplateContext,
        titleTypography: slotTitleTypography,
        titleExtraLineColors: slotTitleExtraLineColors,
        titleLineGap: slotTitleLineGap,
        titleTopPadding: slotTitleTopPadding,
        titleCenter: slotTitleCenter,
        backgroundSettings: slotBackgroundSettings,
        palette: slotPalette,
        screenshotUrl: screenshotDataUrl ?? '',
        imageLoader: browserImageLoader,
        heroPhonePose: resolvedHeroPhonePose,
        heroPhoneShape: resolvedHeroPhoneShape,
        heroPhoneLocation: resolvedHeroPhoneLocation,
        heroKeyLightPosition: resolvedHeroKeyLightPosition,
        heroKeyLightSettings: resolvedHeroKeyLightSettings,
        slot1SbeSettings: targetSlotSbeSettings,
        heroCameraMode: resolvedHeroCameraMode,
        heroCameraSettings: resolvedHeroCameraSettings,
        width: previewCanvasSize.width,
        height: previewCanvasSize.height,
        targetCanvas: canvas,
      });
    }

    await drawStoreScreenshotToContext(ctx, browserImageLoader, {
      store,
      iosDeviceFamily,
      slot: targetSlot,
      title: slotTitle,
      titleTemplateContext,
      titleTypography: slotTitleTypography,
      titleExtraLineColors: slotTitleExtraLineColors,
      titleLineGap: slotTitleLineGap,
      titleTopPadding: slotTitleTopPadding,
      titleCenter: slotTitleCenter,
      backgroundSettings: slotBackgroundSettings,
      palette: slotPalette,
      heroPhonePose: resolvedHeroPhonePose,
      heroPhoneShape: resolvedHeroPhoneShape,
      screenshotSource: screenshotDataUrl || undefined,
    });
    return canvas;
  }, [activeLocaleKey, activeLocaleTitleMap, backgroundSettingsByStore, browserImageLoader, iosDeviceFamily, previewCanvasSize.height, previewCanvasSize.width, resolveTitleTemplateContext, resolvedHeroCameraMode, resolvedHeroCameraSettings, resolvedHeroKeyLightPosition, resolvedHeroKeyLightSettings, resolvedHeroPhoneLocation, resolvedHeroPhonePose, resolvedHeroPhoneShape, slotPalettesByStore, slotSbeSettingsByStore, store, titleCenterByStore, titleExtraLineColorsByStore, titleLineGapByStore, titleTopPaddingByStore, titleTranslationsState, titleTypographyByStore]);

  const togglePanel = useCallback((key: PanelKey) => {
    setPanelState((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const activeTypographyMap = titleTypographyByStore[store];
    const requests = SCREENSHOT_TEMPLATE_SLOTS.map((entry) => ({
      family: activeTypographyMap[entry].fontFamily,
      weights: [activeTypographyMap[entry].fontWeight],
    }));

    let isCancelled = false;
    void ensureGoogleFontsLoaded(requests).then(() => {
      if (isCancelled) return;
      setFontLoadVersion((prev) => prev + 1);
    });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, store, titleTypographyByStore]);

  useEffect(() => {
    if (!isOpen) return;
    const localeKey = findZipLocaleKey(zipManifestByStore[store], locale);
    const archive = zipArchivesRef.current[store];
    if (!archive || !localeKey) {
      setZipPreviewUrlsByStore((prev) => ({
        ...prev,
        [store]: createEmptySlotPreviewUrlMap(),
      }));
      setZipPreviewErrorsByStore((prev) => ({
        ...prev,
        [store]: createEmptySlotPreviewErrorMap(),
      }));
      return;
    }

    const requestKey = store;
    const requestId = (zipPreviewRequestIdsRef.current[requestKey] ?? 0) + 1;
    zipPreviewRequestIdsRef.current[requestKey] = requestId;

    void (async () => {
      const dataUrls = await loadZipLocaleScreenshotDataUrls(store, localeKey);
      if (zipPreviewRequestIdsRef.current[requestKey] !== requestId) return;
      setZipPreviewUrlsByStore((prev) => ({
        ...prev,
        [store]: {
          ...createEmptySlotPreviewUrlMap(),
          ...dataUrls,
        },
      }));
      setZipPreviewErrorsByStore((prev) => ({
        ...prev,
        [store]: createEmptySlotPreviewErrorMap(),
      }));
    })().catch((error) => {
      if (zipPreviewRequestIdsRef.current[requestKey] !== requestId) return;
      setZipPreviewUrlsByStore((prev) => ({
        ...prev,
        [store]: createEmptySlotPreviewUrlMap(),
      }));
      setZipPreviewErrorsByStore((prev) => ({
        ...prev,
        [store]: {
          ...createEmptySlotPreviewErrorMap(),
          [slot]: error instanceof Error ? error.message : 'ZIP preview okunamadı.',
        },
      }));
    });
  }, [isOpen, loadZipLocaleScreenshotDataUrls, locale, slot, store, zipManifestByStore]);

  useEffect(() => {
    if (activeScreenshotSlots.includes(slot)) return;
    setSlot(activeScreenshotSlots[0] ?? 1);
  }, [activeScreenshotSlots, slot]);

  useEffect(() => {
    if (!isOpen) return;
    setTitleExtraLineColorsByStore((prev) => {
      const currentSlotColors = prev[store]?.[slot] ?? [];
      const nextSlotColors = syncScreenshotTitleExtraLineColors(
        currentSlotColors,
        resolvedTitleLines.length,
        resolvedPrimaryTitleColor
      );
      if (
        currentSlotColors.length === nextSlotColors.length &&
        currentSlotColors.every((color, index) => color === nextSlotColors[index])
      ) {
        return prev;
      }
      return {
        ios: {
          ...prev.ios,
          [slot]: nextSlotColors,
        },
        play_store: {
          ...prev.play_store,
          [slot]: nextSlotColors,
        },
      };
    });
  }, [isOpen, resolvedPrimaryTitleColor, resolvedTitleLines.length, slot, store]);

  useEffect(() => () => {
    for (const { id: targetStore } of SCREENSHOT_STORES) {
      const pendingTimeout = presetSaveTimeoutsRef.current[targetStore];
      if (pendingTimeout) {
        window.clearTimeout(pendingTimeout);
        presetSaveTimeoutsRef.current[targetStore] = null;
      }
    }
    if (titleTranslationsSaveTimeoutRef.current) {
      window.clearTimeout(titleTranslationsSaveTimeoutRef.current);
      titleTranslationsSaveTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isOpen || !isTitleInfoOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (titleInfoPopoverRef.current?.contains(target)) return;
      setIsTitleInfoOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isOpen, isTitleInfoOpen]);

  const dialogRef = useDialogController(isOpen, onClose);

  return (
    <dialog ref={dialogRef} className="generate-dialog screenshots-dialog">
      <section className="card rules-modal screenshots-modal">
        <div className="generate-header">
          <h2>Screenshots</h2>
          <div className="modal-actions">
            <Button type="button" variant="danger" onClick={onClose} disabled={isLocked}>
              Kapat
            </Button>
          </div>
        </div>

        <div className="screenshot-toolbar">
          <div className="screenshot-toggle-group">
            {SCREENSHOT_STORES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`screenshot-toggle-btn${item.id === store ? ' active' : ''}`}
                disabled={isLocked}
                onClick={() => setStore(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          {isIosStore ? (
            <>
              <span className="screenshot-toolbar-sep" />
              <div className="screenshot-toggle-group secondary">
                {IOS_SCREENSHOT_DEVICE_FAMILIES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`screenshot-toggle-btn${item.id === iosDeviceFamily ? ' active' : ''}`}
                    disabled={isLocked}
                    onClick={() => switchIosDeviceFamily(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>

        <div
          ref={editorRef}
          className={`screenshots-editor${isResizingSidebar ? ' is-resizing' : ''}`}
          style={{ '--screenshots-sidebar-width': `${sidebarWidth}px` } as CSSProperties}
        >
          <section className="screenshots-preview-column">
            <div className="screenshots-preview-head">
              <div>
                <strong>Canvas Şeridi</strong>
                <span>
                  {isIosStore ? `${getIosScreenshotDeviceFamilyLabel(iosDeviceFamily)} · ` : ''}
                  Seçili slot: {slot} · sağa kaydır
                </span>
              </div>
                <span className="screenshots-preview-badge">
                {previewCanvasSize.width}×{previewCanvasSize.height}
              </span>
            </div>

            <div className="screenshots-thumb-grid">
              {activeScreenshotSlots.map((previewSlot) => (
                <PreviewCanvasCard
                  key={`${store}-${iosDeviceFamily}-${previewSlot}`}
                  store={store}
                  iosDeviceFamily={iosDeviceFamily}
                  slot={previewSlot}
                  title={activeLocaleTitleMap[previewSlot]}
                  titleTemplateContext={resolveTitleTemplateContext(store, activeLocaleKey)}
                  titleTypography={titleTypographyByStore[store][previewSlot]}
                  titleExtraLineColors={titleExtraLineColorsByStore[store][previewSlot] ?? []}
                  titleLineGap={titleLineGapByStore[store]?.[previewSlot] ?? 0}
                  titleTopPadding={titleTopPaddingByStore[store]?.[previewSlot] ?? 0}
                  titleCenter={parseScreenshotTitleCenterInput(titleCenterByStore[store]?.[previewSlot], false)}
                  backgroundSettings={resolveScreenshotBackgroundSettings(
                    backgroundSettingsByStore[store]?.[previewSlot]
                  )}
                  palette={slotPalettesByStore[store][previewSlot]}
                  heroPhonePose={
                    previewSlot <= 2
                      ? resolvedHeroPhonePose
                      : null
                  }
                  heroPhoneShape={resolvedHeroPhoneShape}
                  heroPhoneLocation={previewSlot <= 2 ? resolvedHeroPhoneLocation : null}
                  heroKeyLightPosition={previewSlot <= 2 ? resolvedHeroKeyLightPosition : null}
                  heroKeyLightSettings={previewSlot <= 2 ? resolvedHeroKeyLightSettings : null}
                  slot1SbeSettings={
                    previewSlot <= 2
                      ? resolveSlot1SbeSettings(slotSbeSettingsByStore[store]?.[previewSlot])
                      : null
                  }
                  heroCameraMode={previewSlot <= 2 ? resolvedHeroCameraMode : null}
                  heroCameraSettings={previewSlot <= 2 ? resolvedHeroCameraSettings : null}
                  screenshotUrl={
                    zipPreviewUrlsByStore[store]?.[previewSlot] ||
                    filePreviewUrlsByStore[store]?.[previewSlot] ||
                    ''
                  }
                  imageLoader={browserImageLoader}
                  fontLoadVersion={fontLoadVersion}
                  disabled={isLocked}
                  selected={previewSlot === slot}
                  onSelect={setSlot}
                />
              ))}
            </div>
          </section>

          <div
            className="screenshots-sidebar-resizer"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize settings panel"
            onPointerDown={handleSidebarResizeStart}
          />

          <aside className="screenshots-sidebar">
            <div className="screenshot-form-grid screenshots-top-grid">
              <label>
                Source Locale
                <input
                  type="text"
                  value={sourceLocale}
                  onChange={(event) => setSourceLocale(event.target.value)}
                  placeholder="en_US"
                  disabled={isLocked}
                />
              </label>

              <label>
                Locales
                <select
                  value={activeZipLocaleKey ?? locale}
                  onChange={(event) => setLocale(event.target.value)}
                  disabled={isLocked}
                >
                  {zipLocaleKeys.length > 0 ? (
                    zipLocaleKeys.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))
                  ) : (
                    <option value={locale.trim() || defaultLocale.trim() || 'en-US'}>
                      {locale.trim() || defaultLocale.trim() || 'en-US'}
                    </option>
                  )}
                </select>
              </label>

              <label>
                Slot
                <select
                  value={String(slot)}
                  onChange={(event) => setSlot(Number(event.target.value) as ScreenshotTemplateSlot)}
                  disabled={isLocked}
                >
                  {activeScreenshotSlots.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="screenshot-file-field">
              Screenshots ZIP
              <input
                type="file"
                accept=".zip,application/zip,application/x-zip-compressed"
                disabled={isLocked}
                onChange={(event) => {
                  const nextFile = event.target.files?.[0] ?? null;
                  handleZipFileChange(nextFile);
                  event.currentTarget.value = '';
                }}
              />
            </label>

            <div className="screenshot-file-meta">
              {zipFilesByStore[store]
                ? `${zipFilesByStore[store]?.name} - ${zipLocaleKeys.length} locale`
                : 'Henüz ZIP seçilmedi.'}
            </div>
            {zipLocaleKeys.length > 0 ? (
              <section className="screenshots-zip-summary">
                <div className="screenshots-zip-summary-head">
                  <strong>ZIP Özeti</strong>
                  <span>
                    {zipCompleteLocaleCount}/{zipLocaleKeys.length} locale tam
                  </span>
                </div>
                <div className="screenshots-zip-summary-list">
                  {zipLocaleSummary.map((entry) => (
                    <div
                      key={entry.locale}
                      className={`screenshots-zip-summary-item${
                        entry.locale === activeZipLocaleKey ? ' active' : ''
                      }`}
                    >
                      <strong>{entry.locale}</strong>
                      <span>
                        {entry.isComplete
                          ? `${activeSlotRangeLabel} hazır`
                          : `Eksik: ${entry.missingSlots.join(', ')}`}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <label className="screenshot-file-field">
              Screenshot Fallback
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                disabled={isLocked}
                onChange={(event) => {
                  const nextFile = event.target.files?.[0] ?? null;
                  handleSlotFileChange(nextFile);
                  event.currentTarget.value = '';
                }}
              />
            </label>

            <div className="screenshot-file-meta">
              {selectedZipEntry
                ? `${activeZipLocaleKey}/${selectedZipEntry.fileName}`
                : selectedSlotFile
                ? `${selectedSlotFile.name} - ${formatFileSize(selectedSlotFile.size)}`
                : 'Henüz dosya seçilmedi.'}
            </div>
            {selectedSlotPreviewError ? (
              <div className="screenshot-file-error">{selectedSlotPreviewError}</div>
            ) : null}

            <div className="screenshot-title-field">
              <div className="screenshots-field-head">
                <strong>Title</strong>
                <div className="screenshots-field-inline-actions">
                  <div className="screenshots-help-anchor" ref={titleInfoPopoverRef}>
                    <InfoButton
                      label="Title syntax help"
                      isOpen={isTitleInfoOpen}
                      onToggle={() => setIsTitleInfoOpen((prev) => !prev)}
                    />
                    {isTitleInfoOpen ? (
                      <div className="screenshots-help-popover" role="dialog" aria-label="Title syntax help">
                        <strong>Title syntax</strong>
                        <p>
                          <code>{'{{LocaleAppName}}'}</code> yazarsan o locale&apos;in app title&apos;ı gelir.
                        </p>
                        <p>
                          Örnek: <code>{'Play {{LocaleAppName}} today'}</code>
                        </p>
                        <p>
                          <code>{'{{Empty}}'}</code> yazarsan title tamamen boş olur.
                        </p>
                      </div>
                    ) : null}
                  </div>
                  <ApplyAllButton
                    label="Apply title for all slots"
                    disabled={isLocked}
                    onApply={handleApplyTitleValueToAllSlots}
                  />
                </div>
              </div>
              <textarea
                value={resolvedTitle}
                onChange={(event) => handleTitleChange(event.target.value)}
                placeholder="Save unlimited photos"
                rows={3}
                disabled={isLocked}
              />
            </div>

            {resolvedTitleLines.length > 1 ? (
              <div className="screenshot-title-field">
                <div className="screenshots-field-head">
                  <strong>Line Gap</strong>
                  <ApplyAllButton
                    label="Apply line gap for all slots"
                    disabled={isLocked}
                    onApply={handleApplyTitleLineGapToAllSlots}
                  />
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  value={resolvedTitleLineGap}
                  onChange={(event) => handleTitleLineGapChange(Number(event.target.value))}
                  disabled={isLocked}
                />
              </div>
            ) : null}

            <div className="screenshot-title-field">
              <div className="screenshots-field-head">
                <strong>Center Title</strong>
                <ApplyAllButton
                  label="Apply title centering for all slots"
                  disabled={isLocked}
                  onApply={handleApplyTitleCenterToAllSlots}
                />
              </div>
              <label className="screenshots-checkbox-row">
                <input
                  type="checkbox"
                  checked={resolvedTitleCenter}
                  onChange={(event) => handleTitleCenterChange(event.target.checked)}
                  disabled={isLocked}
                />
                <span>Title ortalansın</span>
              </label>
            </div>

            <div className="screenshot-form-grid">
              <div className="screenshot-title-field">
                <div className="screenshots-field-head">
                  <strong>Font</strong>
                  <ApplyAllButton
                    label="Apply font family for all slots"
                    disabled={isLocked}
                    onApply={() => handleApplyTitleTypographyFieldToAllSlots('fontFamily')}
                  />
                </div>
                <select
                  value={resolvedTitleTypography.fontFamily}
                  onChange={(event) => handleTitleTypographyChange('fontFamily', event.target.value)}
                  disabled={isLocked}
                >
                  {GOOGLE_FONT_FAMILIES.map((fontFamily) => (
                    <option key={fontFamily} value={fontFamily}>
                      {fontFamily}
                    </option>
                  ))}
                </select>
              </div>

              <div className="screenshot-title-field">
                <div className="screenshots-field-head">
                  <strong>Size</strong>
                  <ApplyAllButton
                    label="Apply font size for all slots"
                    disabled={isLocked}
                    onApply={() => handleApplyTitleTypographyFieldToAllSlots('fontSize')}
                  />
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  value={resolvedTitleTypography.fontSize}
                  onChange={(event) => handleTitleTypographyChange('fontSize', event.target.value)}
                  disabled={isLocked}
                />
              </div>

              <div className="screenshot-title-field">
                <div className="screenshots-field-head">
                  <strong>Weight</strong>
                  <ApplyAllButton
                    label="Apply font weight for all slots"
                    disabled={isLocked}
                    onApply={() => handleApplyTitleTypographyFieldToAllSlots('fontWeight')}
                  />
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={resolvedTitleTypography.fontWeight}
                  onChange={(event) => handleTitleTypographyChange('fontWeight', event.target.value)}
                  disabled={isLocked}
                />
              </div>

              <div className="screenshot-title-field">
                <div className="screenshots-field-head">
                  <strong>Top Padding</strong>
                  <ApplyAllButton
                    label="Apply title top padding for all slots"
                    disabled={isLocked}
                    onApply={handleApplyTitleTopPaddingToAllSlots}
                  />
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  value={resolvedTitleTopPadding}
                  onChange={(event) => handleTitleTopPaddingChange(Number(event.target.value))}
                  disabled={isLocked}
                />
              </div>
            </div>

            <div className="screenshots-panel-actions">
              <Button
                type="button"
                variant="ghost"
                disabled={isLocked}
                onClick={handleResetSelectedSlot}
              >
                Fabrika Ayarlarına Dön
              </Button>
            </div>

            <section className="screenshots-palette-panel">
              <button
                type="button"
                className="screenshots-accordion-head"
                onClick={() => togglePanel('color')}
                disabled={isLocked}
              >
                <div>
                  <strong>Color</strong>
                </div>
                <span>{panelState.color ? '−' : '+'}</span>
              </button>

              {panelState.color ? (
                <div className="screenshots-palette-grid">
                  {paletteFields.map((field) => (
                    <div key={field.key} className="screenshots-palette-item">
                      <div className="screenshots-palette-copy screenshots-field-head">
                        <strong>{field.label}</strong>
                        <ApplyAllButton
                          label={`Apply ${field.label} for all slots`}
                          disabled={isLocked}
                          onApply={() => handleApplyPaletteFieldToAllSlots(field.key)}
                        />
                      </div>
                      <div className="screenshots-palette-controls">
                        <input
                          type="color"
                          value={resolvedPalette[field.key]}
                          disabled={isLocked}
                          onChange={(event) => handlePaletteChange(field.key, event.target.value)}
                        />
                        <code>{resolvedPalette[field.key]}</code>
                      </div>
                    </div>
                  ))}
                  {resolvedTitleExtraLineColors.map((color, index) => (
                    <div key={`title-line-${index + 2}`} className="screenshots-palette-item">
                      <div className="screenshots-palette-copy screenshots-field-head">
                        <strong>Line {index + 2}</strong>
                        <ApplyAllButton
                          label={`Apply line ${index + 2} color for all slots`}
                          disabled={isLocked}
                          onApply={() => handleApplyExtraLineColorToAllSlots(index)}
                        />
                      </div>
                      <div className="screenshots-palette-controls">
                        <input
                          type="color"
                          value={color}
                          disabled={isLocked}
                          onChange={(event) =>
                    handleTitleExtraLineColorChange(index, event.target.value)
                          }
                        />
                        <code>{color}</code>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="screenshots-palette-panel">
              <button
                type="button"
                className="screenshots-accordion-head"
                onClick={() => togglePanel('background')}
                disabled={isLocked}
              >
                <div>
                  <strong>Background</strong>
                </div>
                <span>{panelState.background ? '−' : '+'}</span>
              </button>

              {panelState.background ? (
                <div className="screenshots-shape-grid">
                  {([
                    ['topStop', 'Top Stop', 0.01],
                    ['midStop', 'Mid Stop', 0.01],
                    ['bottomStop', 'Bottom Stop', 0.01],
                    ['midMix', 'Mid Mix', 0.01],
                    ['bottomMix', 'Bottom Mix', 0.01],
                  ] as const).map(([key, label, step]) => (
                    <div key={key} className="screenshots-shape-item">
                      <div className="screenshots-slider-copy">
                        <strong>{label}</strong>
                        <div className="screenshots-field-inline-actions">
                          <code>{resolvedBackgroundSettings[key]}</code>
                          <ApplyAllButton
                            label={`Apply ${label} for all slots`}
                            disabled={isLocked}
                            onApply={() => handleApplyBackgroundSettingToAllSlots(key)}
                          />
                        </div>
                      </div>
                      <input
                        type="number"
                        step={step}
                        value={resolvedBackgroundSettings[key]}
                        disabled={isLocked}
                        onChange={(event) =>
                          handleBackgroundSettingsChange(key, Number(event.target.value))
                        }
                      />
                    </div>
                  ))}
                </div>
              ) : null}
            </section>

            {slot <= 2 ? (
              <section className="screenshots-palette-panel">
                <button
                  type="button"
                  className="screenshots-accordion-head"
                  onClick={() => togglePanel('sbe')}
                  disabled={isLocked}
                >
                  <div>
                    <strong>SBE</strong>
                  </div>
                  <span>{panelState.sbe ? '−' : '+'}</span>
                </button>

                {panelState.sbe ? (
                  <div className="screenshots-shape-grid">
                    {([
                      ['lineWidth', 'Line Width', 0.1],
                      ['opacity', 'Opacity', 0.01],
                      ['scale', 'Scale', 0.01],
                      ['angleDeg', 'Angle', 0.1],
                      ['copyCount', 'Count', 1],
                      ['positionX', 'Position X', 1],
                      ['positionY', 'Position Y', 1],
                      ['originX', 'Origin X', 1],
                      ['originY', 'Origin Y', 1],
                      ['originZ', 'Origin Z', 0.01],
                    ] as const).map(([key, label, step]) => (
                      <label key={key} className="screenshots-shape-item">
                        <div className="screenshots-slider-copy">
                          <strong>{label}</strong>
                          <code>{resolvedSelectedSlotSbeSettings?.[key] ?? 0}</code>
                        </div>
                        <input
                          type="number"
                          step={step}
                          value={resolvedSelectedSlotSbeSettings?.[key] ?? 0}
                          disabled={isLocked}
                          onChange={(event) =>
                            handleSlot1SbeSettingsChange(key, Number(event.target.value))
                          }
                        />
                      </label>
                    ))}
                    <label className="screenshots-palette-item">
                      <div className="screenshots-palette-copy">
                        <strong>Line Color</strong>
                      </div>
                      <div className="screenshots-palette-controls">
                        <input
                          type="color"
                          value={resolvedSelectedSlotSbeSettings?.lineColor ?? '#f38219'}
                          disabled={isLocked}
                          onChange={(event) =>
                            handleSlot1SbeSettingsChange('lineColor', event.target.value)
                          }
                        />
                        <code>{resolvedSelectedSlotSbeSettings?.lineColor ?? '#f38219'}</code>
                      </div>
                    </label>
                  </div>
                ) : null}
              </section>
            ) : null}

            {isHeroSlot ? (
              <section className="screenshots-palette-panel">
                <button
                  type="button"
                  className="screenshots-accordion-head"
                  onClick={() => togglePanel('light')}
                  disabled={isLocked}
                >
                  <div>
                    <strong>Light</strong>
                  </div>
                  <span>{panelState.light ? '−' : '+'}</span>
                </button>

                {panelState.light ? (
                  <div className="screenshots-shape-grid">
                    {([
                      ['azimuthDeg', 'Azimuth', -3600, 3600, 0.1],
                      ['elevationDeg', 'Elevation', -89.9, 89.9, 0.1],
                      ['distance', 'Distance', 0.01, 4000, 0.1],
                      ['intensity', 'Intensity', 0, 100, 0.01],
                    ] as const).map(([key, label, min, max, step]) => (
                      <label key={key} className="screenshots-shape-item">
                        <div className="screenshots-slider-copy">
                          <strong>{label}</strong>
                          <code>{resolvedHeroKeyLightSettings?.[key] ?? 0}</code>
                        </div>
                        <input
                          type="number"
                          min={min}
                          max={max}
                          step={step}
                          value={resolvedHeroKeyLightSettings?.[key] ?? 0}
                          disabled={isLocked || slot > 2}
                          onChange={(event) =>
                            handleHeroKeyLightSettingsChange(key, Number(event.target.value))
                          }
                        />
                      </label>
                    ))}
                    <label className="screenshots-palette-item">
                      <div className="screenshots-palette-copy">
                        <strong>Light Color</strong>
                      </div>
                      <div className="screenshots-palette-controls">
                        <input
                          type="color"
                          value={resolvedHeroKeyLightSettings?.color ?? '#ffffff'}
                          disabled={isLocked || slot > 2}
                          onChange={(event) =>
                            handleHeroKeyLightSettingsChange('color', event.target.value)
                          }
                        />
                        <code>{resolvedHeroKeyLightSettings?.color ?? '#ffffff'}</code>
                      </div>
                    </label>
                  </div>
                ) : null}
              </section>
            ) : null}

            {isHeroSlot ? (
              <section className="screenshots-palette-panel">
                <button
                  type="button"
                  className="screenshots-accordion-head"
                  onClick={() => togglePanel('rotation')}
                  disabled={isLocked}
                >
                  <div>
                    <strong>Rotation</strong>
                  </div>
                  <span>{panelState.rotation ? '−' : '+'}</span>
                </button>

                {panelState.rotation ? (
                  <div className="screenshots-slider-grid">
                    {([
                      ['rotateX', 'Rotate X', 0, 360],
                      ['rotateY', 'Rotate Y', 0, 360],
                      ['rotateZ', 'Rotate Z', 0, 360],
                    ] as const).map(([key, label, min, max]) => (
                      <label key={key} className="screenshots-slider-item">
                        <div className="screenshots-slider-copy">
                          <strong>{label}</strong>
                          <code>{Math.round(resolvedHeroPhonePose?.[key] ?? 0)}deg</code>
                        </div>
                        <div className="screenshots-slider-controls">
                          <input
                            type="range"
                            min={min}
                            max={max}
                            step="1"
                            value={resolvedHeroPhonePose?.[key] ?? 0}
                            disabled={isLocked || slot > 2}
                            onChange={(event) => handleHeroPhonePoseChange(key, Number(event.target.value))}
                          />
                          <input
                            type="number"
                            value={Math.round(resolvedHeroPhonePose?.[key] ?? 0)}
                            disabled={isLocked || slot > 2}
                            onChange={(event) => handleHeroPhonePoseChange(key, Number(event.target.value))}
                          />
                        </div>
                      </label>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}

            {isHeroSlot ? (
              <section className="screenshots-palette-panel">
                <button
                  type="button"
                  className="screenshots-accordion-head"
                  onClick={() => togglePanel('location')}
                  disabled={isLocked}
                >
                  <div>
                    <strong>Location</strong>
                  </div>
                  <span>{panelState.location ? '−' : '+'}</span>
                </button>

                {panelState.location ? (
                  <div className="screenshots-shape-grid">
                    {([
                      ['x', 'X', -240, 240, 1],
                      ['y', 'Y', -240, 240, 1],
                      ['z', 'Z', -240, 240, 1],
                    ] as const).map(([key, label, min, max, step]) => (
                      <label key={key} className="screenshots-shape-item">
                        <div className="screenshots-slider-copy">
                          <strong>{label}</strong>
                          <code>{Math.round(resolvedHeroPhoneLocation?.[key] ?? 0)}</code>
                        </div>
                        <input
                          type="number"
                          min={min}
                          max={max}
                          step={step}
                          value={Math.round(resolvedHeroPhoneLocation?.[key] ?? 0)}
                          disabled={isLocked || slot > 2}
                          onChange={(event) =>
                            handleHeroPhoneLocationChange(key, Number(event.target.value))
                          }
                        />
                      </label>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}

            {isHeroSlot ? (
              <section className="screenshots-palette-panel">
                <div className="screenshots-accordion-head static">
                  <div>
                    <strong>Camera</strong>
                  </div>
                </div>
                <div className="screenshots-panel-actions">
                  <Button
                    type="button"
                    variant={resolvedHeroCameraMode === 'perspective' ? 'primary' : 'ghost'}
                    disabled={isLocked}
                    onClick={() =>
                      setHeroCameraModeByStore((prev) => ({ ...prev, [store]: 'perspective' }))
                    }
                  >
                    Perspective
                  </Button>
                  <Button
                    type="button"
                    variant={resolvedHeroCameraMode === 'orthographic' ? 'primary' : 'ghost'}
                    disabled={isLocked}
                    onClick={() =>
                      setHeroCameraModeByStore((prev) => ({ ...prev, [store]: 'orthographic' }))
                    }
                  >
                    Orthographic
                  </Button>
                </div>
                <div className="screenshots-shape-grid">
                  {resolvedHeroCameraMode === 'perspective' ? (
                    <label className="screenshots-shape-item">
                      <div className="screenshots-slider-copy">
                        <strong>FOV</strong>
                        <code>
                          {resolvedHeroCameraSettings?.perspectiveFov ??
                            DEFAULT_PROCEDURAL_CAMERA_SETTINGS.perspectiveFov}
                        </code>
                      </div>
                      <input
                        type="number"
                        value={
                          resolvedHeroCameraSettings?.perspectiveFov ??
                          DEFAULT_PROCEDURAL_CAMERA_SETTINGS.perspectiveFov
                        }
                        disabled={isLocked || slot > 2}
                        onChange={(event) =>
                          handleHeroCameraSettingsChange('perspectiveFov', Number(event.target.value))
                        }
                      />
                    </label>
                  ) : (
                    <label className="screenshots-shape-item">
                      <div className="screenshots-slider-copy">
                        <strong>Frustum Height</strong>
                        <code>
                          {resolvedHeroCameraSettings?.orthographicFrustumHeight ??
                            DEFAULT_PROCEDURAL_CAMERA_SETTINGS.orthographicFrustumHeight}
                        </code>
                      </div>
                      <input
                        type="number"
                        value={
                          resolvedHeroCameraSettings?.orthographicFrustumHeight ??
                          DEFAULT_PROCEDURAL_CAMERA_SETTINGS.orthographicFrustumHeight
                        }
                        disabled={isLocked || slot > 2}
                        onChange={(event) =>
                          handleHeroCameraSettingsChange(
                            'orthographicFrustumHeight',
                            Number(event.target.value)
                          )
                        }
                      />
                    </label>
                  )}
                </div>
              </section>
            ) : null}

            {isHeroSlot ? (
              <section className="screenshots-palette-panel">
                <button
                  type="button"
                  className="screenshots-accordion-head"
                  onClick={() => togglePanel('shape')}
                  disabled={isLocked}
                >
                  <div>
                    <strong>Shape</strong>
                  </div>
                  <span>{panelState.shape ? '−' : '+'}</span>
                </button>

                {panelState.shape ? (
                  <div className="screenshots-shape-grid">
                    {([
                      ['widthMm', 'Width', 0.1],
                      ['lengthMm', 'Length', 0.1],
                      ['thicknessMm', 'Thickness', 0.01],
                      ['edgeSmoothnessMm', 'Edge Smoothness', 1],
                    ] as const).map(([key, label, step]) => (
                      <label key={key} className="screenshots-shape-item">
                        <div className="screenshots-slider-copy">
                          <strong>{label}</strong>
                          <code>{resolvedHeroPhoneShape?.[key] ?? 0}</code>
                        </div>
                        <input
                          type="number"
                          step={step}
                          value={resolvedHeroPhoneShape?.[key] ?? 0}
                          disabled={isLocked || slot > 2}
                          onChange={(event) =>
                            handleHeroPhoneShapeChange(key, Number(event.target.value))
                          }
                        />
                      </label>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}

          </aside>
        </div>

        <div className="generate-footer">
          <span className="generate-footer-info">{outputPath}</span>
          <div className="generate-footer-actions">
            <div className="screenshots-title-translation-actions">
              <div className="screenshots-title-translation-provider">
                <span className="generate-provider-kicker">AI Engine</span>
                <div className="generate-provider-switch">
                  {titleTranslationProviders.map((provider) => (
                    <Button
                      key={provider}
                      type="button"
                      variant={titleTranslationProvider === provider ? 'primary' : 'ghost'}
                      onClick={() => setTitleTranslationProvider(provider)}
                      disabled={isLocked || isGeneratingTitleTranslations}
                    >
                      {PROVIDER_LABEL[provider]}
                    </Button>
                  ))}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                disabled={!canGenerateTitleTranslations}
                onClick={() => {
                  void handleGenerateCurrentTitleTranslations().catch((error) => {
                    setFilePreviewErrorsByStore((prev) => ({
                      ...prev,
                      [store]: {
                        ...prev[store],
                        [slot]: error instanceof Error ? error.message : String(error),
                      },
                    }));
                  });
                }}
              >
                {isGeneratingTitleTranslations ? 'Çevriliyor...' : 'Title Çevirilerini Oluştur'}
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              disabled={!canSaveSettings}
              onClick={() => {
                void handleSaveCurrentSettings().catch((error) => {
                  setFilePreviewErrorsByStore((prev) => ({
                    ...prev,
                    [store]: {
                      ...prev[store],
                      [slot]: error instanceof Error ? error.message : String(error),
                    },
                  }));
                });
              }}
            >
              {isPersistingPreset ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={!canStart}
              onClick={() => {
                void (async () => {
                  const zipLocales =
                    zipLocaleKeys.length > 0 ? zipLocaleKeys : [locale.trim() || 'en-US'];
                  const firstAvailableFile =
                    filesByStore[store][slot] ??
                    activeScreenshotSlots.map((targetSlot) => filesByStore[store][targetSlot]).find(
                      (candidate): candidate is File => Boolean(candidate)
                    ) ??
                    null;

                  for (let localeIndex = 0; localeIndex < zipLocales.length; localeIndex += 1) {
                    const targetLocale = zipLocales[localeIndex] ?? 'en-US';
                    const localeSlotTitles = createTitleMapForLocale(
                      titleTranslationsState,
                      targetLocale,
                      activeLocaleTitleMap
                    );
                    const localeZipDataUrls =
                      zipLocaleKeys.length > 0
                        ? await loadZipLocaleScreenshotDataUrls(store, targetLocale)
                        : {};
                    const renderedSlots: ScreenshotRenderedSlotPayload[] = [];

                    for (const targetSlot of activeScreenshotSlots) {
                      const slotFile = filesByStore[store][targetSlot];
                      const slotZipEntry = getZipEntryForSlot(
                        zipManifestByStore[store]?.[targetLocale],
                        targetSlot
                      );
                      const slotScreenshotDataUrl =
                        localeZipDataUrls[targetSlot] ??
                        filePreviewUrlsByStore[store]?.[targetSlot] ??
                        (slotFile ? await readFileAsDataUrl(slotFile) : '');
                      const renderedCanvas = await renderBrowserScreenshotCanvas(
                        targetSlot,
                        slotScreenshotDataUrl,
                        targetLocale,
                        localeSlotTitles
                      );
                      const dataUrl = renderedCanvas.toDataURL('image/png');
                      const slotPalette = resolveScreenshotTemplatePalette(
                        store,
                        slotPalettesByStore[store]?.[targetSlot]
                      );
                      const slotTitle = localeSlotTitles[targetSlot] ?? '';
                      const slotTitleTypography = resolveScreenshotTitleTypography(
                        store,
                        targetSlot,
                        titleTypographyByStore[store]?.[targetSlot]
                      );
                      const slotTitleLines = buildTitleLines(
                        targetSlot,
                        slotTitle,
                        resolveTitleTemplateContext(store, targetLocale)
                      );
                      const slotPrimaryColor = getDefaultScreenshotTitlePrimaryColor(
                        store,
                        targetSlot,
                        slotPalette
                      );

                      renderedSlots.push({
                        slot: targetSlot,
                        title: slotTitle.trim(),
                        renderedImageBase64: dataUrl.split(',')[1] ?? null,
                        sourceImageBase64: slotScreenshotDataUrl
                          ? dataUrlToBase64(slotScreenshotDataUrl)
                          : null,
                        sourceFileName: slotZipEntry?.fileName ?? slotFile?.name ?? null,
                        sourceMimeType: slotZipEntry?.mimeType ?? slotFile?.type ?? null,
                        rendererMode:
                          targetSlot <= 2
                            ? 'procedural-three'
                            : 'canvas-2d',
                        palette: slotPalette,
                        titleTypography: slotTitleTypography,
                        titleExtraLineColors: syncScreenshotTitleExtraLineColors(
                          titleExtraLineColorsByStore[store]?.[targetSlot],
                          slotTitleLines.length,
                          slotPrimaryColor
                        ),
                        titleLineGap: titleLineGapByStore[store]?.[targetSlot] ?? 0,
                        titleTopPadding: titleTopPaddingByStore[store]?.[targetSlot] ?? 0,
                        titleCenter: parseScreenshotTitleCenterInput(
                          titleCenterByStore[store]?.[targetSlot],
                          false
                        ),
                      });
                    }

                    await Promise.resolve(
                      onStart({
                        locale: targetLocale,
                        store,
                        iosDeviceFamily: store === 'ios' ? iosDeviceFamily : undefined,
                        slot,
                        title: (localeSlotTitles[slot] ?? '').trim(),
                        file: selectedSlotFile ?? firstAvailableFile,
                        renderedImageBase64:
                          renderedSlots.find((item) => item.slot === slot)?.renderedImageBase64 ?? null,
                        rendererMode:
                          renderedSlots.find((item) => item.slot === slot)?.rendererMode ?? 'canvas-2d',
                        palette: resolvedPalette,
                        slotPalettes: slotPalettesByStore[store],
                        slotTitles: localeSlotTitles,
                        slotTitleExtraLineColors: persistedTitleExtraLineColorsForStore,
                        slotTitleLineGaps: titleLineGapByStore[store],
                        slotTitleTopPaddings: titleTopPaddingByStore[store],
                        slotTitleCenters: titleCenterByStore[store],
                        titleTypography: resolvedTitleTypography,
                        slotTitleTypography: titleTypographyByStore[store],
                        slotBackgroundSettings: backgroundSettingsByStore[store],
                        heroPhonePose: resolvedHeroPhonePose,
                        heroPhoneShape: resolvedHeroPhoneShape,
                        heroPhoneLocation: resolvedHeroPhoneLocation,
                        heroKeyLightPosition: resolvedHeroKeyLightPosition,
                        heroKeyLightSettings: resolvedHeroKeyLightSettings,
                        slotSbeSettings: {
                          1: resolveSlot1SbeSettings(slotSbeSettingsByStore[store]?.[1]),
                          2: resolveSlot1SbeSettings(slotSbeSettingsByStore[store]?.[2]),
                        },
                        heroCameraMode: resolvedHeroCameraMode,
                        heroCameraSettings: resolvedHeroCameraSettings,
                        renderedSlots,
                        closeWhenDone: localeIndex === zipLocales.length - 1,
                      })
                    );
                  }
                })().catch((error) => {
                  setFilePreviewErrorsByStore((prev) => ({
                    ...prev,
                    [store]: {
                      ...prev[store],
                      [slot]: error instanceof Error ? error.message : String(error),
                    },
                  }));
                });
              }}
            >
              {isBusy ? 'İşleniyor...' : 'Screenshotları Üret'}
            </Button>
          </div>
        </div>
      </section>
    </dialog>
  );
}
