import type { IosScreenshotDeviceFamily, ScreenshotStore } from './screenshotStores.js';

export type ProceduralDeviceRotation = {
  rotateX: number;
  rotateY: number;
  rotateZ: number;
};

export type ProceduralDeviceLocation = {
  x: number;
  y: number;
  z: number;
};

export type ProceduralLightPosition = {
  x: number;
  y: number;
  z: number;
};

export type ProceduralKeyLightSettings = {
  azimuthDeg: number;
  elevationDeg: number;
  distance: number;
  intensity: number;
  color: string;
};

export type ProceduralDeviceShape = {
  widthMm: number;
  lengthMm: number;
  thicknessMm: number;
  edgeSmoothnessMm: number;
  islandWidthMm: number;
  islandLengthMm: number;
  islandRadiusMm: number;
};

export type ProceduralCameraMode = 'perspective' | 'orthographic';
export type ProceduralCameraSettings = {
  perspectiveFov: number;
  orthographicFrustumHeight: number;
};

export type IosHeroPhonePose = ProceduralDeviceRotation;
export type IosHeroPhoneShape = ProceduralDeviceShape;

export const DEFAULT_PROCEDURAL_DEVICE_ROTATION: ProceduralDeviceRotation = {
  rotateX: 224,
  rotateY: 215,
  rotateZ: 35,
};

export const DEFAULT_PROCEDURAL_DEVICE_LOCATION: ProceduralDeviceLocation = {
  x: 0,
  y: 0,
  z: 0,
};

export const DEFAULT_PROCEDURAL_DEVICE_SHAPE: ProceduralDeviceShape = {
  widthMm: 71.9,
  lengthMm: 150,
  thicknessMm: 8.75,
  edgeSmoothnessMm: 9,
  islandWidthMm: 23.1,
  islandLengthMm: 5.8,
  islandRadiusMm: 2.9,
};

export const DEFAULT_IPAD_PROCEDURAL_DEVICE_SHAPE: ProceduralDeviceShape = {
  ...DEFAULT_PROCEDURAL_DEVICE_SHAPE,
  widthMm: 177.5,
  lengthMm: 249.7,
  thicknessMm: 6.1,
};

export const DEFAULT_PLAY_STORE_PROCEDURAL_DEVICE_SHAPE: ProceduralDeviceShape = {
  ...DEFAULT_PROCEDURAL_DEVICE_SHAPE,
  widthMm: 72,
  lengthMm: 152.8,
  thicknessMm: 8.6,
};

export const DEFAULT_PROCEDURAL_CAMERA_MODE: ProceduralCameraMode = 'orthographic';
export const DEFAULT_PROCEDURAL_CAMERA_SETTINGS: ProceduralCameraSettings = {
  perspectiveFov: 34,
  orthographicFrustumHeight: 120,
};

export const DEFAULT_IPAD_PROCEDURAL_CAMERA_SETTINGS: ProceduralCameraSettings = {
  ...DEFAULT_PROCEDURAL_CAMERA_SETTINGS,
  orthographicFrustumHeight: 211,
};

export const DEFAULT_IPAD_TITLE_TOP_PADDING = 100;

export function getDefaultProceduralCameraSettings(
  iosDeviceFamily?: IosScreenshotDeviceFamily
): ProceduralCameraSettings {
  return iosDeviceFamily === 'ipad'
    ? { ...DEFAULT_IPAD_PROCEDURAL_CAMERA_SETTINGS }
    : { ...DEFAULT_PROCEDURAL_CAMERA_SETTINGS };
}

export function getDefaultTitleTopPadding(
  iosDeviceFamily?: IosScreenshotDeviceFamily
): number {
  return iosDeviceFamily === 'ipad' ? DEFAULT_IPAD_TITLE_TOP_PADDING : 0;
}

export function getDefaultCameraModeForSlot(slot: number): ProceduralCameraMode {
  void slot;
  return DEFAULT_PROCEDURAL_CAMERA_MODE;
}

export const PROCEDURAL_CAMERA_POSITION = {
  x: 0,
  y: 200,
  z: 0,
} as const;

export const DEFAULT_PROCEDURAL_KEY_LIGHT_POSITION: ProceduralLightPosition = {
  x: 28.678821817552304,
  y: 40.95760221444959,
  z: 0,
};

export const DEFAULT_PROCEDURAL_KEY_LIGHT_SETTINGS: ProceduralKeyLightSettings = {
  azimuthDeg: 35,
  elevationDeg: 0,
  distance: 50,
  intensity: 100,
  color: '#ffffff',
};

export const PROCEDURAL_CAMERA_UP = {
  x: 0,
  y: 0,
  z: 1,
} as const;

export const PROCEDURAL_DEVICE_BASE_ROTATION_X = -90;

export const DEFAULT_IOS_HERO_PHONE_POSE: IosHeroPhonePose = {
  rotateX: 48,
  rotateY: 335,
  rotateZ: 205,
};
export const DEFAULT_IOS_HERO_PHONE_LOCATION: ProceduralDeviceLocation = {
  x: -5,
  y: -38,
  z: 0,
};
export const DEFAULT_IOS_HERO_PHONE_SHAPE = DEFAULT_PROCEDURAL_DEVICE_SHAPE;

export function getDefaultProceduralDeviceShape(
  store: ScreenshotStore = 'ios',
  iosDeviceFamily?: IosScreenshotDeviceFamily
): ProceduralDeviceShape {
  if (store === 'play_store') return { ...DEFAULT_PLAY_STORE_PROCEDURAL_DEVICE_SHAPE };
  if (iosDeviceFamily === 'ipad') return { ...DEFAULT_IPAD_PROCEDURAL_DEVICE_SHAPE };
  return { ...DEFAULT_PROCEDURAL_DEVICE_SHAPE };
}

export function resolveProceduralDeviceRotation(
  value?: Partial<ProceduralDeviceRotation> | null
): ProceduralDeviceRotation {
  return {
    rotateX: normalizeDegrees360(Number(value?.rotateX ?? DEFAULT_PROCEDURAL_DEVICE_ROTATION.rotateX)),
    rotateY: normalizeDegrees360(Number(value?.rotateY ?? DEFAULT_PROCEDURAL_DEVICE_ROTATION.rotateY)),
    rotateZ: normalizeDegrees360(Number(value?.rotateZ ?? DEFAULT_PROCEDURAL_DEVICE_ROTATION.rotateZ)),
  };
}

export function resolveProceduralDeviceLocation(
  value?: Partial<ProceduralDeviceLocation> | null
): ProceduralDeviceLocation {
  return {
    x: clampFiniteNumber(Number(value?.x ?? DEFAULT_PROCEDURAL_DEVICE_LOCATION.x), -400, 400),
    y: clampFiniteNumber(Number(value?.y ?? DEFAULT_PROCEDURAL_DEVICE_LOCATION.y), -400, 400),
    z: clampFiniteNumber(Number(value?.z ?? DEFAULT_PROCEDURAL_DEVICE_LOCATION.z), -400, 400),
  };
}

export function resolveProceduralLightPosition(
  value?: Partial<ProceduralLightPosition> | null
): ProceduralLightPosition {
  return {
    x: clampFiniteNumber(Number(value?.x ?? DEFAULT_PROCEDURAL_KEY_LIGHT_POSITION.x), -4000, 4000),
    y: clampFiniteNumber(Number(value?.y ?? DEFAULT_PROCEDURAL_KEY_LIGHT_POSITION.y), -4000, 4000),
    z: clampFiniteNumber(Number(value?.z ?? DEFAULT_PROCEDURAL_KEY_LIGHT_POSITION.z), -4000, 4000),
  };
}

export function resolveProceduralKeyLightSettings(
  value?: Partial<ProceduralKeyLightSettings> | null,
  fallbackPosition?: Partial<ProceduralLightPosition> | null
): ProceduralKeyLightSettings {
  const derivedFromPosition =
    fallbackPosition != null ? proceduralKeyLightSettingsFromPosition(fallbackPosition) : null;

  return {
    azimuthDeg: clampFiniteNumber(
      Number(value?.azimuthDeg ?? derivedFromPosition?.azimuthDeg ?? DEFAULT_PROCEDURAL_KEY_LIGHT_SETTINGS.azimuthDeg),
      -3600,
      3600
    ),
    elevationDeg: clampFiniteNumber(
      Number(value?.elevationDeg ?? derivedFromPosition?.elevationDeg ?? DEFAULT_PROCEDURAL_KEY_LIGHT_SETTINGS.elevationDeg),
      -89.9,
      89.9
    ),
    distance: positiveFiniteNumber(
      Number(value?.distance ?? derivedFromPosition?.distance ?? DEFAULT_PROCEDURAL_KEY_LIGHT_SETTINGS.distance),
      DEFAULT_PROCEDURAL_KEY_LIGHT_SETTINGS.distance
    ),
    intensity: nonNegativeFiniteNumber(
      Number(value?.intensity ?? DEFAULT_PROCEDURAL_KEY_LIGHT_SETTINGS.intensity),
      DEFAULT_PROCEDURAL_KEY_LIGHT_SETTINGS.intensity
    ),
    color: normalizeHexColor(value?.color, DEFAULT_PROCEDURAL_KEY_LIGHT_SETTINGS.color),
  };
}

export function proceduralKeyLightPositionFromSettings(
  value?: Partial<ProceduralKeyLightSettings> | null
): ProceduralLightPosition {
  const settings = resolveProceduralKeyLightSettings(value);
  const azimuth = degToRad(settings.azimuthDeg);
  const elevation = degToRad(settings.elevationDeg);
  const planarDistance = settings.distance * Math.cos(elevation);

  return {
    x: planarDistance * Math.sin(azimuth),
    y: planarDistance * Math.cos(azimuth),
    z: settings.distance * Math.sin(elevation),
  };
}

export function proceduralKeyLightSettingsFromPosition(
  value?: Partial<ProceduralLightPosition> | null
): ProceduralKeyLightSettings {
  const position = resolveProceduralLightPosition(value);
  const distance = Math.sqrt(
    position.x * position.x + position.y * position.y + position.z * position.z
  );
  const safeDistance = distance > 0 ? distance : DEFAULT_PROCEDURAL_KEY_LIGHT_SETTINGS.distance;
  const elevationDeg = radToDeg(Math.asin(position.z / safeDistance));
  const azimuthDeg = radToDeg(Math.atan2(position.x, position.y));

  return {
    ...DEFAULT_PROCEDURAL_KEY_LIGHT_SETTINGS,
    azimuthDeg,
    elevationDeg,
    distance: safeDistance,
  };
}

export function resolveProceduralDeviceShape(
  value?: (
    Partial<ProceduralDeviceShape> & {
      width?: number | null;
      height?: number | null;
      length?: number | null;
      depth?: number | null;
      thickness?: number | null;
      edgeRadius?: number | null;
      edgeSmoothness?: number | null;
      islandWidth?: number | null;
      islandLength?: number | null;
      islandRadius?: number | null;
    }
  ) | null
): ProceduralDeviceShape {
  return resolveProceduralDeviceShapeForStore('ios', value);
}

export function resolveProceduralDeviceShapeForStore(
  store: ScreenshotStore,
  value?: (
    Partial<ProceduralDeviceShape> & {
      width?: number | null;
      height?: number | null;
      length?: number | null;
      depth?: number | null;
      thickness?: number | null;
      edgeRadius?: number | null;
      edgeSmoothness?: number | null;
      islandWidth?: number | null;
      islandLength?: number | null;
      islandRadius?: number | null;
    }
  ) | null,
  iosDeviceFamily?: IosScreenshotDeviceFamily
): ProceduralDeviceShape {
  const defaults = getDefaultProceduralDeviceShape(store, iosDeviceFamily);
  const hasNewMmShapeFields =
    value != null &&
    typeof value === 'object' &&
    ('widthMm' in value ||
      'lengthMm' in value ||
      'thicknessMm' in value ||
      'edgeSmoothnessMm' in value ||
      'islandWidthMm' in value ||
      'islandLengthMm' in value ||
      'islandRadiusMm' in value);
  const hasLegacyShapeFields =
    value != null &&
    typeof value === 'object' &&
    ('width' in value ||
      'height' in value ||
      'length' in value ||
      'depth' in value ||
      'thickness' in value ||
      'edgeRadius' in value ||
      'edgeSmoothness' in value ||
      'islandWidth' in value ||
      'islandLength' in value ||
      'islandRadius' in value);

  // Old screenshot presets stored large canvas-space dimensions.
  // When those records are read back into the new mm-based procedural model,
  // the correct behavior is to fall back to the shared defaults instead of
  // treating those legacy numbers as millimeters.
  if (!hasNewMmShapeFields && hasLegacyShapeFields) {
    return { ...defaults };
  }

  return {
    widthMm: positiveFiniteNumber(
      Number(value?.widthMm ?? value?.width ?? defaults.widthMm),
      defaults.widthMm
    ),
    lengthMm: positiveFiniteNumber(
      Number(
        value?.lengthMm ??
          value?.length ??
          value?.height ??
          defaults.lengthMm
      ),
      defaults.lengthMm
    ),
    thicknessMm: nonNegativeFiniteNumber(
      Number(
        value?.thicknessMm ??
          value?.thickness ??
          value?.depth ??
          defaults.thicknessMm
      ),
      defaults.thicknessMm
    ),
    edgeSmoothnessMm: nonNegativeFiniteNumber(
      Number(
        value?.edgeSmoothnessMm ??
          value?.edgeSmoothness ??
          value?.edgeRadius ??
          defaults.edgeSmoothnessMm
      ),
      defaults.edgeSmoothnessMm
    ),
    islandWidthMm: positiveFiniteNumber(
      Number(
        value?.islandWidthMm ??
          value?.islandWidth ??
          defaults.islandWidthMm
      ),
      defaults.islandWidthMm
    ),
    islandLengthMm: positiveFiniteNumber(
      Number(
        value?.islandLengthMm ??
          value?.islandLength ??
          defaults.islandLengthMm
      ),
      defaults.islandLengthMm
    ),
    islandRadiusMm: nonNegativeFiniteNumber(
      Number(
        value?.islandRadiusMm ??
          value?.islandRadius ??
          defaults.islandRadiusMm
      ),
      defaults.islandRadiusMm
    ),
  };
}

export function resolveProceduralCameraMode(value?: unknown): ProceduralCameraMode {
  if (value === 'perspective') return 'perspective';
  if (value === 'orthographic') return 'orthographic';
  return DEFAULT_PROCEDURAL_CAMERA_MODE;
}

export function resolveProceduralCameraSettings(
  value?: Partial<ProceduralCameraSettings> | null
): ProceduralCameraSettings {
  return {
    perspectiveFov: positiveFiniteNumber(
      Number(value?.perspectiveFov ?? DEFAULT_PROCEDURAL_CAMERA_SETTINGS.perspectiveFov),
      DEFAULT_PROCEDURAL_CAMERA_SETTINGS.perspectiveFov
    ),
    orthographicFrustumHeight: positiveFiniteNumber(
      Number(
        value?.orthographicFrustumHeight ??
          DEFAULT_PROCEDURAL_CAMERA_SETTINGS.orthographicFrustumHeight
      ),
      DEFAULT_PROCEDURAL_CAMERA_SETTINGS.orthographicFrustumHeight
    ),
  };
}

export function resolveIosHeroPhonePose(
  value?: Partial<IosHeroPhonePose> | null
): IosHeroPhonePose {
  return {
    rotateX: normalizeDegrees360(Number(value?.rotateX ?? DEFAULT_IOS_HERO_PHONE_POSE.rotateX)),
    rotateY: normalizeDegrees360(Number(value?.rotateY ?? DEFAULT_IOS_HERO_PHONE_POSE.rotateY)),
    rotateZ: normalizeDegrees360(Number(value?.rotateZ ?? DEFAULT_IOS_HERO_PHONE_POSE.rotateZ)),
  };
}

export function resolveIosHeroPhoneLocation(
  value?: Partial<ProceduralDeviceLocation> | null
): ProceduralDeviceLocation {
  return {
    x: clampFiniteNumber(Number(value?.x ?? DEFAULT_IOS_HERO_PHONE_LOCATION.x), -400, 400),
    y: clampFiniteNumber(Number(value?.y ?? DEFAULT_IOS_HERO_PHONE_LOCATION.y), -400, 400),
    z: clampFiniteNumber(Number(value?.z ?? DEFAULT_IOS_HERO_PHONE_LOCATION.z), -400, 400),
  };
}

export function resolveIosHeroPhoneShape(
  value?: (
    Partial<IosHeroPhoneShape> & {
      width?: number | null;
      height?: number | null;
      length?: number | null;
      depth?: number | null;
      thickness?: number | null;
      edgeRadius?: number | null;
      edgeSmoothness?: number | null;
      islandWidth?: number | null;
      islandLength?: number | null;
      islandRadius?: number | null;
    }
  ) | null
): IosHeroPhoneShape {
  return resolveProceduralDeviceShape(value);
}

function clampFiniteNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function positiveFiniteNumber(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return value;
}

function nonNegativeFiniteNumber(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value < 0) return fallback;
  return value;
}

function normalizeDegrees360(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function normalizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized : fallback;
}

function degToRad(value: number): number {
  return (value * Math.PI) / 180;
}

function radToDeg(value: number): number {
  return (value * 180) / Math.PI;
}
