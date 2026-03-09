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

export type ProceduralDeviceShape = {
  widthMm: number;
  lengthMm: number;
  thicknessMm: number;
  edgeSmoothnessMm: number;
};

export type ProceduralCameraMode = 'perspective' | 'orthographic';

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
};

export const DEFAULT_PROCEDURAL_CAMERA_MODE: ProceduralCameraMode = 'perspective';

export function getDefaultCameraModeForSlot(slot: number): ProceduralCameraMode {
  return slot <= 2 ? 'perspective' : 'orthographic';
}

export const PROCEDURAL_CAMERA_POSITION = {
  x: 0,
  y: 200,
  z: 0,
} as const;

export const PROCEDURAL_CAMERA_UP = {
  x: 0,
  y: 0,
  z: 1,
} as const;

export const PROCEDURAL_DEVICE_BASE_ROTATION_X = -90;

export const DEFAULT_IOS_HERO_PHONE_POSE: IosHeroPhonePose = {
  rotateX: 42,
  rotateY: 330,
  rotateZ: 209,
};
export const DEFAULT_IOS_HERO_PHONE_LOCATION: ProceduralDeviceLocation = {
  x: -5,
  y: -38,
  z: 0,
};
export const DEFAULT_IOS_HERO_PHONE_SHAPE = DEFAULT_PROCEDURAL_DEVICE_SHAPE;

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
    }
  ) | null
): ProceduralDeviceShape {
  const hasNewMmShapeFields =
    value != null &&
    typeof value === 'object' &&
    ('widthMm' in value ||
      'lengthMm' in value ||
      'thicknessMm' in value ||
      'edgeSmoothnessMm' in value);
  const hasLegacyShapeFields =
    value != null &&
    typeof value === 'object' &&
    ('width' in value ||
      'height' in value ||
      'length' in value ||
      'depth' in value ||
      'thickness' in value ||
      'edgeRadius' in value ||
      'edgeSmoothness' in value);

  // Old screenshot presets stored large canvas-space dimensions.
  // When those records are read back into the new mm-based procedural model,
  // the correct behavior is to fall back to the shared defaults instead of
  // treating those legacy numbers as millimeters.
  if (!hasNewMmShapeFields && hasLegacyShapeFields) {
    return { ...DEFAULT_PROCEDURAL_DEVICE_SHAPE };
  }

  return {
    widthMm: positiveFiniteNumber(
      Number(value?.widthMm ?? value?.width ?? DEFAULT_PROCEDURAL_DEVICE_SHAPE.widthMm),
      DEFAULT_PROCEDURAL_DEVICE_SHAPE.widthMm
    ),
    lengthMm: positiveFiniteNumber(
      Number(
        value?.lengthMm ??
          value?.length ??
          value?.height ??
          DEFAULT_PROCEDURAL_DEVICE_SHAPE.lengthMm
      ),
      DEFAULT_PROCEDURAL_DEVICE_SHAPE.lengthMm
    ),
    thicknessMm: nonNegativeFiniteNumber(
      Number(
        value?.thicknessMm ??
          value?.thickness ??
          value?.depth ??
          DEFAULT_PROCEDURAL_DEVICE_SHAPE.thicknessMm
      ),
      DEFAULT_PROCEDURAL_DEVICE_SHAPE.thicknessMm
    ),
    edgeSmoothnessMm: nonNegativeFiniteNumber(
      Number(
        value?.edgeSmoothnessMm ??
          value?.edgeSmoothness ??
          value?.edgeRadius ??
          DEFAULT_PROCEDURAL_DEVICE_SHAPE.edgeSmoothnessMm
      ),
      DEFAULT_PROCEDURAL_DEVICE_SHAPE.edgeSmoothnessMm
    ),
  };
}

export function resolveProceduralCameraMode(value?: unknown): ProceduralCameraMode {
  return value === 'orthographic' ? 'orthographic' : DEFAULT_PROCEDURAL_CAMERA_MODE;
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
