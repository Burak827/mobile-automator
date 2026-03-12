import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDialogController } from '../../hooks/useDialogController';
import Button from '../atoms/Button';
import {
  buildTitleLines,
  drawStoreScreenshotToContext,
  type ScreenshotCanvasImageLoader,
} from '../../../screenshotTemplates/storeScreenshotCanvas';
import {
  DEFAULT_PROCEDURAL_CAMERA_MODE,
  DEFAULT_PROCEDURAL_CAMERA_SETTINGS,
  DEFAULT_PROCEDURAL_DEVICE_SHAPE,
  DEFAULT_IOS_HERO_PHONE_LOCATION,
  DEFAULT_IOS_HERO_PHONE_POSE,
  proceduralKeyLightPositionFromSettings,
  resolveProceduralCameraMode,
  resolveProceduralCameraSettings,
  resolveIosHeroPhoneLocation,
  resolveIosHeroPhonePose,
  resolveProceduralKeyLightSettings,
  resolveProceduralLightPosition,
  resolveProceduralDeviceShape,
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
  createEmptyScreenshotTitleExtraLineColorsMap,
  getDefaultScreenshotTitlePrimaryColor,
  MAX_SCREENSHOT_TITLE_EXTRA_LINE_COLORS,
  resolveScreenshotTitleLineColors,
  resolveStoredScreenshotTitleExtraLineColorsMap,
  syncScreenshotTitleExtraLineColors,
  type ScreenshotSlotTitleExtraLineColorsMap,
} from '../../../screenshotTemplates/screenshotTitleColors';
import {
  DEFAULT_SLOT_1_SBE_SETTINGS,
  resolveSlot1SbeSettings,
  type Slot1SbeSettings,
} from '../../../screenshotTemplates/slot1Sbe';
import {
  getScreenshotTemplateCanvasSize,
  getScreenshotTemplateDefaultPalette,
  getScreenshotTemplatePaletteFields,
  resolveScreenshotTemplatePalette,
  SCREENSHOT_TEMPLATE_SLOTS,
  type ScreenshotTemplatePalette,
  type ScreenshotTemplateSlot,
} from '../../../screenshotTemplates/storeScreenshotTemplateRegistry';
import {
  SCREENSHOT_STORES,
  getScreenshotStorePathToken,
  type ScreenshotStore,
} from '../../../screenshotTemplates/screenshotStores';
import { createBrowserCanvasImageLoader } from '../../lib/browserCanvasImageLoader';
import { GOOGLE_FONT_FAMILIES } from '../../lib/googleFontsCatalog';
import { ensureGoogleFontsLoaded } from '../../lib/googleFontsLoader';
import {
  renderIosProceduralHeroComposite,
} from '../../lib/iosProceduralHeroRenderer';

export type ScreenshotRenderedSlotPayload = {
  slot: ScreenshotTemplateSlot;
  title: string;
  renderedImageBase64?: string | null;
  rendererMode: 'canvas-2d' | 'procedural-three';
  palette: ScreenshotTemplatePalette;
  titleTypography: ScreenshotTitleTypography;
  titleExtraLineColors: string[];
  titleLineGap: number;
};

export type ScreenshotDialogStartPayload = {
  store: ScreenshotStore;
  locale: string;
  slot: ScreenshotTemplateSlot;
  title: string;
  file: File;
  renderedImageBase64?: string | null;
  rendererMode?: 'canvas-2d' | 'procedural-three';
  palette: ScreenshotTemplatePalette;
  slotPalettes: Partial<Record<ScreenshotTemplateSlot, ScreenshotTemplatePalette>>;
  slotTitles: Partial<Record<ScreenshotTemplateSlot, string>>;
  slotTitleExtraLineColors: Partial<Record<ScreenshotTemplateSlot, string[]>>;
  slotTitleLineGaps: Partial<Record<ScreenshotTemplateSlot, number>>;
  titleTypography: ScreenshotTitleTypography;
  slotTitleTypography: Partial<Record<ScreenshotTemplateSlot, ScreenshotTitleTypography>>;
  heroPhonePose: IosHeroPhonePose | null;
  heroPhoneShape: IosHeroPhoneShape | null;
  heroPhoneLocation: ProceduralDeviceLocation | null;
  heroKeyLightPosition: ProceduralLightPosition | null;
  heroKeyLightSettings: ProceduralKeyLightSettings | null;
  slot1SbeSettings: Slot1SbeSettings | null;
  heroCameraMode: ProceduralCameraMode | null;
  heroCameraSettings: ProceduralCameraSettings | null;
  renderedSlots: ScreenshotRenderedSlotPayload[];
};

export type ScreenshotPresetConfig = {
  palette: ScreenshotTemplatePalette;
  slotPalettes?: Partial<Record<ScreenshotTemplateSlot, ScreenshotTemplatePalette>>;
  slotTitles?: Partial<Record<ScreenshotTemplateSlot, string>>;
  slotTitleExtraLineColors?: Partial<Record<ScreenshotTemplateSlot, string[]>>;
  slotTitleLineGaps?: Partial<Record<ScreenshotTemplateSlot, number>>;
  slotTitleTypography?: Partial<Record<ScreenshotTemplateSlot, ScreenshotTitleTypography>>;
  heroPhonePose: IosHeroPhonePose | null;
  heroPhoneShape: IosHeroPhoneShape | null;
  heroPhoneLocation: ProceduralDeviceLocation | null;
  heroKeyLightPosition: ProceduralLightPosition | null;
  heroKeyLightSettings: ProceduralKeyLightSettings | null;
  slot1SbeSettings: Slot1SbeSettings | null;
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
  presets?: ScreenshotPresetMap;
  onClose: () => void;
  onPresetChange?: (store: ScreenshotStore, preset: ScreenshotPresetConfig) => Promise<void> | void;
  onStart: (payload: ScreenshotDialogStartPayload) => void;
};

type PreviewCardProps = {
  store: ScreenshotStore;
  slot: ScreenshotTemplateSlot;
  title: string;
  titleTypography: ScreenshotTitleTypography;
  titleExtraLineColors: string[];
  titleLineGap: number;
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

type PanelKey = 'rotation' | 'color' | 'shape' | 'location' | 'light' | 'sbe';
type ScreenshotSlotTitleMap = Record<ScreenshotTemplateSlot, string>;
type ScreenshotSlotPaletteMap = Record<ScreenshotTemplateSlot, ScreenshotTemplatePalette>;
type ScreenshotSlotTitleLineGapMap = Record<ScreenshotTemplateSlot, number>;

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

function createSlotTitleLineGapMap(preset?: ScreenshotPresetConfig): ScreenshotSlotTitleLineGapMap {
  const next = createEmptySlotTitleLineGapMap();
  const raw = preset?.slotTitleLineGaps ?? {};

  for (const entry of SCREENSHOT_TEMPLATE_SLOTS) {
    const numeric = Number(raw[entry]);
    next[entry] = Number.isFinite(numeric) ? numeric : 0;
  }

  return next;
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

  if (store === 'ios') {
    const sharedPalette = resolveScreenshotTemplatePalette(
      store,
      raw[1] ?? raw[2] ?? fallbackPalette
    );
    next[1] = sharedPalette;
    next[2] = sharedPalette;
  }

  return next;
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
    slotTitleTypography: draft.slotTitleTypography ?? base.slotTitleTypography,
    heroPhonePose: draft.heroPhonePose ?? base.heroPhonePose,
    heroPhoneShape: draft.heroPhoneShape ?? base.heroPhoneShape,
    heroPhoneLocation: draft.heroPhoneLocation ?? base.heroPhoneLocation,
    heroKeyLightPosition: draft.heroKeyLightPosition ?? base.heroKeyLightPosition,
    heroKeyLightSettings: draft.heroKeyLightSettings ?? base.heroKeyLightSettings,
    slot1SbeSettings: draft.slot1SbeSettings ?? base.slot1SbeSettings,
    heroCameraMode: draft.heroCameraMode ?? base.heroCameraMode,
    heroCameraSettings: draft.heroCameraSettings ?? base.heroCameraSettings,
  };
}

function getSlotPaletteTargets(store: ScreenshotStore, slot: ScreenshotTemplateSlot): ScreenshotTemplateSlot[] {
  if (store === 'ios' && (slot === 1 || slot === 2)) {
    return [1, 2];
  }
  return [slot];
}

function formatFileSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return '0 KB';
  const kb = size / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Dosya preview icin okunamadi.'));
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.readAsDataURL(file);
  });
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
  slot,
  title,
  titleTypography,
  titleExtraLineColors,
  titleLineGap,
  palette,
  heroPhonePose,
  heroPhoneShape,
  heroPhoneLocation,
  heroKeyLightPosition,
  heroKeyLightSettings,
  slot1SbeSettings,
  heroCameraMode,
  heroCameraSettings,
  screenshotUrl,
  imageLoader,
  fontLoadVersion,
  disabled,
  selected,
  onSelect,
}: PreviewCardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderIdRef = useRef(0);
  const canvasSize = useMemo(() => getScreenshotTemplateCanvasSize(store), [store]);
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

    if (store === 'ios' && slot <= 2) {
      void renderIosProceduralHeroComposite({
        slot: slot as 1 | 2,
        title,
        titleTypography,
        titleExtraLineColors,
        titleLineGap,
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
      }).then((resultCanvas) => {
        if (renderIdRef.current !== renderId) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(resultCanvas, 0, 0, canvas.width, canvas.height);
      }).catch((error) => {
        if (renderIdRef.current !== renderId) return;
        drawCanvasError(canvas, error instanceof Error ? error.message : String(error));
      });
    } else {
      void drawStoreScreenshotToContext(ctx, imageLoader, {
        store,
        slot,
        title,
        titleTypography,
        titleExtraLineColors,
        titleLineGap,
        palette,
        heroPhonePose,
        heroPhoneShape,
        screenshotSource: screenshotUrl || undefined,
      }).catch((error) => {
        if (renderIdRef.current !== renderId) return;
        drawCanvasError(canvas, error instanceof Error ? error.message : String(error));
      });
    }

    return () => { /* renderIdRef check guards stale renders */ };
  }, [fontLoadVersion, heroCameraMode, heroCameraSettings, heroKeyLightPosition, heroKeyLightSettings, heroPhoneLocation, heroPhonePose, heroPhoneShape, imageLoader, palette, previewHeight, previewWidth, screenshotUrl, slot, slot1SbeSettings, store, title, titleExtraLineColors, titleLineGap, titleTypography]);

  return (
    <button
      type="button"
      className={`screenshots-thumb-card${selected ? ' selected' : ''}`}
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
  presets,
  onClose,
  onPresetChange,
  onStart,
}: Props) {
  const [store, setStore] = useState<ScreenshotStore>('ios');
  const [slot, setSlot] = useState<ScreenshotTemplateSlot>(1);
  const [locale, setLocale] = useState<string>('en-US');
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
  const [titleExtraLineColorsByStore, setTitleExtraLineColorsByStore] = useState<
    Record<ScreenshotStore, ScreenshotSlotTitleExtraLineColorsMap>
  >({
    ios: createEmptyScreenshotTitleExtraLineColorsMap(),
    play_store: createEmptyScreenshotTitleExtraLineColorsMap(),
  });
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string>('');
  const [filePreviewError, setFilePreviewError] = useState<string>('');
  const [slotPalettesByStore, setSlotPalettesByStore] = useState<Record<ScreenshotStore, ScreenshotSlotPaletteMap>>({
    ios: createSlotPaletteMap('ios'),
    play_store: createSlotPaletteMap('play_store'),
  });
  const [heroPhonePoseByStore, setHeroPhonePoseByStore] = useState<Record<ScreenshotStore, IosHeroPhonePose | null>>({
    ios: resolveIosHeroPhonePose(DEFAULT_IOS_HERO_PHONE_POSE),
    play_store: null,
  });
  const [heroPhoneShapeByStore, setHeroPhoneShapeByStore] = useState<Record<ScreenshotStore, IosHeroPhoneShape | null>>({
    ios: resolveProceduralDeviceShape(DEFAULT_PROCEDURAL_DEVICE_SHAPE),
    play_store: null,
  });
  const [heroPhoneLocationByStore, setHeroPhoneLocationByStore] = useState<Record<ScreenshotStore, ProceduralDeviceLocation | null>>({
    ios: resolveIosHeroPhoneLocation(DEFAULT_IOS_HERO_PHONE_LOCATION),
    play_store: null,
  });
  const [heroKeyLightPositionByStore, setHeroKeyLightPositionByStore] = useState<Record<ScreenshotStore, ProceduralLightPosition | null>>({
    ios: resolveProceduralLightPosition(),
    play_store: null,
  });
  const [heroKeyLightSettingsByStore, setHeroKeyLightSettingsByStore] = useState<Record<ScreenshotStore, ProceduralKeyLightSettings | null>>({
    ios: resolveProceduralKeyLightSettings(),
    play_store: null,
  });
  const [slot1SbeSettingsByStore, setSlot1SbeSettingsByStore] = useState<Record<ScreenshotStore, Slot1SbeSettings | null>>({
    ios: resolveSlot1SbeSettings(DEFAULT_SLOT_1_SBE_SETTINGS),
    play_store: null,
  });
  const [heroCameraModeByStore, setHeroCameraModeByStore] = useState<Record<ScreenshotStore, ProceduralCameraMode | null>>({
    ios: resolveProceduralCameraMode(DEFAULT_PROCEDURAL_CAMERA_MODE),
    play_store: null,
  });
  const [heroCameraSettingsByStore, setHeroCameraSettingsByStore] = useState<Record<ScreenshotStore, ProceduralCameraSettings | null>>({
    ios: resolveProceduralCameraSettings(DEFAULT_PROCEDURAL_CAMERA_SETTINGS),
    play_store: null,
  });
  const [panelState, setPanelState] = useState({
    rotation: false,
    color: false,
    shape: false,
    location: false,
    light: false,
    sbe: false,
  });
  const latestFileReadRef = useRef(0);
  const wasOpenRef = useRef(false);
  const [fontLoadVersion, setFontLoadVersion] = useState(0);
  const [isPersistingPreset, setIsPersistingPreset] = useState(false);
  const presetSaveTimeoutsRef = useRef<Record<ScreenshotStore, number | null>>({
    ios: null,
    play_store: null,
  });
  const persistedPresetKeysRef = useRef<Record<ScreenshotStore, string>>({
    ios: JSON.stringify({
      palette: getScreenshotTemplateDefaultPalette('ios'),
      slotPalettes: createSlotPaletteMap('ios'),
      slotTitles: createSlotTitleMap(),
      slotTitleExtraLineColors: createEmptyScreenshotTitleExtraLineColorsMap(),
      slotTitleLineGaps: createEmptySlotTitleLineGapMap(),
      slotTitleTypography: createSlotTitleTypographyMap('ios'),
      heroPhonePose: resolveIosHeroPhonePose(DEFAULT_IOS_HERO_PHONE_POSE),
      heroPhoneShape: resolveProceduralDeviceShape(DEFAULT_PROCEDURAL_DEVICE_SHAPE),
      heroPhoneLocation: resolveIosHeroPhoneLocation(DEFAULT_IOS_HERO_PHONE_LOCATION),
      heroKeyLightPosition: resolveProceduralLightPosition(),
      heroKeyLightSettings: resolveProceduralKeyLightSettings(),
      slot1SbeSettings: resolveSlot1SbeSettings(DEFAULT_SLOT_1_SBE_SETTINGS),
      heroCameraMode: resolveProceduralCameraMode(DEFAULT_PROCEDURAL_CAMERA_MODE),
      heroCameraSettings: resolveProceduralCameraSettings(DEFAULT_PROCEDURAL_CAMERA_SETTINGS),
    }),
    play_store: JSON.stringify({
      palette: getScreenshotTemplateDefaultPalette('play_store'),
      slotPalettes: createSlotPaletteMap('play_store'),
      slotTitles: createSlotTitleMap(),
      slotTitleExtraLineColors: createEmptyScreenshotTitleExtraLineColorsMap(),
      slotTitleLineGaps: createEmptySlotTitleLineGapMap(),
      slotTitleTypography: createSlotTitleTypographyMap('play_store'),
      heroPhonePose: null,
      heroPhoneShape: null,
      heroPhoneLocation: null,
      heroKeyLightPosition: null,
      heroKeyLightSettings: null,
      slot1SbeSettings: null,
      heroCameraMode: null,
      heroCameraSettings: null,
    }),
  });
  const browserImageLoader = useMemo(() => createBrowserCanvasImageLoader(), []);

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;

    const nextLocale = defaultLocale.trim() || 'en-US';
    const initialIosPreset = mergeScreenshotPresetConfig(
      presets?.ios,
      readScreenshotDraft(appId, 'ios')
    );
    const initialPlayPreset = mergeScreenshotPresetConfig(
      presets?.play_store,
      readScreenshotDraft(appId, 'play_store')
    );
    const nextSlotPalettes: Record<ScreenshotStore, ScreenshotSlotPaletteMap> = {
      ios: createSlotPaletteMap('ios', initialIosPreset),
      play_store: createSlotPaletteMap('play_store', initialPlayPreset),
    };
    const nextSlotTitles: Record<ScreenshotStore, ScreenshotSlotTitleMap> = {
      ios: createSlotTitleMap(initialIosPreset),
      play_store: createSlotTitleMap(initialPlayPreset),
    };
    const nextSlotTitleExtraLineColors: Record<ScreenshotStore, ScreenshotSlotTitleExtraLineColorsMap> = {
      ios: createSlotTitleExtraLineColorsMap(initialIosPreset),
      play_store: createSlotTitleExtraLineColorsMap(initialPlayPreset),
    };
    const nextSlotTitleTypography: Record<ScreenshotStore, ScreenshotSlotTitleTypographyMap> = {
      ios: createSlotTitleTypographyMap('ios', initialIosPreset),
      play_store: createSlotTitleTypographyMap('play_store', initialPlayPreset),
    };
    const nextTitleLineGap: Record<ScreenshotStore, ScreenshotSlotTitleLineGapMap> = {
      ios: createSlotTitleLineGapMap(initialIosPreset),
      play_store: createSlotTitleLineGapMap(initialPlayPreset),
    };
    const nextHeroPhonePose: Record<ScreenshotStore, IosHeroPhonePose | null> = {
      ios: resolveIosHeroPhonePose(initialIosPreset?.heroPhonePose),
      play_store: null,
    };
    const nextHeroPhoneShape: Record<ScreenshotStore, IosHeroPhoneShape | null> = {
      ios: resolveProceduralDeviceShape(initialIosPreset?.heroPhoneShape),
      play_store: null,
    };
    const nextHeroPhoneLocation: Record<ScreenshotStore, ProceduralDeviceLocation | null> = {
      ios: resolveIosHeroPhoneLocation(initialIosPreset?.heroPhoneLocation),
      play_store: null,
    };
    const nextHeroKeyLightPosition: Record<ScreenshotStore, ProceduralLightPosition | null> = {
      ios: resolveProceduralLightPosition(initialIosPreset?.heroKeyLightPosition),
      play_store: null,
    };
    const nextHeroKeyLightSettings: Record<ScreenshotStore, ProceduralKeyLightSettings | null> = {
      ios: resolveProceduralKeyLightSettings(
        initialIosPreset?.heroKeyLightSettings,
        initialIosPreset?.heroKeyLightPosition
      ),
      play_store: null,
    };
    const nextSlot1SbeSettings: Record<ScreenshotStore, Slot1SbeSettings | null> = {
      ios: resolveSlot1SbeSettings(initialIosPreset?.slot1SbeSettings),
      play_store: null,
    };
    const nextHeroCameraMode: Record<ScreenshotStore, ProceduralCameraMode | null> = {
      ios: resolveProceduralCameraMode(initialIosPreset?.heroCameraMode),
      play_store: null,
    };
    const nextHeroCameraSettings: Record<ScreenshotStore, ProceduralCameraSettings | null> = {
      ios: resolveProceduralCameraSettings(initialIosPreset?.heroCameraSettings),
      play_store: null,
    };
    setStore(defaultStore);
    setLocale(nextLocale);
    setSlot(1);
    setTitlesByStore(nextSlotTitles);
    setTitleLineGapByStore(nextTitleLineGap);
    setTitleExtraLineColorsByStore(nextSlotTitleExtraLineColors);
    setTitleTypographyByStore(nextSlotTitleTypography);
    setFile(null);
    setFilePreviewUrl('');
    setFilePreviewError('');
    setSlotPalettesByStore(nextSlotPalettes);
    setHeroPhonePoseByStore(nextHeroPhonePose);
    setHeroPhoneShapeByStore(nextHeroPhoneShape);
    setHeroPhoneLocationByStore(nextHeroPhoneLocation);
    setHeroKeyLightPositionByStore(nextHeroKeyLightPosition);
    setHeroKeyLightSettingsByStore(nextHeroKeyLightSettings);
    setSlot1SbeSettingsByStore(nextSlot1SbeSettings);
    setHeroCameraModeByStore(nextHeroCameraMode);
    setHeroCameraSettingsByStore(nextHeroCameraSettings);
    setPanelState({
      rotation: false,
      color: false,
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
        slotTitleTypography: nextSlotTitleTypography.ios,
        heroPhonePose: nextHeroPhonePose.ios,
        heroPhoneShape: nextHeroPhoneShape.ios,
        heroPhoneLocation: nextHeroPhoneLocation.ios,
        heroKeyLightPosition: nextHeroKeyLightPosition.ios,
        heroKeyLightSettings: nextHeroKeyLightSettings.ios,
        slot1SbeSettings: nextSlot1SbeSettings.ios,
        heroCameraMode: nextHeroCameraMode.ios,
        heroCameraSettings: nextHeroCameraSettings.ios,
      }),
      play_store: JSON.stringify({
        palette: nextSlotPalettes.play_store[1],
        slotPalettes: nextSlotPalettes.play_store,
        slotTitles: nextSlotTitles.play_store,
        slotTitleExtraLineColors: nextSlotTitleExtraLineColors.play_store,
        slotTitleLineGaps: nextTitleLineGap.play_store,
        slotTitleTypography: nextSlotTitleTypography.play_store,
        heroPhonePose: nextHeroPhonePose.play_store,
        heroPhoneShape: nextHeroPhoneShape.play_store,
        heroPhoneLocation: nextHeroPhoneLocation.play_store,
        heroKeyLightPosition: nextHeroKeyLightPosition.play_store,
        heroKeyLightSettings: nextHeroKeyLightSettings.play_store,
        slot1SbeSettings: nextSlot1SbeSettings.play_store,
        heroCameraMode: nextHeroCameraMode.play_store,
        heroCameraSettings: nextHeroCameraSettings.play_store,
      }),
    };
    setFileInputKey((prev) => prev + 1);
  }, [appId, defaultLocale, defaultStore, isOpen, presets]);

  useEffect(() => {
    if (!file) {
      setFilePreviewUrl('');
      setFilePreviewError('');
      return;
    }

    const requestId = latestFileReadRef.current + 1;
    latestFileReadRef.current = requestId;
    setFilePreviewError('');

    const reader = new FileReader();
    reader.onerror = () => {
      if (latestFileReadRef.current !== requestId) return;
      setFilePreviewError('Dosya preview için okunamadı.');
      setFilePreviewUrl('');
    };
    reader.onload = () => {
      if (latestFileReadRef.current !== requestId) return;
      const nextValue = typeof reader.result === 'string' ? reader.result : '';
      setFilePreviewUrl(nextValue);
    };
    reader.readAsDataURL(file);
  }, [file]);

  const outputPath = useMemo(() => {
    const normalizedLocale = locale.trim() || 'en-US';
    return `screenshots/${getScreenshotStorePathToken(store)}/${normalizedLocale}/${slot}.png`;
  }, [locale, slot, store]);

  const resolvedPalette = useMemo(
    () => resolveScreenshotTemplatePalette(store, slotPalettesByStore[store]?.[slot]),
    [slot, slotPalettesByStore, store]
  );
  const resolvedTitle = useMemo(
    () => titlesByStore[store]?.[slot] ?? '',
    [slot, store, titlesByStore]
  );
  const resolvedTitleTypography = useMemo(
    () => resolveScreenshotTitleTypography(store, slot, titleTypographyByStore[store]?.[slot]),
    [slot, store, titleTypographyByStore]
  );
  const resolvedTitleLines = useMemo(
    () => buildTitleLines(slot, resolvedTitle),
    [resolvedTitle, slot]
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
  const resolvedHeroPhonePose = useMemo(
    () => (store === 'ios' ? resolveIosHeroPhonePose(heroPhonePoseByStore.ios) : null),
    [heroPhonePoseByStore.ios, store]
  );
  const resolvedHeroPhoneShape = useMemo(
    () => (store === 'ios' ? resolveProceduralDeviceShape(heroPhoneShapeByStore.ios) : null),
    [heroPhoneShapeByStore.ios, store]
  );
  const resolvedHeroPhoneLocation = useMemo(
    () => (store === 'ios' ? resolveIosHeroPhoneLocation(heroPhoneLocationByStore.ios) : null),
    [heroPhoneLocationByStore.ios, store]
  );
  const resolvedHeroKeyLightPosition = useMemo(
    () => (store === 'ios' ? resolveProceduralLightPosition(heroKeyLightPositionByStore.ios) : null),
    [heroKeyLightPositionByStore.ios, store]
  );
  const resolvedHeroKeyLightSettings = useMemo(
    () =>
      (store === 'ios'
        ? resolveProceduralKeyLightSettings(
            heroKeyLightSettingsByStore.ios,
            heroKeyLightPositionByStore.ios
          )
        : null),
    [heroKeyLightPositionByStore.ios, heroKeyLightSettingsByStore.ios, store]
  );
  const resolvedSlot1SbeSettings = useMemo(
    () => (store === 'ios' ? resolveSlot1SbeSettings(slot1SbeSettingsByStore.ios) : null),
    [slot1SbeSettingsByStore.ios, store]
  );
  const resolvedHeroCameraMode = useMemo(
    () => (store === 'ios' ? resolveProceduralCameraMode(heroCameraModeByStore.ios) : null),
    [heroCameraModeByStore.ios, store]
  );
  const resolvedHeroCameraSettings = useMemo(
    () =>
      store === 'ios'
        ? resolveProceduralCameraSettings(heroCameraSettingsByStore.ios)
        : null,
    [heroCameraSettingsByStore.ios, store]
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
    const slotTitles = titlesByStore[targetStore];
    const rawSlotTitleExtraLineColors =
      targetStore === store
        ? persistedTitleExtraLineColorsForStore
        : titleExtraLineColorsByStore[targetStore];
    const slotTitleExtraLineColors = SCREENSHOT_TEMPLATE_SLOTS.reduce((acc, targetSlot) => {
      const targetPalette = resolveScreenshotTemplatePalette(targetStore, slotPalettes[targetSlot]);
      const targetTitle = slotTitles[targetSlot] ?? '';
      const targetLines = buildTitleLines(targetSlot, targetTitle);
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
    const slotTitleTypography = titleTypographyByStore[targetStore];
    const palette = resolveScreenshotTemplatePalette(targetStore, slotPalettes[1]);
    const heroPhonePose =
      targetStore === 'ios' ? resolveIosHeroPhonePose(heroPhonePoseByStore.ios) : null;
    const heroPhoneShape =
      targetStore === 'ios' ? resolveProceduralDeviceShape(heroPhoneShapeByStore.ios) : null;
    const heroPhoneLocation =
      targetStore === 'ios' ? resolveIosHeroPhoneLocation(heroPhoneLocationByStore.ios) : null;
    const heroKeyLightPosition =
      targetStore === 'ios' ? resolveProceduralLightPosition(heroKeyLightPositionByStore.ios) : null;
    const heroKeyLightSettings =
      targetStore === 'ios'
        ? resolveProceduralKeyLightSettings(
            heroKeyLightSettingsByStore.ios,
            heroKeyLightPositionByStore.ios
          )
        : null;
    const slot1SbeSettings =
      targetStore === 'ios' ? resolveSlot1SbeSettings(slot1SbeSettingsByStore.ios) : null;
    const heroCameraMode =
      targetStore === 'ios' ? resolveProceduralCameraMode(heroCameraModeByStore.ios) : null;
    const heroCameraSettings =
      targetStore === 'ios'
        ? resolveProceduralCameraSettings(heroCameraSettingsByStore.ios)
        : null;
    const preset = {
      palette,
      slotPalettes,
      slotTitles,
      slotTitleExtraLineColors,
      slotTitleLineGaps,
      slotTitleTypography,
      heroPhonePose,
      heroPhoneShape,
      heroPhoneLocation,
      heroKeyLightPosition,
      heroKeyLightSettings,
      slot1SbeSettings,
      heroCameraMode,
      heroCameraSettings,
    };
    return {
      preset,
      key: JSON.stringify(preset),
    };
  }, [heroCameraModeByStore.ios, heroCameraSettingsByStore.ios, heroKeyLightPositionByStore.ios, heroKeyLightSettingsByStore.ios, heroPhoneLocationByStore.ios, heroPhonePoseByStore.ios, heroPhoneShapeByStore.ios, persistedTitleExtraLineColorsForStore, slot1SbeSettingsByStore.ios, slotPalettesByStore, store, titleExtraLineColorsByStore, titleLineGapByStore, titleTypographyByStore, titlesByStore]);
  const previewCanvasSize = useMemo(() => getScreenshotTemplateCanvasSize(store), [store]);
  const paletteFields = useMemo(() => getScreenshotTemplatePaletteFields(store, slot), [slot, store]);
  const isLocked = isBusy;
  const isIosHeroSlot = store === 'ios' && slot <= 2;
  const canStart = Boolean(file) && locale.trim().length > 0 && !isLocked;
  const canSaveSettings = Boolean(appId) && !isLocked && !isPersistingPreset;

  const handlePaletteChange = useCallback(
    (key: keyof ScreenshotTemplatePalette, value: string) => {
      setSlotPalettesByStore((prev) => {
        const nextStorePalettes = { ...prev[store] };
        // phoneColor is global — propagate to ALL slots
        const targets = key === 'phoneColor' ? [...SCREENSHOT_TEMPLATE_SLOTS] : getSlotPaletteTargets(store, slot);
        for (const targetSlot of targets) {
          const basePalette = resolveScreenshotTemplatePalette(store, nextStorePalettes[targetSlot]);
          nextStorePalettes[targetSlot] = resolveScreenshotTemplatePalette(store, { ...basePalette, [key]: value });
        }
        return {
          ...prev,
          [store]: nextStorePalettes,
        };
      });
    },
    [slot, store]
  );

  const handleTitleChange = useCallback((value: string) => {
    setTitlesByStore((prev) => ({
      ...prev,
      [store]: {
        ...prev[store],
        [slot]: value,
      },
    }));
  }, [slot, store]);

  const handleTitleTypographyChange = useCallback(
    (key: keyof ScreenshotTitleTypography, value: string | number) => {
      setTitleTypographyByStore((prev) => ({
        ...prev,
        [store]: {
          ...prev[store],
          [slot]: resolveScreenshotTitleTypography(store, slot, {
            ...prev[store][slot],
            [key]: value,
          }),
        },
      }));
    },
    [slot, store]
  );

  const handleTitleExtraLineColorChange = useCallback(
    (lineIndex: number, value: string) => {
      setTitleExtraLineColorsByStore((prev) => {
        const nextStoreMap = { ...prev[store] };
        const nextSlotColors = [...(nextStoreMap[slot] ?? [])].slice(
          0,
          MAX_SCREENSHOT_TITLE_EXTRA_LINE_COLORS
        );
        nextSlotColors[lineIndex] = value;
        nextStoreMap[slot] = nextSlotColors.slice(0, MAX_SCREENSHOT_TITLE_EXTRA_LINE_COLORS);
        return {
          ...prev,
          [store]: nextStoreMap,
        };
      });
    },
    [slot, store]
  );

  const handleSaveCurrentSettings = useCallback(async () => {
    if (!appId) return;

    const { preset, key } = buildPresetStateForStore(store);
    writeScreenshotDraft(appId, store, preset);

    const pendingTimeout = presetSaveTimeoutsRef.current[store];
    if (pendingTimeout) {
      window.clearTimeout(pendingTimeout);
      presetSaveTimeoutsRef.current[store] = null;
    }

    if (!onPresetChange) {
      persistedPresetKeysRef.current[store] = key;
      return;
    }

    setIsPersistingPreset(true);
    try {
      await Promise.resolve(onPresetChange(store, preset));
      persistedPresetKeysRef.current[store] = key;
    } finally {
      setIsPersistingPreset(false);
    }
  }, [appId, buildPresetStateForStore, onPresetChange, store]);

  const handleResetSelectedSlot = useCallback(() => {
    setTitlesByStore((prev) => ({
      ...prev,
      [store]: {
        ...prev[store],
        [slot]: '',
      },
    }));

    setSlotPalettesByStore((prev) => {
      const nextStorePalettes = { ...prev[store] };
      const resetPalette = getScreenshotTemplateDefaultPalette(store);
      for (const targetSlot of getSlotPaletteTargets(store, slot)) {
        nextStorePalettes[targetSlot] = resetPalette;
      }
      return {
        ...prev,
        [store]: nextStorePalettes,
      };
    });

    setTitleTypographyByStore((prev) => ({
      ...prev,
      [store]: {
        ...prev[store],
        [slot]: resolveScreenshotTitleTypography(store, slot, undefined),
      },
    }));
    setTitleLineGapByStore((prev) => ({
      ...prev,
      [store]: {
        ...prev[store],
        [slot]: 0,
      },
    }));
    setTitleExtraLineColorsByStore((prev) => ({
      ...prev,
      [store]: {
        ...prev[store],
        [slot]: [],
      },
    }));

    if (store !== 'ios' || slot > 2) return;

    setHeroPhonePoseByStore((prev) => ({
      ...prev,
      ios: resolveIosHeroPhonePose(DEFAULT_IOS_HERO_PHONE_POSE),
    }));
    setHeroPhoneShapeByStore((prev) => ({
      ...prev,
      ios: resolveProceduralDeviceShape(DEFAULT_PROCEDURAL_DEVICE_SHAPE),
    }));
    setHeroPhoneLocationByStore((prev) => ({
      ...prev,
      ios: resolveIosHeroPhoneLocation(DEFAULT_IOS_HERO_PHONE_LOCATION),
    }));
    setHeroKeyLightPositionByStore((prev) => ({
      ...prev,
      ios: resolveProceduralLightPosition(),
    }));
    setHeroKeyLightSettingsByStore((prev) => ({
      ...prev,
      ios: resolveProceduralKeyLightSettings(),
    }));
    if (slot === 1) {
      setSlot1SbeSettingsByStore((prev) => ({
        ...prev,
        ios: resolveSlot1SbeSettings(DEFAULT_SLOT_1_SBE_SETTINGS),
      }));
    }
    setHeroCameraModeByStore((prev) => ({
      ...prev,
      ios: resolveProceduralCameraMode(DEFAULT_PROCEDURAL_CAMERA_MODE),
    }));
    setHeroCameraSettingsByStore((prev) => ({
      ...prev,
      ios: resolveProceduralCameraSettings(DEFAULT_PROCEDURAL_CAMERA_SETTINGS),
    }));
  }, [slot, store]);

  const handleHeroPhonePoseChange = useCallback(
    (key: keyof IosHeroPhonePose, value: number) => {
      if (store !== 'ios') return;
    setHeroPhonePoseByStore((prev) => ({
      ...prev,
      ios: resolveIosHeroPhonePose({
          ...(prev.ios ?? DEFAULT_IOS_HERO_PHONE_POSE),
          [key]: value,
        }),
    }));
    },
    [store]
  );

  const handleHeroPhoneShapeChange = useCallback(
    (key: keyof IosHeroPhoneShape, value: number) => {
      if (store !== 'ios') return;
      setHeroPhoneShapeByStore((prev) => ({
        ...prev,
        ios: resolveProceduralDeviceShape({
          ...(prev.ios ?? DEFAULT_PROCEDURAL_DEVICE_SHAPE),
          [key]: value,
        }),
      }));
    },
    [store]
  );

  const handleHeroPhoneLocationChange = useCallback(
    (key: keyof ProceduralDeviceLocation, value: number) => {
      if (store !== 'ios') return;
    setHeroPhoneLocationByStore((prev) => ({
      ...prev,
      ios: resolveIosHeroPhoneLocation({
          ...(prev.ios ?? DEFAULT_IOS_HERO_PHONE_LOCATION),
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
      if (store !== 'ios') return;
      setHeroKeyLightSettingsByStore((prev) => {
        const nextSettings = resolveProceduralKeyLightSettings({
          ...(prev.ios ?? resolveProceduralKeyLightSettings()),
          [key]: value,
        });
        setHeroKeyLightPositionByStore((prevPositions) => ({
          ...prevPositions,
          ios: proceduralKeyLightPositionFromSettings(nextSettings),
        }));
        return {
          ...prev,
          ios: nextSettings,
        };
      });
    },
    [store]
  );

  const handleHeroCameraSettingsChange = useCallback(
    (key: keyof ProceduralCameraSettings, value: number) => {
      if (store !== 'ios') return;
      setHeroCameraSettingsByStore((prev) => ({
        ...prev,
        ios: resolveProceduralCameraSettings({
          ...(prev.ios ?? DEFAULT_PROCEDURAL_CAMERA_SETTINGS),
          [key]: value,
        }),
      }));
    },
    [store]
  );

  const handleSlot1SbeSettingsChange = useCallback(
    (key: keyof Slot1SbeSettings, value: number | string) => {
      if (store !== 'ios' || slot !== 1) return;
      setSlot1SbeSettingsByStore((prev) => ({
        ...prev,
        ios: resolveSlot1SbeSettings({
          ...(prev.ios ?? DEFAULT_SLOT_1_SBE_SETTINGS),
          [key]: value,
        }),
      }));
    },
    [slot, store]
  );

  const renderBrowserScreenshotCanvas = useCallback(async (
    targetSlot: ScreenshotTemplateSlot,
    screenshotDataUrl: string
  ) => {
    const slotTitle = titlesByStore[store]?.[targetSlot] ?? '';
    const slotTitleTypography = resolveScreenshotTitleTypography(
      store,
      targetSlot,
      titleTypographyByStore[store]?.[targetSlot]
    );
    const slotPalette = resolveScreenshotTemplatePalette(
      store,
      slotPalettesByStore[store]?.[targetSlot]
    );
    const slotTitleLines = buildTitleLines(targetSlot, slotTitle);
    const slotPrimaryColor = getDefaultScreenshotTitlePrimaryColor(store, targetSlot, slotPalette);
    const slotTitleExtraLineColors = syncScreenshotTitleExtraLineColors(
      titleExtraLineColorsByStore[store]?.[targetSlot],
      slotTitleLines.length,
      slotPrimaryColor
    );
    const slotTitleLineGap = titleLineGapByStore[store]?.[targetSlot] ?? 0;

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

    if (store === 'ios' && targetSlot <= 2) {
      return renderIosProceduralHeroComposite({
        slot: targetSlot as 1 | 2,
        title: slotTitle,
        titleTypography: slotTitleTypography,
        titleExtraLineColors: slotTitleExtraLineColors,
        titleLineGap: slotTitleLineGap,
        palette: slotPalette,
        screenshotUrl: screenshotDataUrl,
        imageLoader: browserImageLoader,
        heroPhonePose: resolvedHeroPhonePose,
        heroPhoneShape: resolvedHeroPhoneShape,
        heroPhoneLocation: resolvedHeroPhoneLocation,
        heroKeyLightPosition: resolvedHeroKeyLightPosition,
        heroKeyLightSettings: resolvedHeroKeyLightSettings,
        slot1SbeSettings: targetSlot === 1 ? resolvedSlot1SbeSettings : null,
        heroCameraMode: resolvedHeroCameraMode,
        heroCameraSettings: resolvedHeroCameraSettings,
        width: previewCanvasSize.width,
        height: previewCanvasSize.height,
        targetCanvas: canvas,
      });
    }

    await drawStoreScreenshotToContext(ctx, browserImageLoader, {
      store,
      slot: targetSlot,
      title: slotTitle,
      titleTypography: slotTitleTypography,
      titleExtraLineColors: slotTitleExtraLineColors,
      titleLineGap: slotTitleLineGap,
      palette: slotPalette,
      heroPhonePose: resolvedHeroPhonePose,
      heroPhoneShape: resolvedHeroPhoneShape,
      screenshotSource: screenshotDataUrl || undefined,
    });
    return canvas;
  }, [browserImageLoader, previewCanvasSize.height, previewCanvasSize.width, resolvedHeroCameraMode, resolvedHeroCameraSettings, resolvedHeroKeyLightPosition, resolvedHeroKeyLightSettings, resolvedHeroPhoneLocation, resolvedHeroPhonePose, resolvedHeroPhoneShape, resolvedSlot1SbeSettings, slotPalettesByStore, store, titleExtraLineColorsByStore, titleLineGapByStore, titleTypographyByStore, titlesByStore]);

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
        ...prev,
        [store]: {
          ...prev[store],
          [slot]: nextSlotColors,
        },
      };
    });
  }, [isOpen, resolvedPrimaryTitleColor, resolvedTitleLines.length, slot, store]);

  useEffect(() => {
    if (!isOpen || !onPresetChange) return;

    for (const { id: targetStore } of SCREENSHOT_STORES) {
      const { preset, key } = buildPresetStateForStore(targetStore);
      if (persistedPresetKeysRef.current[targetStore] === key) continue;

      const pendingTimeout = presetSaveTimeoutsRef.current[targetStore];
      if (pendingTimeout) {
        window.clearTimeout(pendingTimeout);
      }

      presetSaveTimeoutsRef.current[targetStore] = window.setTimeout(() => {
        void Promise.resolve(onPresetChange(targetStore, preset))
          .then(() => {
            persistedPresetKeysRef.current[targetStore] = key;
          })
          .catch(() => {
            // Generate akışı preset'i tekrar persist ettiği için burada sessiz kalıyoruz.
          })
          .finally(() => {
            presetSaveTimeoutsRef.current[targetStore] = null;
          });
      }, 350);
    }
  }, [buildPresetStateForStore, isOpen, onPresetChange]);

  useEffect(() => {
    if (!isOpen || !appId) return;
    for (const { id: targetStore } of SCREENSHOT_STORES) {
      writeScreenshotDraft(appId, targetStore, buildPresetStateForStore(targetStore).preset);
    }
  }, [appId, buildPresetStateForStore, isOpen]);

  useEffect(() => {
    if (isOpen || !onPresetChange) return;

    for (const { id: targetStore } of SCREENSHOT_STORES) {
      const { preset, key } = buildPresetStateForStore(targetStore);
      if (persistedPresetKeysRef.current[targetStore] === key) continue;

      const pendingTimeout = presetSaveTimeoutsRef.current[targetStore];
      if (pendingTimeout) {
        window.clearTimeout(pendingTimeout);
        presetSaveTimeoutsRef.current[targetStore] = null;
      }

      void Promise.resolve(onPresetChange(targetStore, preset))
        .then(() => {
          persistedPresetKeysRef.current[targetStore] = key;
        })
        .catch(() => {
          // Modal kapatılırken sessiz kalıyoruz.
        });
    }
  }, [buildPresetStateForStore, isOpen, onPresetChange]);

  useEffect(() => () => {
    for (const { id: targetStore } of SCREENSHOT_STORES) {
      const pendingTimeout = presetSaveTimeoutsRef.current[targetStore];
      if (pendingTimeout) {
        window.clearTimeout(pendingTimeout);
        presetSaveTimeoutsRef.current[targetStore] = null;
      }
    }
  }, []);

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

        <div className="screenshot-store-toggle">
          {SCREENSHOT_STORES.map((item) => (
            <Button
              key={item.id}
              type="button"
              variant={item.id === store ? 'primary' : 'ghost'}
              disabled={isLocked}
              onClick={() => setStore(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>

        <div className="screenshots-editor">
          <section className="screenshots-preview-column">
            <div className="screenshots-preview-head">
              <div>
                <strong>Canvas Şeridi</strong>
                <span>Seçili slot: {slot} · sağa kaydır</span>
              </div>
                <span className="screenshots-preview-badge">
                {previewCanvasSize.width}×{previewCanvasSize.height}
              </span>
            </div>

            <div className="screenshots-thumb-grid">
              {SCREENSHOT_TEMPLATE_SLOTS.map((previewSlot) => (
                <PreviewCanvasCard
                  key={`${store}-${previewSlot}`}
                  store={store}
                  slot={previewSlot}
                  title={titlesByStore[store][previewSlot]}
                  titleTypography={titleTypographyByStore[store][previewSlot]}
                  titleExtraLineColors={titleExtraLineColorsByStore[store][previewSlot] ?? []}
                  titleLineGap={titleLineGapByStore[store]?.[previewSlot] ?? 0}
                  palette={slotPalettesByStore[store][previewSlot]}
                  heroPhonePose={
                    store === 'ios' && previewSlot <= 2
                      ? resolvedHeroPhonePose
                      : null
                  }
                  heroPhoneShape={resolvedHeroPhoneShape}
                  heroPhoneLocation={store === 'ios' && previewSlot <= 2 ? resolvedHeroPhoneLocation : null}
                  heroKeyLightPosition={store === 'ios' && previewSlot <= 2 ? resolvedHeroKeyLightPosition : null}
                  heroKeyLightSettings={store === 'ios' && previewSlot <= 2 ? resolvedHeroKeyLightSettings : null}
                  slot1SbeSettings={store === 'ios' && previewSlot === 1 ? resolvedSlot1SbeSettings : null}
                  heroCameraMode={store === 'ios' && previewSlot <= 2 ? resolvedHeroCameraMode : null}
                  heroCameraSettings={store === 'ios' && previewSlot <= 2 ? resolvedHeroCameraSettings : null}
                  screenshotUrl={filePreviewUrl}
                  imageLoader={browserImageLoader}
                  fontLoadVersion={fontLoadVersion}
                  disabled={isLocked}
                  selected={previewSlot === slot}
                  onSelect={setSlot}
                />
              ))}
            </div>
          </section>

          <aside className="screenshots-sidebar">
            <div className="screenshot-form-grid">
              <label>
                Locale
                <input
                  type="text"
                  value={locale}
                  onChange={(event) => setLocale(event.target.value)}
                  placeholder="en-US"
                  disabled={isLocked}
                />
              </label>

              <label>
                Slot
                <select
                  value={String(slot)}
                  onChange={(event) => setSlot(Number(event.target.value) as ScreenshotTemplateSlot)}
                  disabled={isLocked}
                >
                  {SCREENSHOT_TEMPLATE_SLOTS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="screenshot-title-field">
              Title
              <textarea
                value={resolvedTitle}
                onChange={(event) => handleTitleChange(event.target.value)}
                placeholder="Save unlimited photos"
                rows={3}
                disabled={isLocked}
              />
            </label>

            {resolvedTitleLines.length > 1 ? (
              <label className="screenshot-title-field">
                Line Gap
                <input
                  type="text"
                  inputMode="decimal"
                  value={resolvedTitleLineGap}
                  onChange={(event) =>
                    setTitleLineGapByStore((prev) => ({
                      ...prev,
                      [store]: {
                        ...prev[store],
                        [slot]: Number.isFinite(Number(event.target.value))
                          ? Number(event.target.value)
                          : 0,
                      },
                    }))
                  }
                  disabled={isLocked}
                />
              </label>
            ) : null}

            <div className="screenshot-form-grid">
              <label>
                Font
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
              </label>

              <label>
                Size
                <input
                  type="text"
                  inputMode="decimal"
                  value={resolvedTitleTypography.fontSize}
                  onChange={(event) => handleTitleTypographyChange('fontSize', event.target.value)}
                  disabled={isLocked}
                />
              </label>

              <label>
                Weight
                <input
                  type="text"
                  inputMode="numeric"
                  value={resolvedTitleTypography.fontWeight}
                  onChange={(event) => handleTitleTypographyChange('fontWeight', event.target.value)}
                  disabled={isLocked}
                />
              </label>
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

            <label className="screenshot-file-field">
              Screenshot
              <input
                key={fileInputKey}
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                disabled={isLocked}
                onChange={(event) => {
                  const nextFile = event.target.files?.[0] ?? null;
                  setFile(nextFile);
                }}
              />
            </label>

            <div className="screenshot-file-meta">
              {file ? `${file.name} - ${formatFileSize(file.size)}` : 'Henüz dosya seçilmedi.'}
            </div>
            {filePreviewError ? <div className="screenshot-file-error">{filePreviewError}</div> : null}

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
                    <label key={field.key} className="screenshots-palette-item">
                      <div className="screenshots-palette-copy">
                        <strong>{field.label}</strong>
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
                    </label>
                  ))}
                  {resolvedTitleExtraLineColors.map((color, index) => (
                    <label key={`title-line-${index + 2}`} className="screenshots-palette-item">
                      <div className="screenshots-palette-copy">
                        <strong>Line {index + 2}</strong>
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
                    </label>
                  ))}
                </div>
              ) : null}
            </section>

            {store === 'ios' && slot === 1 ? (
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
                          <code>{resolvedSlot1SbeSettings?.[key] ?? 0}</code>
                        </div>
                        <input
                          type="number"
                          step={step}
                          value={resolvedSlot1SbeSettings?.[key] ?? 0}
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
                          value={resolvedSlot1SbeSettings?.lineColor ?? '#f38219'}
                          disabled={isLocked}
                          onChange={(event) =>
                            handleSlot1SbeSettingsChange('lineColor', event.target.value)
                          }
                        />
                        <code>{resolvedSlot1SbeSettings?.lineColor ?? '#f38219'}</code>
                      </div>
                    </label>
                  </div>
                ) : null}
              </section>
            ) : null}

            {isIosHeroSlot ? (
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
                      setHeroCameraModeByStore((prev) => ({ ...prev, ios: 'perspective' }))
                    }
                  >
                    Perspective
                  </Button>
                  <Button
                    type="button"
                    variant={resolvedHeroCameraMode === 'orthographic' ? 'primary' : 'ghost'}
                    disabled={isLocked}
                    onClick={() =>
                      setHeroCameraModeByStore((prev) => ({ ...prev, ios: 'orthographic' }))
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

            {isIosHeroSlot ? (
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

            {isIosHeroSlot ? (
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

            {isIosHeroSlot ? (
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

            {isIosHeroSlot ? (
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
                      ['islandWidthMm', 'Island Width', 0.1],
                      ['islandLengthMm', 'Island Length', 0.1],
                      ['islandRadiusMm', 'Island Radius', 0.1],
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
            <Button
              type="button"
              variant="ghost"
              disabled={!canSaveSettings}
              onClick={() => {
                void handleSaveCurrentSettings().catch((error) => {
                  setFilePreviewError(error instanceof Error ? error.message : String(error));
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
                const nextLocale = locale.trim();
                if (!file || !nextLocale) return;

                void (async () => {
                  const screenshotDataUrl = filePreviewUrl || (await readFileAsDataUrl(file));
                  const renderedSlots: ScreenshotRenderedSlotPayload[] = [];

                  for (const targetSlot of SCREENSHOT_TEMPLATE_SLOTS) {
                    const renderedCanvas = await renderBrowserScreenshotCanvas(
                      targetSlot,
                      screenshotDataUrl
                    );
                    const dataUrl = renderedCanvas.toDataURL('image/png');
                    const slotPalette = resolveScreenshotTemplatePalette(
                      store,
                      slotPalettesByStore[store]?.[targetSlot]
                    );
                    const slotTitle = titlesByStore[store]?.[targetSlot] ?? '';
                    const slotTitleTypography = resolveScreenshotTitleTypography(
                      store,
                      targetSlot,
                      titleTypographyByStore[store]?.[targetSlot]
                    );
                    const slotTitleLines = buildTitleLines(targetSlot, slotTitle);
                    const slotPrimaryColor = getDefaultScreenshotTitlePrimaryColor(
                      store,
                      targetSlot,
                      slotPalette
                    );

                    renderedSlots.push({
                      slot: targetSlot,
                      title: slotTitle.trim(),
                      renderedImageBase64: dataUrl.split(',')[1] ?? null,
                      rendererMode:
                        store === 'ios' && targetSlot <= 2
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
                    });
                  }

                  onStart({
                    locale: nextLocale,
                    store,
                    slot,
                    title: resolvedTitle.trim(),
                    file,
                    renderedImageBase64: renderedSlots.find((item) => item.slot === slot)?.renderedImageBase64 ?? null,
                    rendererMode: renderedSlots.find((item) => item.slot === slot)?.rendererMode ?? 'canvas-2d',
                    palette: resolvedPalette,
                    slotPalettes: slotPalettesByStore[store],
                    slotTitles: titlesByStore[store],
                    slotTitleExtraLineColors: persistedTitleExtraLineColorsForStore,
                    slotTitleLineGaps: titleLineGapByStore[store],
                    titleTypography: resolvedTitleTypography,
                    slotTitleTypography: titleTypographyByStore[store],
                    heroPhonePose: resolvedHeroPhonePose,
                    heroPhoneShape: resolvedHeroPhoneShape,
                    heroPhoneLocation: resolvedHeroPhoneLocation,
                    heroKeyLightPosition: resolvedHeroKeyLightPosition,
                    heroKeyLightSettings: resolvedHeroKeyLightSettings,
                    slot1SbeSettings: resolvedSlot1SbeSettings,
                    heroCameraMode: resolvedHeroCameraMode,
                    heroCameraSettings: resolvedHeroCameraSettings,
                    renderedSlots,
                  });
                })().catch((error) => {
                  setFilePreviewError(error instanceof Error ? error.message : String(error));
                });
              }}
            >
              {isBusy ? 'İşleniyor...' : '6 Screenshot Üret'}
            </Button>
          </div>
        </div>
      </section>
    </dialog>
  );
}
