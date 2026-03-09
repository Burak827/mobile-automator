export const IOS_HERO_DEVICE_SCENE_WIDTH = 2568;
export const IOS_HERO_DEVICE_SCENE_HEIGHT = 2778;

export const IOS_HERO_DEVICE_MATRIX = {
  a: 0.813,
  b: 0.22,
  c: 0.303,
  d: 0.967,
  e: 620,
  f: 380,
} as const;

export const IOS_HERO_DEVICE_SCREEN_RECT = {
  x: 34,
  y: 34,
  width: 842,
  height: 1844,
  radius: 116,
} as const;

export type HeroPlane = {
  tl: { x: number; y: number };
  tr: { x: number; y: number };
  br: { x: number; y: number };
  bl: { x: number; y: number };
};

export function getIosHeroDeviceScreenPlane(): HeroPlane {
  const screen = IOS_HERO_DEVICE_SCREEN_RECT;
  return {
    tl: applyMatrix(screen.x, screen.y),
    tr: applyMatrix(screen.x + screen.width, screen.y),
    br: applyMatrix(screen.x + screen.width, screen.y + screen.height),
    bl: applyMatrix(screen.x, screen.y + screen.height),
  };
}

function applyMatrix(x: number, y: number): { x: number; y: number } {
  const matrix = IOS_HERO_DEVICE_MATRIX;
  return {
    x: matrix.a * x + matrix.c * y + matrix.e,
    y: matrix.b * x + matrix.d * y + matrix.f,
  };
}
