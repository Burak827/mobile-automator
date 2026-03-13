import type { Router } from "express";
import {
  type AppRecord,
  type CreateAppInput,
  type MobileAutomatorRepository,
  type UpdateAppInput,
} from "./db.js";
import type { SyncJobRunner } from "./jobRunner.js";
import type { StoreApiService } from "./storeService.js";
import type { StoreId } from "./storeRules.js";
import {
  resolveProceduralCameraSettings,
  resolveProceduralKeyLightSettings,
  resolveProceduralLightPosition,
  resolveProceduralCameraMode,
  resolveProceduralDeviceLocation,
  resolveProceduralDeviceShapeForStore,
  type IosHeroPhoneShape,
  resolveIosHeroPhonePose,
  type IosHeroPhonePose,
  type ProceduralCameraMode,
  type ProceduralCameraSettings,
  type ProceduralDeviceLocation,
  type ProceduralKeyLightSettings,
  type ProceduralLightPosition,
} from "./screenshotTemplates/proceduralDeviceConfig.js";
import {
  getDefaultSlotSbeSettings,
  resolveSlot1SbeSettings,
  type Slot1SbeSettings,
} from "./screenshotTemplates/slot1Sbe.js";
import {
  SCREENSHOT_TEMPLATE_SLOTS,
  resolveScreenshotTemplatePalette,
  type ScreenshotTemplateSlot,
  type ScreenshotTemplatePalette,
} from "./screenshotTemplates/storeScreenshotTemplateRegistry.js";
import {
  getScreenshotStoreLabel,
  parseScreenshotStore,
  type ScreenshotStore,
} from "./screenshotTemplates/screenshotStores.js";
import {
  resolveScreenshotTitleTypography,
  type ScreenshotTitleTypography,
} from "./screenshotTemplates/screenshotTitleTypography.js";
import {
  createDefaultScreenshotTitleCenterMap,
  parseScreenshotTitleCenterInput,
  resolveStoredScreenshotTitleCenterMap,
} from "./screenshotTemplates/screenshotTitleAlignment.js";
import { resolveStoredScreenshotTitleExtraLineColorsMap } from "./screenshotTemplates/screenshotTitleColors.js";
import {
  resolveStoredScreenshotBackgroundSettingsMap,
  type ScreenshotBackgroundSettings,
} from "./screenshotTemplates/screenshotBackgroundSettings.js";

// ---------------------------------------------------------------------------
// Server context — shared dependencies injected into route modules
// ---------------------------------------------------------------------------

export type ServerContext = {
  repo: MobileAutomatorRepository;
  storeApi: StoreApiService;
  jobRunner: SyncJobRunner;
  env: Record<string, string | undefined>;
};

export type RouteRegistrar = (router: Router, ctx: ServerContext) => void;

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type LocaleSelectionRow = {
  locale: string;
  asc: boolean;
  android: boolean;
};

export type LocaleChangeInput = {
  store: StoreId;
  locale: string;
  action: "add" | "remove" | "update";
  fields?: Record<string, string>;
};

export type IapFieldChangeInput = {
  store: StoreId;
  productId: string;
  iapType?: string;
  locale: string;
  field: string;
  newValue: string;
};

// ---------------------------------------------------------------------------
// Generic parsers (used across multiple route modules)
// ---------------------------------------------------------------------------

export function parseId(raw: string): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid id: ${raw}`);
  }
  return value;
}

export function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function toNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function toOptionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "y"].includes(normalized)) return true;
    if (["0", "false", "no", "n"].includes(normalized)) return false;
  }
  return fallback;
}

export function parseStoreScope(value: unknown): "app_store" | "play_store" | "both" {
  if (value === "app_store" || value === "play_store" || value === "both") {
    return value;
  }
  return "both";
}

export function parseStoreId(value: unknown): StoreId {
  if (value === "app_store" || value === "play_store") {
    return value;
  }
  throw new Error("store must be one of: app_store | play_store");
}

export function parseJsonOrUndefined(raw?: string): unknown {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export function sanitizePathToken(value: string): string {
  return value.replace(/[^a-zA-Z0-9-_]/g, "_");
}

export function resolveImageExtension(fileName: string, mimeType: string): string {
  const normalizedMime = mimeType.trim().toLowerCase();
  if (normalizedMime === "image/jpeg" || normalizedMime === "image/jpg") return "jpg";
  if (normalizedMime === "image/png") return "png";
  if (normalizedMime === "image/webp") return "webp";

  const ext = fileName.split(".").pop()?.trim().toLowerCase() ?? "";
  if (ext === "jpeg" || ext === "jpg") return "jpg";
  if (ext === "png") return "png";
  if (ext === "webp") return "webp";
  return "png";
}

export function toProjectRelativePath(path: string): string {
  const cwd = process.cwd();
  const prefix = `${cwd}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

export function mustGetApp(repo: MobileAutomatorRepository, appId: number): AppRecord {
  const appRow = repo.getAppById(appId);
  if (!appRow) {
    throw new Error(`App not found: ${appId}`);
  }
  return appRow;
}

// ---------------------------------------------------------------------------
// App input parsers
// ---------------------------------------------------------------------------

export function parseCreateAppInput(body: Record<string, unknown>): CreateAppInput {
  const canonicalName = toOptionalString(body.canonicalName);
  if (!canonicalName) {
    throw new Error("canonicalName is required.");
  }

  return {
    canonicalName,
    sourceLocale: toOptionalString(body.sourceLocale),
    androidPackageName: toOptionalString(body.androidPackageName),
    ascAppId: toOptionalString(body.ascAppId),
  };
}

export function parseUpdateAppInput(body: Record<string, unknown>): UpdateAppInput {
  const next: UpdateAppInput = {};

  if (body.canonicalName !== undefined) {
    const canonicalName = toOptionalString(body.canonicalName);
    if (!canonicalName) {
      throw new Error("canonicalName cannot be empty.");
    }
    next.canonicalName = canonicalName;
  }

  if (body.sourceLocale !== undefined) {
    const sourceLocale = toOptionalString(body.sourceLocale);
    if (!sourceLocale) {
      throw new Error("sourceLocale cannot be empty.");
    }
    next.sourceLocale = sourceLocale;
  }

  if (body.androidPackageName !== undefined)
    next.androidPackageName = toOptionalString(body.androidPackageName);
  if (body.ascAppId !== undefined) next.ascAppId = toOptionalString(body.ascAppId);

  return next;
}

// ---------------------------------------------------------------------------
// Locale parsers
// ---------------------------------------------------------------------------

export function parseLocaleList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item.length > 0);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  return [];
}

export function parseLocaleMatrix(value: unknown): LocaleSelectionRow[] {
  if (!Array.isArray(value)) return [];
  const rows: LocaleSelectionRow[] = [];

  for (const item of value) {
    const row = (item ?? {}) as Record<string, unknown>;
    const locale = toOptionalString(row.locale);
    if (!locale) continue;
    rows.push({
      locale,
      asc: parseBoolean(row.asc, false),
      android: parseBoolean(row.android, false),
    });
  }

  return rows;
}

export function parseLocaleChanges(raw: unknown[]): LocaleChangeInput[] {
  const result: LocaleChangeInput[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const store =
      row.store === "app_store" || row.store === "play_store"
        ? (row.store as StoreId)
        : null;
    const locale = typeof row.locale === "string" ? row.locale.trim() : "";
    const action =
      row.action === "add" || row.action === "remove" || row.action === "update"
        ? (row.action as "add" | "remove" | "update")
        : null;
    if (!store || !locale || !action) continue;

    let fields: Record<string, string> | undefined;
    if ((action === "add" || action === "update") && row.fields && typeof row.fields === "object") {
      fields = {};
      for (const [key, val] of Object.entries(row.fields as Record<string, unknown>)) {
        if (typeof val === "string") fields[key] = val;
      }
    }

    result.push({ store, locale, action, fields });
  }
  return result;
}

export function parseIapFieldChanges(raw: unknown[]): IapFieldChangeInput[] {
  const result: IapFieldChangeInput[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const store =
      row.store === "app_store" || row.store === "play_store"
        ? (row.store as StoreId)
        : null;
    const productId = typeof row.productId === "string" ? row.productId.trim() : "";
    const locale = typeof row.locale === "string" ? row.locale.trim() : "";
    const field = typeof row.field === "string" ? row.field.trim() : "";
    const iapType = typeof row.iapType === "string" ? row.iapType.trim() : undefined;
    const newValueRaw = row.newValue;
    const newValue =
      typeof newValueRaw === "string"
        ? newValueRaw
        : newValueRaw === undefined || newValueRaw === null
          ? ""
          : String(newValueRaw);

    if (!store || !productId || !locale || !field) continue;
    result.push({
      store,
      productId,
      iapType,
      locale,
      field,
      newValue,
    });
  }

  return result;
}

export function applyLocaleChangesToList(
  current: string[],
  changes: LocaleChangeInput[]
): string[] {
  const set = new Set(current);
  for (const change of changes) {
    if (change.action === "add") set.add(change.locale);
    else if (change.action === "remove") set.delete(change.locale);
    // "update" doesn't change the locale list
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

// ---------------------------------------------------------------------------
// Screenshot parsers
// ---------------------------------------------------------------------------

export function parseScreenshotSlot(value: unknown): 1 | 2 | 3 | 4 | 5 | 6 {
  const slot = Number(value);
  if (!Number.isInteger(slot) || slot < 1 || slot > 6) {
    throw new Error("slot 1..6 arasında olmalı.");
  }
  return slot as 1 | 2 | 3 | 4 | 5 | 6;
}

export function parseScreenshotPaletteInput(
  store: ScreenshotStore,
  value: unknown
): ScreenshotTemplatePalette {
  if (!value || typeof value !== "object") {
    return resolveScreenshotTemplatePalette(store);
  }

  const raw = value as Record<string, unknown>;
  return resolveScreenshotTemplatePalette(store, {
    accent: toNonEmptyString(raw.accent),
    bgDark: toNonEmptyString(raw.bgDark),
    bgInk: toNonEmptyString(raw.bgInk),
    cream: toNonEmptyString(raw.cream),
    muted: toNonEmptyString(raw.muted),
  });
}

export function parseScreenshotHeroPhonePoseInput(
  store: ScreenshotStore,
  value: unknown
): IosHeroPhonePose | null {
  if (store !== "ios") return null;
  if (!value || typeof value !== "object") {
    return resolveIosHeroPhonePose();
  }

  const raw = value as Record<string, unknown>;
  return resolveIosHeroPhonePose({
    rotateX: toOptionalNumber(raw.rotateX),
    rotateY: toOptionalNumber(raw.rotateY),
    rotateZ: toOptionalNumber(raw.rotateZ),
  });
}

export function parseScreenshotHeroPhoneShapeInput(
  store: ScreenshotStore,
  value: unknown
): IosHeroPhoneShape | null {
  if (!value || typeof value !== "object") {
    return resolveProceduralDeviceShapeForStore(store, undefined);
  }

  const raw = value as Record<string, unknown>;
  return resolveProceduralDeviceShapeForStore(store, {
    widthMm: toOptionalNumber(raw.widthMm),
    lengthMm: toOptionalNumber(raw.lengthMm),
    thicknessMm: toOptionalNumber(raw.thicknessMm),
    edgeSmoothnessMm: toOptionalNumber(raw.edgeSmoothnessMm),
    islandWidthMm: toOptionalNumber(raw.islandWidthMm),
    islandLengthMm: toOptionalNumber(raw.islandLengthMm),
    islandRadiusMm: toOptionalNumber(raw.islandRadiusMm),
    width: toOptionalNumber(raw.width),
    height: toOptionalNumber(raw.height),
    length: toOptionalNumber(raw.length),
    depth: toOptionalNumber(raw.depth),
    thickness: toOptionalNumber(raw.thickness),
    edgeRadius: toOptionalNumber(raw.edgeRadius),
    edgeSmoothness: toOptionalNumber(raw.edgeSmoothness),
    islandWidth: toOptionalNumber(raw.islandWidth),
    islandLength: toOptionalNumber(raw.islandLength),
    islandRadius: toOptionalNumber(raw.islandRadius),
  });
}

export function parseScreenshotHeroPhoneLocationInput(
  store: ScreenshotStore,
  value: unknown
): ProceduralDeviceLocation | null {
  if (store !== "ios") return null;
  if (!value || typeof value !== "object") {
    return resolveProceduralDeviceLocation();
  }

  const raw = value as Record<string, unknown>;
  return resolveProceduralDeviceLocation({
    x: toOptionalNumber(raw.x),
    y: toOptionalNumber(raw.y),
    z: toOptionalNumber(raw.z),
  });
}

export function parseScreenshotHeroKeyLightPositionInput(
  store: ScreenshotStore,
  value: unknown
): ProceduralLightPosition | null {
  if (store !== "ios") return null;
  if (!value || typeof value !== "object") {
    return resolveProceduralLightPosition();
  }

  const raw = value as Record<string, unknown>;
  return resolveProceduralLightPosition({
    x: toOptionalNumber(raw.x),
    y: toOptionalNumber(raw.y),
    z: toOptionalNumber(raw.z),
  });
}

export function parseScreenshotHeroKeyLightSettingsInput(
  store: ScreenshotStore,
  value: unknown,
  fallbackPosition?: unknown
): ProceduralKeyLightSettings | null {
  if (store !== "ios") return null;
  const resolvedFallbackPosition = parseScreenshotHeroKeyLightPositionInput(store, fallbackPosition);
  if (!value || typeof value !== "object") {
    return resolveProceduralKeyLightSettings(undefined, resolvedFallbackPosition);
  }

  const raw = value as Record<string, unknown>;
  return resolveProceduralKeyLightSettings(
    {
      azimuthDeg: toOptionalNumber(raw.azimuthDeg),
      elevationDeg: toOptionalNumber(raw.elevationDeg),
      distance: toOptionalNumber(raw.distance),
      intensity: toOptionalNumber(raw.intensity),
      color: toOptionalString(raw.color),
    },
    resolvedFallbackPosition
  );
}

export function parseScreenshotSlot1SbeSettingsInput(
  store: ScreenshotStore,
  value: unknown
): Slot1SbeSettings | null {
  void store;
  if (!value || typeof value !== "object") {
    return resolveSlot1SbeSettings();
  }

  const raw = value as Record<string, unknown>;
  return resolveSlot1SbeSettings({
    lineWidth: toOptionalNumber(raw.lineWidth),
    lineColor: toOptionalString(raw.lineColor),
    opacity: toOptionalNumber(raw.opacity),
    scale: toOptionalNumber(raw.scale),
    angleDeg: toOptionalNumber(raw.angleDeg),
    copyCount: toOptionalNumber(raw.copyCount),
    positionX: toOptionalNumber(raw.positionX),
    positionY: toOptionalNumber(raw.positionY),
    originX: toOptionalNumber(raw.originX),
    originY: toOptionalNumber(raw.originY),
    originZ: toOptionalNumber(raw.originZ),
  });
}

export function parseScreenshotSlotSbeSettingsInput(
  store: ScreenshotStore,
  value: unknown,
  legacyValue?: unknown
): Partial<Record<ScreenshotTemplateSlot, Slot1SbeSettings>> {
  void store;
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const legacy = parseScreenshotSlot1SbeSettingsInput(store, legacyValue);
  return {
    1:
      parseSlotSpecificSbeSettingsInput(1, raw['1']) ??
      legacy ??
      resolveSlot1SbeSettings(getDefaultSlotSbeSettings(1)),
    2:
      parseSlotSpecificSbeSettingsInput(2, raw['2']) ??
      legacy ??
      resolveSlot1SbeSettings(getDefaultSlotSbeSettings(2)),
  };
}

function parseSlotSpecificSbeSettingsInput(slot: 1 | 2, value: unknown): Slot1SbeSettings | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;
  return resolveSlot1SbeSettings({
    ...getDefaultSlotSbeSettings(slot),
    lineWidth: toOptionalNumber(raw.lineWidth),
    lineColor: toOptionalString(raw.lineColor),
    opacity: toOptionalNumber(raw.opacity),
    scale: toOptionalNumber(raw.scale),
    angleDeg: toOptionalNumber(raw.angleDeg),
    copyCount: toOptionalNumber(raw.copyCount),
    positionX: toOptionalNumber(raw.positionX),
    positionY: toOptionalNumber(raw.positionY),
    originX: toOptionalNumber(raw.originX),
    originY: toOptionalNumber(raw.originY),
    originZ: toOptionalNumber(raw.originZ),
  });
}

export function parseScreenshotHeroCameraModeInput(
  store: ScreenshotStore,
  value: unknown
): ProceduralCameraMode | null {
  if (store !== "ios") return null;
  return resolveProceduralCameraMode(value);
}

export function parseScreenshotHeroCameraSettingsInput(
  store: ScreenshotStore,
  value: unknown
): ProceduralCameraSettings | null {
  if (store !== "ios") return null;
  if (!value || typeof value !== "object") {
    return resolveProceduralCameraSettings();
  }

  const raw = value as Record<string, unknown>;
  return resolveProceduralCameraSettings({
    perspectiveFov: toOptionalNumber(raw.perspectiveFov),
    orthographicFrustumHeight: toOptionalNumber(raw.orthographicFrustumHeight),
  });
}

export function parseStoredScreenshotPalette(
  store: ScreenshotStore,
  value: unknown
): ScreenshotTemplatePalette {
  if (!value || typeof value !== "object") {
    return resolveScreenshotTemplatePalette(store);
  }

  const raw = value as Record<string, unknown>;
  return resolveScreenshotTemplatePalette(store, {
    accent: toNonEmptyString(raw.accent),
    bgDark: toNonEmptyString(raw.bgDark),
    bgInk: toNonEmptyString(raw.bgInk),
    cream: toNonEmptyString(raw.cream),
    muted: toNonEmptyString(raw.muted),
  });
}

export function parseScreenshotSlotPalettesInput(
  store: ScreenshotStore,
  value: unknown,
  fallbackPalette?: ScreenshotTemplatePalette
): Record<ScreenshotTemplateSlot, ScreenshotTemplatePalette> {
  return parseStoredScreenshotSlotPalettes(
    store,
    value,
    fallbackPalette ?? resolveScreenshotTemplatePalette(store)
  );
}

export function parseScreenshotSlotTitlesInput(
  value: unknown
): Record<ScreenshotTemplateSlot, string> {
  return parseStoredScreenshotSlotTitles(value);
}

export function parseScreenshotTitleTranslationsInput(
  value: unknown
): Record<string, Record<ScreenshotTemplateSlot, string>> {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const next: Record<string, Record<ScreenshotTemplateSlot, string>> = {};

  for (const [locale, titles] of Object.entries(raw)) {
    const normalizedLocale = toNonEmptyString(locale);
    if (!normalizedLocale) continue;
    next[normalizedLocale] = parseStoredScreenshotSlotTitles(titles);
  }

  return next;
}

export function parseScreenshotSlotTitleExtraLineColorsInput(
  value: unknown
): Record<ScreenshotTemplateSlot, string[]> {
  return resolveStoredScreenshotTitleExtraLineColorsMap(value);
}

export function parseScreenshotTitleLineGapInput(value: unknown): number {
  return toOptionalNumber(value) ?? 0;
}

export function parseScreenshotSlotTitleLineGapsInput(
  value: unknown,
  legacyValue?: unknown
): Record<ScreenshotTemplateSlot, number> {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const legacyGap = parseScreenshotTitleLineGapInput(legacyValue);
  const next = {} as Record<ScreenshotTemplateSlot, number>;

  for (const slot of SCREENSHOT_TEMPLATE_SLOTS) {
    next[slot] = parseScreenshotTitleLineGapInput(raw[String(slot)]);
  }

  if (!value || typeof value !== "object") {
    for (const slot of SCREENSHOT_TEMPLATE_SLOTS) {
      next[slot] = legacyGap;
    }
  }

  return next;
}

export function parseScreenshotSlotTitleCentersInput(
  value: unknown
): Record<ScreenshotTemplateSlot, boolean> {
  const defaults = createDefaultScreenshotTitleCenterMap();
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const next = { ...defaults };

  for (const slot of SCREENSHOT_TEMPLATE_SLOTS) {
    next[slot] = parseScreenshotTitleCenterInput(raw[String(slot)], defaults[slot]);
  }

  return next;
}

export function parseScreenshotSlotTitleTypographyInput(
  store: ScreenshotStore,
  value: unknown
): Record<ScreenshotTemplateSlot, ScreenshotTitleTypography> {
  return parseStoredScreenshotSlotTitleTypography(store, value);
}

export function parseScreenshotSlotBackgroundSettingsInput(
  value: unknown
): Record<ScreenshotTemplateSlot, ScreenshotBackgroundSettings> {
  return resolveStoredScreenshotBackgroundSettingsMap(value);
}

export function parseStoredScreenshotPresetConfig(
  store: ScreenshotStore,
  value: unknown
): {
  palette: ScreenshotTemplatePalette;
  slotPalettes: Record<ScreenshotTemplateSlot, ScreenshotTemplatePalette>;
  slotTitles: Record<ScreenshotTemplateSlot, string>;
  slotTitleExtraLineColors: Record<ScreenshotTemplateSlot, string[]>;
  slotTitleLineGaps: Record<ScreenshotTemplateSlot, number>;
  slotTitleCenters: Record<ScreenshotTemplateSlot, boolean>;
  slotTitleTypography: Record<ScreenshotTemplateSlot, ScreenshotTitleTypography>;
  slotBackgroundSettings: Record<ScreenshotTemplateSlot, ScreenshotBackgroundSettings>;
  heroPhonePose: IosHeroPhonePose | null;
  heroPhoneShape: IosHeroPhoneShape | null;
  heroPhoneLocation: ProceduralDeviceLocation | null;
  heroKeyLightPosition: ProceduralLightPosition | null;
  heroKeyLightSettings: ProceduralKeyLightSettings | null;
  slotSbeSettings: Partial<Record<ScreenshotTemplateSlot, Slot1SbeSettings>>;
  heroCameraMode: ProceduralCameraMode | null;
  heroCameraSettings: ProceduralCameraSettings | null;
} {
  const defaultPalette = resolveScreenshotTemplatePalette(store);
  if (!value || typeof value !== "object") {
    return {
      palette: defaultPalette,
      slotPalettes: parseStoredScreenshotSlotPalettes(store, undefined, defaultPalette),
      slotTitles: parseStoredScreenshotSlotTitles(undefined),
      slotTitleExtraLineColors: resolveStoredScreenshotTitleExtraLineColorsMap(undefined),
      slotTitleLineGaps: parseScreenshotSlotTitleLineGapsInput(undefined, undefined),
      slotTitleCenters: parseScreenshotSlotTitleCentersInput(undefined),
      slotTitleTypography: parseStoredScreenshotSlotTitleTypography(store, undefined),
      slotBackgroundSettings: parseScreenshotSlotBackgroundSettingsInput(undefined),
      heroPhonePose: parseScreenshotHeroPhonePoseInput(store, undefined),
      heroPhoneShape: parseScreenshotHeroPhoneShapeInput(store, undefined),
      heroPhoneLocation: parseScreenshotHeroPhoneLocationInput(store, undefined),
      heroKeyLightPosition: parseScreenshotHeroKeyLightPositionInput(store, undefined),
      heroKeyLightSettings: parseScreenshotHeroKeyLightSettingsInput(store, undefined, undefined),
      slotSbeSettings: parseScreenshotSlotSbeSettingsInput(store, undefined, undefined),
      heroCameraMode: parseScreenshotHeroCameraModeInput(store, undefined),
      heroCameraSettings: parseScreenshotHeroCameraSettingsInput(store, undefined),
    };
  }

  const raw = value as Record<string, unknown>;
  if (
    "palette" in raw ||
    "slotPalettes" in raw ||
    "slotTitles" in raw ||
    "slotTitleExtraLineColors" in raw ||
    "slotTitleLineGaps" in raw ||
    "slotTitleCenters" in raw ||
    "titleLineGap" in raw ||
    "slotTitleTypography" in raw ||
    "slotBackgroundSettings" in raw ||
    "heroPhonePose" in raw ||
    "heroPhoneShape" in raw ||
    "heroPhoneLocation" in raw ||
    "heroKeyLightPosition" in raw ||
    "heroKeyLightSettings" in raw ||
    "slotSbeSettings" in raw ||
    "slot1SbeSettings" in raw ||
    "heroCameraMode" in raw ||
    "heroCameraSettings" in raw
  ) {
    const palette = parseStoredScreenshotPalette(store, raw.palette);
    return {
      palette,
      slotPalettes: parseStoredScreenshotSlotPalettes(store, raw.slotPalettes, palette),
      slotTitles: parseStoredScreenshotSlotTitles(raw.slotTitles),
      slotTitleExtraLineColors: resolveStoredScreenshotTitleExtraLineColorsMap(raw.slotTitleExtraLineColors),
      slotTitleLineGaps: parseScreenshotSlotTitleLineGapsInput(raw.slotTitleLineGaps, raw.titleLineGap),
      slotTitleCenters: parseScreenshotSlotTitleCentersInput(raw.slotTitleCenters),
      slotTitleTypography: parseStoredScreenshotSlotTitleTypography(store, raw.slotTitleTypography),
      slotBackgroundSettings: parseScreenshotSlotBackgroundSettingsInput(raw.slotBackgroundSettings),
      heroPhonePose: parseScreenshotHeroPhonePoseInput(store, raw.heroPhonePose),
      heroPhoneShape: parseScreenshotHeroPhoneShapeInput(store, raw.heroPhoneShape),
      heroPhoneLocation: parseScreenshotHeroPhoneLocationInput(store, raw.heroPhoneLocation),
      heroKeyLightPosition: parseScreenshotHeroKeyLightPositionInput(store, raw.heroKeyLightPosition),
      heroKeyLightSettings: parseScreenshotHeroKeyLightSettingsInput(
        store,
        raw.heroKeyLightSettings,
        raw.heroKeyLightPosition
      ),
      slotSbeSettings: parseScreenshotSlotSbeSettingsInput(store, raw.slotSbeSettings, raw.slot1SbeSettings),
      heroCameraMode: parseScreenshotHeroCameraModeInput(store, raw.heroCameraMode),
      heroCameraSettings: parseScreenshotHeroCameraSettingsInput(store, raw.heroCameraSettings),
    };
  }

  const palette = parseStoredScreenshotPalette(store, raw);
  return {
    palette,
    slotPalettes: parseStoredScreenshotSlotPalettes(store, undefined, palette),
    slotTitles: parseStoredScreenshotSlotTitles(undefined),
    slotTitleExtraLineColors: resolveStoredScreenshotTitleExtraLineColorsMap(undefined),
    slotTitleLineGaps: parseScreenshotSlotTitleLineGapsInput(undefined, undefined),
    slotTitleCenters: parseScreenshotSlotTitleCentersInput(undefined),
    slotTitleTypography: parseStoredScreenshotSlotTitleTypography(store, undefined),
    slotBackgroundSettings: parseScreenshotSlotBackgroundSettingsInput(undefined),
    heroPhonePose: parseScreenshotHeroPhonePoseInput(store, undefined),
    heroPhoneShape: parseScreenshotHeroPhoneShapeInput(store, undefined),
    heroPhoneLocation: parseScreenshotHeroPhoneLocationInput(store, undefined),
    heroKeyLightPosition: parseScreenshotHeroKeyLightPositionInput(store, undefined),
    heroKeyLightSettings: parseScreenshotHeroKeyLightSettingsInput(store, undefined, undefined),
    slotSbeSettings: parseScreenshotSlotSbeSettingsInput(store, undefined, undefined),
    heroCameraMode: parseScreenshotHeroCameraModeInput(store, undefined),
    heroCameraSettings: parseScreenshotHeroCameraSettingsInput(store, undefined),
  };
}

export function parseScreenshotStoreParam(value: unknown): ScreenshotStore {
  const store = parseScreenshotStore(typeof value === "string" ? value : undefined);
  if (!store) {
    throw new Error("screenshot store must be one of: ios | play-store");
  }
  return store;
}

export function serializeScreenshotPresetRecord(record: {
  store: ScreenshotStore;
  paletteJson: string;
  updatedAt: string;
}) {
  const config = parseStoredScreenshotPresetConfig(record.store, parseJsonOrUndefined(record.paletteJson));
  return {
    store: record.store,
    label: getScreenshotStoreLabel(record.store),
    palette: config.palette,
    slotPalettes: config.slotPalettes,
    slotTitles: config.slotTitles,
    slotTitleExtraLineColors: config.slotTitleExtraLineColors,
    slotTitleLineGaps: config.slotTitleLineGaps,
    slotTitleCenters: config.slotTitleCenters,
    slotTitleTypography: config.slotTitleTypography,
    slotBackgroundSettings: config.slotBackgroundSettings,
    heroPhonePose: config.heroPhonePose,
    heroPhoneShape: config.heroPhoneShape,
    heroPhoneLocation: config.heroPhoneLocation,
    heroKeyLightPosition: config.heroKeyLightPosition,
    heroKeyLightSettings: config.heroKeyLightSettings,
    slotSbeSettings: config.slotSbeSettings,
    heroCameraMode: config.heroCameraMode,
    heroCameraSettings: config.heroCameraSettings,
    updatedAt: record.updatedAt,
  };
}

export function serializeScreenshotTitleTranslationRecord(record: {
  locale: string;
  titlesJson: string;
  updatedAt: string;
}) {
  return {
    locale: record.locale,
    slotTitles: parseScreenshotSlotTitlesInput(parseJsonOrUndefined(record.titlesJson)),
    updatedAt: record.updatedAt,
  };
}

function parseStoredScreenshotSlotPalettes(
  store: ScreenshotStore,
  value: unknown,
  fallbackPalette: ScreenshotTemplatePalette
): Record<ScreenshotTemplateSlot, ScreenshotTemplatePalette> {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const next = {} as Record<ScreenshotTemplateSlot, ScreenshotTemplatePalette>;

  for (const slot of SCREENSHOT_TEMPLATE_SLOTS) {
    next[slot] = parseStoredScreenshotPalette(store, raw[String(slot)] ?? fallbackPalette);
  }

  return next;
}

function parseStoredScreenshotSlotTitles(
  value: unknown
): Record<ScreenshotTemplateSlot, string> {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const next = {} as Record<ScreenshotTemplateSlot, string>;

  for (const slot of SCREENSHOT_TEMPLATE_SLOTS) {
    next[slot] = toOptionalString(raw[String(slot)]) ?? "";
  }

  return next;
}

function parseStoredScreenshotSlotTitleTypography(
  store: ScreenshotStore,
  value: unknown
): Record<ScreenshotTemplateSlot, ScreenshotTitleTypography> {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const next = {} as Record<ScreenshotTemplateSlot, ScreenshotTitleTypography>;

  for (const slot of SCREENSHOT_TEMPLATE_SLOTS) {
    const entry = raw[String(slot)];
    const record = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : undefined;
    next[slot] = resolveScreenshotTitleTypography(store, slot, {
      fontFamily: toOptionalString(record?.fontFamily),
      fontSize: toOptionalNumber(record?.fontSize),
      fontWeight: toOptionalNumber(record?.fontWeight),
    });
  }

  return next;
}
