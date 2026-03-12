export type Slot1SbeSettings = {
  lineWidth: number;
  lineColor: string;
  opacity: number;
  scale: number;
  angleDeg: number;
  copyCount: number;
  positionX: number;
  positionY: number;
  originX: number;
  originY: number;
  originZ: number;
};

export const SLOT_1_SBE_PATH_D =
  'M 246.2962962962963 415.2892561983471 C 279.4238683127572 474.7933884297521, 308.2304526748971 476.0330578512397, 384.5679012345679 479.75206611570246 C 460.9053497942387 483.4710743801653, 571.8106995884773 395.45454545454544, 630.8641975308642 425.20661157024796 C 689.9176954732511 454.9586776859505, 561.7283950617284 725.2066115702478, 744.6502057613169 728.9256198347107 C 927.5720164609054 732.6446280991735, 1035.574202674897 545.4545454545455, 1039.895190329218 464.8760330578512 C 1044.216177983539 384.29752066115697, 995.2674897119342 257.8512396694215, 856.9958847736626 256.61157024793386 C 718.724279835391 255.3719008264462, 707.201646090535 269.00826446280996, 602.0576131687243 269.00826446280996 C 496.9135802469136 269.00826446280996, 482.4821566358024 233.05785123966936, 355.73318544238685 241.73553719008265 C 228.98421424897128 250.413223140496, 213.1687242798354 355.78512396694214, 246.2962962962963 415.2892561983471 Z';

export const SLOT_1_SBE_ORIGIN = {
  x: 1044.216177983539,
  y: 482.85123966942143,
} as const;

export const DEFAULT_SLOT_1_SBE_SETTINGS: Slot1SbeSettings = {
  lineWidth: 4,
  lineColor: '#f38219',
  opacity: 0.7,
  scale: 0.82,
  angleDeg: 18,
  copyCount: 1,
  positionX: 1036,
  positionY: 1980,
  originX: SLOT_1_SBE_ORIGIN.x + 20,
  originY: SLOT_1_SBE_ORIGIN.y,
  originZ: 0,
};

export function resolveSlot1SbeSettings(
  value?: Partial<Slot1SbeSettings> | null
): Slot1SbeSettings {
  return {
    lineWidth: positiveFiniteNumber(Number(value?.lineWidth ?? DEFAULT_SLOT_1_SBE_SETTINGS.lineWidth), DEFAULT_SLOT_1_SBE_SETTINGS.lineWidth),
    lineColor: normalizeHexColor(value?.lineColor, DEFAULT_SLOT_1_SBE_SETTINGS.lineColor),
    opacity: opacityNumber(Number(value?.opacity ?? DEFAULT_SLOT_1_SBE_SETTINGS.opacity), DEFAULT_SLOT_1_SBE_SETTINGS.opacity),
    scale: positiveFiniteNumber(Number(value?.scale ?? DEFAULT_SLOT_1_SBE_SETTINGS.scale), DEFAULT_SLOT_1_SBE_SETTINGS.scale),
    angleDeg: finiteNumber(Number(value?.angleDeg ?? DEFAULT_SLOT_1_SBE_SETTINGS.angleDeg), DEFAULT_SLOT_1_SBE_SETTINGS.angleDeg),
    copyCount: integerAtLeastOne(Number(value?.copyCount ?? DEFAULT_SLOT_1_SBE_SETTINGS.copyCount), DEFAULT_SLOT_1_SBE_SETTINGS.copyCount),
    positionX: finiteNumber(Number(value?.positionX ?? DEFAULT_SLOT_1_SBE_SETTINGS.positionX), DEFAULT_SLOT_1_SBE_SETTINGS.positionX),
    positionY: finiteNumber(Number(value?.positionY ?? DEFAULT_SLOT_1_SBE_SETTINGS.positionY), DEFAULT_SLOT_1_SBE_SETTINGS.positionY),
    originX: finiteNumber(Number(value?.originX ?? DEFAULT_SLOT_1_SBE_SETTINGS.originX), DEFAULT_SLOT_1_SBE_SETTINGS.originX),
    originY: finiteNumber(Number(value?.originY ?? DEFAULT_SLOT_1_SBE_SETTINGS.originY), DEFAULT_SLOT_1_SBE_SETTINGS.originY),
    originZ: finiteNumber(Number(value?.originZ ?? DEFAULT_SLOT_1_SBE_SETTINGS.originZ), DEFAULT_SLOT_1_SBE_SETTINGS.originZ),
  };
}

function positiveFiniteNumber(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return value;
}

function finiteNumber(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return value;
}

function integerAtLeastOne(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.round(value));
}

function normalizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized : fallback;
}

function opacityNumber(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1, value));
}
