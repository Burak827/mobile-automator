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
  DEFAULT_IOS_HERO_PHONE_LOCATION,
  DEFAULT_IOS_HERO_PHONE_POSE,
  getDefaultProceduralDeviceShape,
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
  sourceImageBase64?: string | null;
  sourceFileName?: string | null;
  sourceMimeType?: string | null;
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
  file?: File | null;
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
  slotSbeSettings: Partial<Record<ScreenshotTemplateSlot, Slot1SbeSettings>>;
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
type ScreenshotSlotFileMap = Record<ScreenshotTemplateSlot, File | null>;
type ScreenshotSlotPreviewUrlMap = Record<ScreenshotTemplateSlot, string>;
type ScreenshotSlotPreviewErrorMap = Record<ScreenshotTemplateSlot, string>;
type ScreenshotSlotSbeMap = Partial<Record<ScreenshotTemplateSlot, Slot1SbeSettings>>;

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
    1: resolveSlot1SbeSettings(DEFAULT_SLOT_1_SBE_SETTINGS),
    2: resolveSlot1SbeSettings(DEFAULT_SLOT_1_SBE_SETTINGS),
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

    if (slot <= 2) {
      void renderIosProceduralHeroComposite({
        store,
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
  const [filesByStore, setFilesByStore] = useState<Record<ScreenshotStore, ScreenshotSlotFileMap>>({
    ios: createEmptySlotFileMap(),
    play_store: createEmptySlotFileMap(),
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
  const [slotPalettesByStore, setSlotPalettesByStore] = useState<Record<ScreenshotStore, ScreenshotSlotPaletteMap>>({
    ios: createSlotPaletteMap('ios'),
    play_store: createSlotPaletteMap('play_store'),
  });
  const [heroPhonePoseByStore, setHeroPhonePoseByStore] = useState<Record<ScreenshotStore, IosHeroPhonePose | null>>({
    ios: resolveIosHeroPhonePose(DEFAULT_IOS_HERO_PHONE_POSE),
    play_store: resolveIosHeroPhonePose(DEFAULT_IOS_HERO_PHONE_POSE),
  });
  const [heroPhoneShapeByStore, setHeroPhoneShapeByStore] = useState<Record<ScreenshotStore, IosHeroPhoneShape | null>>({
    ios: resolveProceduralDeviceShapeForStore('ios', getDefaultProceduralDeviceShape('ios')),
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
  const [panelState, setPanelState] = useState({
    rotation: false,
    color: false,
    shape: false,
    location: false,
    light: false,
    sbe: false,
  });
  const fileReadRequestIdsRef = useRef<Record<string, number>>({});
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
      heroPhoneShape: resolveProceduralDeviceShapeForStore('ios', getDefaultProceduralDeviceShape('ios')),
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
      slotTitleTypography: createSlotTitleTypographyMap('play_store'),
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
    const sharedPresetSource = initialIosPreset ?? initialPlayPreset;
    const nextSlotPalettes: Record<ScreenshotStore, ScreenshotSlotPaletteMap> = {
      ios: createSlotPaletteMap('ios', sharedPresetSource),
      play_store: createSlotPaletteMap('play_store', sharedPresetSource),
    };
    const sharedSlotTitles = createSlotTitleMap(sharedPresetSource);
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
    const sharedTitleLineGap = createSlotTitleLineGapMap(sharedPresetSource);
    const nextTitleLineGap: Record<ScreenshotStore, ScreenshotSlotTitleLineGapMap> = {
      ios: { ...sharedTitleLineGap },
      play_store: { ...sharedTitleLineGap },
    };
    const nextHeroPhonePose: Record<ScreenshotStore, IosHeroPhonePose | null> = {
      ios: resolveIosHeroPhonePose(initialIosPreset?.heroPhonePose),
      play_store: resolveIosHeroPhonePose(initialPlayPreset?.heroPhonePose),
    };
    const nextHeroPhoneShape: Record<ScreenshotStore, IosHeroPhoneShape | null> = {
      ios: resolveProceduralDeviceShapeForStore('ios', initialIosPreset?.heroPhoneShape),
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
    setLocale(nextLocale);
    setSlot(1);
    setTitlesByStore(nextSlotTitles);
    setTitleLineGapByStore(nextTitleLineGap);
    setTitleExtraLineColorsByStore(nextSlotTitleExtraLineColors);
    setTitleTypographyByStore(nextSlotTitleTypography);
    setFilesByStore({
      ios: createEmptySlotFileMap(),
      play_store: createEmptySlotFileMap(),
    });
    setFilePreviewUrlsByStore({
      ios: createEmptySlotPreviewUrlMap(),
      play_store: createEmptySlotPreviewUrlMap(),
    });
    setFilePreviewErrorsByStore({
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
        slotTitleTypography: nextSlotTitleTypography.play_store,
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
  }, [appId, defaultLocale, defaultStore, isOpen, presets]);

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
    () => resolveIosHeroPhonePose(heroPhonePoseByStore[store]),
    [heroPhonePoseByStore, store]
  );
  const resolvedHeroPhoneShape = useMemo(
    () => resolveProceduralDeviceShapeForStore(store, heroPhoneShapeByStore[store]),
    [heroPhoneShapeByStore, store]
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
    const heroPhonePose = resolveIosHeroPhonePose(heroPhonePoseByStore[targetStore]);
    const resolvedHeroPhoneShapeForStore = resolveProceduralDeviceShapeForStore(
      targetStore,
      heroPhoneShapeByStore[targetStore]
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
      slotTitleTypography,
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
  }, [heroCameraModeByStore, heroCameraSettingsByStore, heroKeyLightPositionByStore, heroKeyLightSettingsByStore, heroPhoneLocationByStore, heroPhonePoseByStore, heroPhoneShapeByStore, persistedTitleExtraLineColorsForStore, slotPalettesByStore, slotSbeSettingsByStore, store, titleExtraLineColorsByStore, titleLineGapByStore, titleTypographyByStore, titlesByStore]);
  const previewCanvasSize = useMemo(() => getScreenshotTemplateCanvasSize(store), [store]);
  const paletteFields = useMemo(() => getScreenshotTemplatePaletteFields(store, slot), [slot, store]);
  const isLocked = isBusy;
  const isHeroSlot = slot <= 2;
  const selectedSlotFile = filesByStore[store]?.[slot] ?? null;
  const selectedSlotPreviewError = filePreviewErrorsByStore[store]?.[slot] ?? '';
  const hasAnySlotScreenshot = useMemo(
    () => SCREENSHOT_TEMPLATE_SLOTS.some((targetSlot) => Boolean(filesByStore[store]?.[targetSlot])),
    [filesByStore, store]
  );
  const canStart = locale.trim().length > 0 && hasAnySlotScreenshot && !isLocked;
  const canSaveSettings = Boolean(appId) && !isLocked && !isPersistingPreset;

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
  }, [slot]);

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

    if (slot > 2) return;

    setHeroPhonePoseByStore((prev) => ({
      ...prev,
      [store]: resolveIosHeroPhonePose(DEFAULT_IOS_HERO_PHONE_POSE),
    }));
    setHeroPhoneShapeByStore((prev) => ({
      ...prev,
      [store]: resolveProceduralDeviceShapeForStore(store, getDefaultProceduralDeviceShape(store)),
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
          [slot]: resolveSlot1SbeSettings(DEFAULT_SLOT_1_SBE_SETTINGS),
        },
        play_store: {
          ...prev.play_store,
          [slot]: resolveSlot1SbeSettings(DEFAULT_SLOT_1_SBE_SETTINGS),
        },
      }));
    }
    setHeroCameraModeByStore((prev) => ({
      ...prev,
      [store]: resolveProceduralCameraMode(DEFAULT_PROCEDURAL_CAMERA_MODE),
    }));
    setHeroCameraSettingsByStore((prev) => ({
      ...prev,
      [store]: resolveProceduralCameraSettings(DEFAULT_PROCEDURAL_CAMERA_SETTINGS),
    }));
  }, [slot, store]);

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
          ...(prev[store] ?? getDefaultProceduralDeviceShape(store)),
          [key]: value,
        }),
      }));
    },
    [store]
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
      setSlotSbeSettingsByStore((prev) => ({
        ios: {
          ...prev.ios,
          [slot]: resolveSlot1SbeSettings({
            ...(prev.ios?.[slot] ?? DEFAULT_SLOT_1_SBE_SETTINGS),
            [key]: value,
          }),
        },
        play_store: {
          ...prev.play_store,
          [slot]: resolveSlot1SbeSettings({
            ...(prev.play_store?.[slot] ?? DEFAULT_SLOT_1_SBE_SETTINGS),
            [key]: value,
          }),
        },
      }));
    },
    [slot]
  );

  const renderBrowserScreenshotCanvas = useCallback(async (
    targetSlot: ScreenshotTemplateSlot,
    screenshotDataUrl?: string
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
        titleTypography: slotTitleTypography,
        titleExtraLineColors: slotTitleExtraLineColors,
        titleLineGap: slotTitleLineGap,
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
  }, [browserImageLoader, previewCanvasSize.height, previewCanvasSize.width, resolvedHeroCameraMode, resolvedHeroCameraSettings, resolvedHeroKeyLightPosition, resolvedHeroKeyLightSettings, resolvedHeroPhoneLocation, resolvedHeroPhonePose, resolvedHeroPhoneShape, slotPalettesByStore, slotSbeSettingsByStore, store, titleExtraLineColorsByStore, titleLineGapByStore, titleTypographyByStore, titlesByStore]);

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
                  screenshotUrl={filePreviewUrlsByStore[store]?.[previewSlot] ?? ''}
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
                  onChange={(event) => handleTitleLineGapChange(Number(event.target.value))}
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
              {selectedSlotFile
                ? `${selectedSlotFile.name} - ${formatFileSize(selectedSlotFile.size)}`
                : 'Henüz dosya seçilmedi.'}
            </div>
            {selectedSlotPreviewError ? (
              <div className="screenshot-file-error">{selectedSlotPreviewError}</div>
            ) : null}

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
                const nextLocale = locale.trim();
                if (!nextLocale) return;

                void (async () => {
                  const renderedSlots: ScreenshotRenderedSlotPayload[] = [];
                  const firstAvailableFile =
                    filesByStore[store][slot] ??
                    SCREENSHOT_TEMPLATE_SLOTS.map((targetSlot) => filesByStore[store][targetSlot]).find(
                      (candidate): candidate is File => Boolean(candidate)
                    ) ??
                    null;

                  for (const targetSlot of SCREENSHOT_TEMPLATE_SLOTS) {
                    const slotFile = filesByStore[store][targetSlot];
                    const slotScreenshotDataUrl =
                      filePreviewUrlsByStore[store]?.[targetSlot] ||
                      (slotFile ? await readFileAsDataUrl(slotFile) : '');
                    const renderedCanvas = await renderBrowserScreenshotCanvas(
                      targetSlot,
                      slotScreenshotDataUrl
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
                      sourceImageBase64: slotScreenshotDataUrl
                        ? dataUrlToBase64(slotScreenshotDataUrl)
                        : null,
                      sourceFileName: slotFile?.name ?? null,
                      sourceMimeType: slotFile?.type || null,
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
                    });
                  }

                  onStart({
                    locale: nextLocale,
                    store,
                    slot,
                    title: resolvedTitle.trim(),
                    file: selectedSlotFile ?? firstAvailableFile,
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
                    slotSbeSettings: {
                      1: resolveSlot1SbeSettings(slotSbeSettingsByStore[store]?.[1]),
                      2: resolveSlot1SbeSettings(slotSbeSettingsByStore[store]?.[2]),
                    },
                    heroCameraMode: resolvedHeroCameraMode,
                    heroCameraSettings: resolvedHeroCameraSettings,
                    renderedSlots,
                  });
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
              {isBusy ? 'İşleniyor...' : '6 Screenshot Üret'}
            </Button>
          </div>
        </div>
      </section>
    </dialog>
  );
}
