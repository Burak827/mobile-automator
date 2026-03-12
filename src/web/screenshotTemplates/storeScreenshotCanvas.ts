import {
  getScreenshotTemplateCanvasSize,
  resolveScreenshotTemplatePalette,
  type ScreenshotTemplatePalette,
  type ScreenshotTemplateSlot,
} from './storeScreenshotTemplateRegistry.js';
import {
  getIosHeroDeviceScreenPlane,
  IOS_HERO_DEVICE_SCENE_HEIGHT,
  IOS_HERO_DEVICE_SCENE_WIDTH,
  IOS_HERO_DEVICE_SCREEN_RECT,
} from './iosHeroDeviceAsset.js';
import {
  DEFAULT_IOS_HERO_PHONE_POSE,
  resolveIosHeroPhonePose,
  resolveIosHeroPhoneShape,
  type IosHeroPhonePose,
  type IosHeroPhoneShape,
} from './proceduralDeviceConfig.js';
import {
  resolveScreenshotTitleTypography,
  type ScreenshotTitleTypography,
} from './screenshotTitleTypography.js';
import { resolveScreenshotTitleLineColors } from './screenshotTitleColors.js';
import {
  SLOT_1_SBE_ORIGIN,
  SLOT_1_SBE_PATH_D,
  resolveSlot1SbeSettings,
  type Slot1SbeSettings,
} from './slot1Sbe.js';
import type { ScreenshotStore } from './screenshotStores.js';

export type ScreenshotCanvasImageSource = string | Uint8Array | null | undefined;
export type ScreenshotCanvasImageLoader = (
  source: string | Uint8Array
) => Promise<any>;

export const IOS_HERO_SPLIT_SCENE_WIDTH_MULTIPLIER = 2;
export const IOS_HERO_SLOT_2_SCENE_OFFSET_Y = 0;
export const IOS_HERO_SPLIT_SEAM_GAP_PX = 80;

export const ANDROID_SCREEN_REFERENCE_WIDTH = 1080;
export const ANDROID_SCREEN_REFERENCE_HEIGHT = 2400;
const IOS_TITLE_BLOCK_X = 88;
const IOS_TITLE_BLOCK_Y = 146;
const PLAY_STORE_TITLE_BLOCK_X = 76;
const PLAY_STORE_TITLE_BLOCK_Y = 114;
const IOS_TITLE_LINE_HEIGHT_MULTIPLIER = 0.95;
const PLAY_STORE_TITLE_LINE_HEIGHT_MULTIPLIER = 0.94;

export type StoreScreenshotCanvasInput = {
  store: ScreenshotStore;
  slot: ScreenshotTemplateSlot;
  title: string;
  titleTypography?: Partial<ScreenshotTitleTypography> | null;
  titleExtraLineColors?: string[];
  titleLineGap?: number | null;
  palette?: Partial<ScreenshotTemplatePalette> | null;
  screenshotSource?: ScreenshotCanvasImageSource;
  iosHeroOverlaySource?: string | null;
  heroPhonePose?: Partial<IosHeroPhonePose> | null;
  heroPhoneShape?: Partial<IosHeroPhoneShape> | null;
  slot1SbeSettings?: Partial<Slot1SbeSettings> | null;
};

const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif';

export async function drawStoreScreenshotToContext(
  ctx: any,
  loadImage: ScreenshotCanvasImageLoader,
  input: StoreScreenshotCanvasInput
): Promise<{ width: number; height: number; palette: ScreenshotTemplatePalette }> {
  const canvasSize = getScreenshotTemplateCanvasSize(input.store);
  const palette = resolveScreenshotTemplatePalette(input.store, input.palette);
  const titleLines = buildTitleLines(input.slot, input.title);
  const titleTypography = resolveScreenshotTitleTypography(
    input.store,
    input.slot,
    input.titleTypography
  );
  const titleLineColors = resolveScreenshotTitleLineColors(
    input.store,
    input.slot,
    palette,
    titleLines.length,
    input.titleExtraLineColors
  );
  const screenshotImage = input.screenshotSource
    ? await loadImage(input.screenshotSource)
    : null;
  const iosHeroOverlayImage =
    input.store === 'ios' && (input.slot === 1 || input.slot === 2) && input.iosHeroOverlaySource
      ? await loadImage(input.iosHeroOverlaySource)
      : null;

  clearFrame(ctx, canvasSize.width, canvasSize.height);

  if (input.store === 'ios') {
    drawIosFrame(ctx, {
      slot: input.slot,
      titleLines,
      titleTypography,
      titleLineColors,
      titleLineGap: input.titleLineGap,
      palette,
      screenshotImage,
      iosHeroOverlayImage,
      heroPhonePose: input.heroPhonePose,
      heroPhoneShape: input.heroPhoneShape,
      slot1SbeSettings: input.slot1SbeSettings,
      width: canvasSize.width,
      height: canvasSize.height,
    });
  } else {
    drawPlayStoreFrame(ctx, {
      slot: input.slot,
      titleLines,
      titleTypography,
      titleLineColors,
      titleLineGap: input.titleLineGap,
      palette,
      screenshotImage,
      heroPhonePose: input.heroPhonePose,
      heroPhoneShape: input.heroPhoneShape,
      width: canvasSize.width,
      height: canvasSize.height,
    });
  }

  return {
    width: canvasSize.width,
    height: canvasSize.height,
    palette,
  };
}

function drawIosFrame(
  ctx: any,
  input: {
    slot: ScreenshotTemplateSlot;
    titleLines: string[];
    titleTypography: ScreenshotTitleTypography;
    titleLineColors: string[];
    titleLineGap?: number | null;
    palette: ScreenshotTemplatePalette;
    screenshotImage: any;
    iosHeroOverlayImage: any;
    heroPhonePose?: Partial<IosHeroPhonePose> | null;
    heroPhoneShape?: Partial<IosHeroPhoneShape> | null;
    slot1SbeSettings?: Partial<Slot1SbeSettings> | null;
    width: number;
    height: number;
  }
): void {
  if (input.slot === 1 || input.slot === 2) {
    drawIosSplitHero(ctx, input as typeof input & { slot: 1 | 2 });
    return;
  }

  drawIosPoster(ctx, input as typeof input & { slot: 3 | 4 | 5 | 6 });
}

function drawIosSplitHero(
  ctx: any,
  input: {
    slot: 1 | 2;
    titleLines: string[];
    titleTypography: ScreenshotTitleTypography;
    titleLineColors: string[];
    titleLineGap?: number | null;
    palette: ScreenshotTemplatePalette;
    screenshotImage: any;
    iosHeroOverlayImage: any;
    heroPhonePose?: Partial<IosHeroPhonePose> | null;
    heroPhoneShape?: Partial<IosHeroPhoneShape> | null;
    slot1SbeSettings?: Partial<Slot1SbeSettings> | null;
    width: number;
    height: number;
  }
): void {
  drawIosSplitHeroBackdrop(ctx, {
    slot: input.slot,
    titleLines: input.titleLines,
    titleTypography: input.titleTypography,
    titleLineColors: input.titleLineColors,
    titleLineGap: input.titleLineGap,
    palette: input.palette,
    slot1SbeSettings: input.slot1SbeSettings,
    width: input.width,
    height: input.height,
  });

  const sceneWidth =
    input.width * IOS_HERO_SPLIT_SCENE_WIDTH_MULTIPLIER + IOS_HERO_SPLIT_SEAM_GAP_PX;
  const sceneOffsetX = input.slot === 1 ? 0 : input.width + IOS_HERO_SPLIT_SEAM_GAP_PX;
  const sceneOffsetY = input.slot === 2 ? IOS_HERO_SLOT_2_SCENE_OFFSET_Y : 0;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, input.width, input.height);
  ctx.clip();
  ctx.translate(-sceneOffsetX, sceneOffsetY);

  drawIosSplitHeroSharedDecor(ctx, {
    palette: input.palette,
    sceneWidth,
    height: input.height,
  });

  drawIosHeroDeviceScene(
    ctx,
    input.screenshotImage,
    input.iosHeroOverlayImage,
    resolveIosHeroPhonePose(input.heroPhonePose)
  );

  ctx.restore();
}

export function drawIosSplitHeroBackdrop(
  ctx: any,
  input: {
    slot: 1 | 2;
    titleLines: string[];
    titleTypography: ScreenshotTitleTypography;
    titleLineColors: string[];
    titleLineGap?: number | null;
    palette: ScreenshotTemplatePalette;
    slot1SbeSettings?: Partial<Slot1SbeSettings> | null;
    width: number;
    height: number;
  }
): void {
  const { palette, width, height } = input;
  const background = ctx.createLinearGradient(0, 0, 0, height);
  background.addColorStop(0, '#f8f4ee');
  background.addColorStop(1, '#efe9e2');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  if (input.slot === 1 || input.slot === 2) {
    drawSlot1SbeEffect(ctx, input.slot1SbeSettings);
  }

  drawTitleBlock(ctx, {
    x: IOS_TITLE_BLOCK_X,
    y: IOS_TITLE_BLOCK_Y,
    lines: input.titleLines,
    fontFamily: input.titleTypography.fontFamily,
    fontSize: input.titleTypography.fontSize,
    lineHeight: getTitleLineHeight('ios', input.slot, input.titleTypography.fontSize),
    lineGap: resolveTitleLineGap(input.titleLineGap),
    weight: input.titleTypography.fontWeight,
    lineColors: input.titleLineColors,
    color: palette.bgInk,
    accentColor: input.slot === 1 ? palette.accent : undefined,
    accentFirstLine: input.slot === 1,
  });
}

export function drawIosSplitHeroSharedDecor(
  ctx: any,
  _input: {
    palette: ScreenshotTemplatePalette;
    sceneWidth: number;
    height: number;
  }
): void {
  drawSoftShadow(ctx, 1268, 1940, 450, 0.18);
}

function drawSlot1SbeEffect(ctx: any, input?: Partial<Slot1SbeSettings> | null): void {
  const settings = resolveSlot1SbeSettings(input);
  if (typeof Path2D === 'undefined') return;

  const curvePath = new Path2D(SLOT_1_SBE_PATH_D);

  ctx.save();
  ctx.strokeStyle = settings.lineColor;
  ctx.lineWidth = settings.lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = settings.opacity;

  for (let copyIndex = 0; copyIndex < settings.copyCount; copyIndex += 1) {
    ctx.save();
    ctx.translate(settings.positionX, settings.positionY);
    ctx.rotate((settings.angleDeg * copyIndex * Math.PI) / 180);
    ctx.scale(settings.scale, settings.scale);
    ctx.translate(-settings.originX, -settings.originY);
    ctx.stroke(curvePath);
    ctx.restore();
  }

  ctx.restore();
}

function drawIosPoster(
  ctx: any,
  input: {
    slot: 3 | 4 | 5 | 6;
    titleLines: string[];
    titleTypography: ScreenshotTitleTypography;
    titleLineColors: string[];
    titleLineGap?: number | null;
    palette: ScreenshotTemplatePalette;
    screenshotImage: any;
    heroPhoneShape?: Partial<IosHeroPhoneShape> | null;
    width: number;
    height: number;
  }
): void {
  drawIosPosterBackdrop(ctx, input);

  const phoneWidth = 992;
  const phoneInset = 22;
  const screenWidth = phoneWidth - phoneInset * 2;
  const screenHeight = Math.round(screenWidth * (input.height / input.width));
  const phoneHeight = screenHeight + phoneInset * 2;

  drawPosterPhone(ctx, {
    x: 146,
    y: 930,
    width: phoneWidth,
    height: phoneHeight,
    palette: input.palette,
    screenshotImage: input.screenshotImage,
    heroPhoneShape: input.heroPhoneShape,
    includeIsland: true,
  });
}

export function drawIosPosterBackdrop(
  ctx: any,
  input: {
    slot: 3 | 4 | 5 | 6;
    titleLines: string[];
    titleTypography: ScreenshotTitleTypography;
    titleLineColors: string[];
    titleLineGap?: number | null;
    palette: ScreenshotTemplatePalette;
    width: number;
    height: number;
  }
): void {
  const { palette, width, height } = input;
  ctx.fillStyle = palette.accent;
  ctx.fillRect(0, 0, width, height);

  drawTitleBlock(ctx, {
    x: IOS_TITLE_BLOCK_X,
    y: IOS_TITLE_BLOCK_Y,
    lines: input.titleLines,
    fontFamily: input.titleTypography.fontFamily,
    fontSize: input.titleTypography.fontSize,
    lineHeight: getTitleLineHeight('ios', input.slot, input.titleTypography.fontSize),
    lineGap: resolveTitleLineGap(input.titleLineGap),
    weight: input.titleTypography.fontWeight,
    lineColors: input.titleLineColors,
    color: palette.cream,
  });
}

function drawPlayStoreFrame(
  ctx: any,
  input: {
    slot: ScreenshotTemplateSlot;
    titleLines: string[];
    titleTypography: ScreenshotTitleTypography;
    titleLineColors: string[];
    titleLineGap?: number | null;
    palette: ScreenshotTemplatePalette;
    screenshotImage: any;
    heroPhonePose?: Partial<IosHeroPhonePose> | null;
    heroPhoneShape?: Partial<IosHeroPhoneShape> | null;
    width: number;
    height: number;
  }
): void {
  if (input.slot === 1 || input.slot === 2) {
    drawPlayStoreSplitHero(ctx, input as typeof input & { slot: 1 | 2 });
    return;
  }

  drawPlayStorePoster(ctx, input as typeof input & { slot: 3 | 4 | 5 | 6 });
}

function drawPlayStoreSplitHero(
  ctx: any,
  input: {
    slot: 1 | 2;
    titleLines: string[];
    titleTypography: ScreenshotTitleTypography;
    titleLineColors: string[];
    titleLineGap?: number | null;
    palette: ScreenshotTemplatePalette;
    screenshotImage: any;
    heroPhonePose?: Partial<IosHeroPhonePose> | null;
    slot1SbeSettings?: Partial<Slot1SbeSettings> | null;
    width: number;
    height: number;
  }
): void {
  drawPlayStoreSplitHeroBackdrop(ctx, {
    slot: input.slot,
    titleLines: input.titleLines,
    titleTypography: input.titleTypography,
    titleLineColors: input.titleLineColors,
    titleLineGap: input.titleLineGap,
    palette: input.palette,
    slot1SbeSettings: input.slot1SbeSettings,
    width: input.width,
    height: input.height,
  });

  const sceneWidth =
    input.width * IOS_HERO_SPLIT_SCENE_WIDTH_MULTIPLIER + IOS_HERO_SPLIT_SEAM_GAP_PX;
  const sceneOffsetX = input.slot === 1 ? 0 : input.width + IOS_HERO_SPLIT_SEAM_GAP_PX;
  const sceneOffsetY = input.slot === 2 ? IOS_HERO_SLOT_2_SCENE_OFFSET_Y : 0;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, input.width, input.height);
  ctx.clip();
  ctx.translate(-sceneOffsetX, sceneOffsetY);

  drawPlayStoreSplitHeroSharedDecor(ctx, {
    palette: input.palette,
    sceneWidth,
    height: input.height,
  });

  drawIosHeroDeviceScene(
    ctx,
    input.screenshotImage,
    null,
    resolveIosHeroPhonePose(input.heroPhonePose)
  );

  ctx.restore();
}

export function drawPlayStoreSplitHeroBackdrop(
  ctx: any,
  input: {
    slot: 1 | 2;
    titleLines: string[];
    titleTypography: ScreenshotTitleTypography;
    titleLineColors: string[];
    titleLineGap?: number | null;
    palette: ScreenshotTemplatePalette;
    slot1SbeSettings?: Partial<Slot1SbeSettings> | null;
    width: number;
    height: number;
  }
): void {
  const { palette, width, height } = input;
  const background = ctx.createLinearGradient(0, 0, 0, height);
  background.addColorStop(0, '#f8f4ee');
  background.addColorStop(1, '#efe9e2');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  if (input.slot === 1 || input.slot === 2) {
    drawSlot1SbeEffect(ctx, input.slot1SbeSettings);
  }

  drawTitleBlock(ctx, {
    x: PLAY_STORE_TITLE_BLOCK_X,
    y: PLAY_STORE_TITLE_BLOCK_Y,
    lines: input.titleLines,
    fontFamily: input.titleTypography.fontFamily,
    fontSize: input.titleTypography.fontSize,
    lineHeight: getTitleLineHeight('play_store', input.slot, input.titleTypography.fontSize),
    lineGap: resolveTitleLineGap(input.titleLineGap),
    weight: input.titleTypography.fontWeight,
    lineColors: input.titleLineColors,
    color: palette.bgInk,
    accentColor: input.slot === 1 ? palette.accent : undefined,
    accentFirstLine: input.slot === 1,
  });
}

export function drawPlayStoreSplitHeroSharedDecor(
  ctx: any,
  _input: {
    palette: ScreenshotTemplatePalette;
    sceneWidth: number;
    height: number;
  }
): void {
  drawSoftShadow(ctx, 1088, 1620, 380, 0.22);
}

function drawPlayStorePoster(
  ctx: any,
  input: {
    slot: 3 | 4 | 5 | 6;
    titleLines: string[];
    titleTypography: ScreenshotTitleTypography;
    titleLineColors: string[];
    titleLineGap?: number | null;
    palette: ScreenshotTemplatePalette;
    screenshotImage: any;
    width: number;
    height: number;
  }
): void {
  drawPlayStorePosterBackdrop(ctx, input);

  const phoneWidth = 816;
  const phoneInset = 22;
  const screenWidth = phoneWidth - phoneInset * 2;
  const screenHeight = Math.round(
    screenWidth * (ANDROID_SCREEN_REFERENCE_HEIGHT / ANDROID_SCREEN_REFERENCE_WIDTH)
  );
  const phoneHeight = screenHeight + phoneInset * 2;

  drawPosterPhone(ctx, {
    x: 132,
    y: 600,
    width: phoneWidth,
    height: phoneHeight,
    palette: input.palette,
    screenshotImage: input.screenshotImage,
    includeIsland: false,
  });
}

export function drawPlayStorePosterBackdrop(
  ctx: any,
  input: {
    slot: 3 | 4 | 5 | 6;
    titleLines: string[];
    titleTypography: ScreenshotTitleTypography;
    titleLineColors: string[];
    titleLineGap?: number | null;
    palette: ScreenshotTemplatePalette;
    width: number;
    height: number;
  }
): void {
  const { palette, width, height } = input;
  ctx.fillStyle = palette.accent;
  ctx.fillRect(0, 0, width, height);

  drawTitleBlock(ctx, {
    x: PLAY_STORE_TITLE_BLOCK_X,
    y: PLAY_STORE_TITLE_BLOCK_Y,
    lines: input.titleLines,
    fontFamily: input.titleTypography.fontFamily,
    fontSize: input.titleTypography.fontSize,
    lineHeight: getTitleLineHeight('play_store', input.slot, input.titleTypography.fontSize),
    lineGap: resolveTitleLineGap(input.titleLineGap),
    weight: input.titleTypography.fontWeight,
    lineColors: input.titleLineColors,
    color: palette.cream,
  });
}

function drawIosHeroDeviceScene(
  ctx: any,
  screenshotImage: any,
  overlayImage: any,
  heroPhonePose: IosHeroPhonePose
): void {
  const screenPlane = getIosHeroDeviceScreenPlane();
  const devicePivot = midpoint(screenPlane.tl, screenPlane.br);
  const poseTransform = createIosHeroAssetPoseTransform(heroPhonePose, devicePivot);
  const transformedScreenPlane = {
    tl: applyTransformToPoint(poseTransform, screenPlane.tl),
    tr: applyTransformToPoint(poseTransform, screenPlane.tr),
    br: applyTransformToPoint(poseTransform, screenPlane.br),
    bl: applyTransformToPoint(poseTransform, screenPlane.bl),
  };

  drawOnPlane(
    ctx,
    { tl: transformedScreenPlane.tl, tr: transformedScreenPlane.tr, bl: transformedScreenPlane.bl },
    IOS_HERO_DEVICE_SCREEN_RECT.width,
    IOS_HERO_DEVICE_SCREEN_RECT.height,
    () => {
      drawDeviceScreen(ctx, {
        x: 0,
        y: 0,
        width: IOS_HERO_DEVICE_SCREEN_RECT.width,
        height: IOS_HERO_DEVICE_SCREEN_RECT.height,
        radius: IOS_HERO_DEVICE_SCREEN_RECT.radius,
        background: '#f6f5f2',
        screenshotImage,
        placeholderColor: '#6c6c70',
        placeholderSubColor: '#8f8f93',
      });
    }
  );

  ctx.save();
  ctx.transform(
    poseTransform.a,
    poseTransform.b,
    poseTransform.c,
    poseTransform.d,
    poseTransform.e,
    poseTransform.f
  );
  if (overlayImage) {
    ctx.drawImage(overlayImage, 0, 0, IOS_HERO_DEVICE_SCENE_WIDTH, IOS_HERO_DEVICE_SCENE_HEIGHT);
  }
  ctx.restore();
}

function drawPosterPhone(
  ctx: any,
  input: {
    x: number;
    y: number;
    width: number;
    height: number;
    palette: ScreenshotTemplatePalette;
    screenshotImage: any;
    heroPhoneShape?: Partial<IosHeroPhoneShape> | null;
    includeIsland?: boolean;
  }
): void {
  const { x, y, width, height, palette, screenshotImage } = input;
  const resolvedShape = resolveIosHeroPhoneShape(input.heroPhoneShape);
  drawSoftShadow(ctx, x + width / 2, y + height / 2 + 50, width * 0.55, 0.12);

  const phoneRgb = hexToRgb(palette.phoneColor || '#000000');
  const shellGradient = ctx.createLinearGradient(x, y, x + width, y + height);
  shellGradient.addColorStop(0, rgba({ r: Math.min(255, phoneRgb.r + 40), g: Math.min(255, phoneRgb.g + 40), b: Math.min(255, phoneRgb.b + 40) }, 1));
  shellGradient.addColorStop(0.5, rgba({ r: Math.min(255, phoneRgb.r + 15), g: Math.min(255, phoneRgb.g + 15), b: Math.min(255, phoneRgb.b + 15) }, 1));
  shellGradient.addColorStop(1, rgba(phoneRgb, 1));
  fillRoundedRect(ctx, x, y, width, height, 118, shellGradient);

  strokeRoundedRect(ctx, x, y, width, height, 118, 'rgba(255,255,255,0.16)', 2);

  ctx.save();
  roundedRectPath(ctx, x, y, width, height, 118);
  ctx.clip();
  const bezelShadowTop = ctx.createLinearGradient(x, y, x, y + 24);
  bezelShadowTop.addColorStop(0, 'rgba(0,0,0,0.18)');
  bezelShadowTop.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bezelShadowTop;
  ctx.fillRect(x, y, width, 24);
  const bezelHighlight = ctx.createLinearGradient(x, y + height - 16, x, y + height);
  bezelHighlight.addColorStop(0, 'rgba(255,255,255,0)');
  bezelHighlight.addColorStop(1, 'rgba(255,255,255,0.06)');
  ctx.fillStyle = bezelHighlight;
  ctx.fillRect(x, y + height - 16, width, 16);
  ctx.restore();

  const screenX = x + 22;
  const screenY = y + 22;
  const screenWidth = width - 44;
  const screenHeight = height - 44;
  drawDeviceScreen(ctx, {
    x: screenX,
    y: screenY,
    width: screenWidth,
    height: screenHeight,
    radius: 102,
    background: palette.cream,
    screenshotImage,
    placeholderColor: '#6b6b6d',
    placeholderSubColor: '#8a8a8d',
  });

  if (input.includeIsland) {
    const screenWidthMm = Math.max(1, resolvedShape.widthMm - 4);
    const screenLengthMm = Math.max(1, resolvedShape.lengthMm - 4);
    const islandWidth = Math.max(
      1,
      Math.min(screenWidth, screenWidth * (resolvedShape.islandWidthMm / screenWidthMm))
    );
    const islandLength = Math.max(
      1,
      Math.min(screenHeight, screenHeight * (resolvedShape.islandLengthMm / screenLengthMm))
    );
    const islandRadius = Math.max(
      0,
      Math.min(
        islandWidth / 2,
        islandLength / 2,
        screenWidth * (resolvedShape.islandRadiusMm / screenWidthMm)
      )
    );
    const islandX = screenX + (screenWidth - islandWidth) / 2;
    const islandY = screenY + islandLength * 0.3;
    fillRoundedRect(ctx, islandX, islandY, islandWidth, islandLength, islandRadius, '#06080b');
  }
}


function drawDeviceScreen(
  ctx: any,
  input: {
    x: number;
    y: number;
    width: number;
    height: number;
    radius: number;
    background: string;
    screenshotImage: any;
    placeholderColor: string;
    placeholderSubColor: string;
  }
): void {
  fillRoundedRect(ctx, input.x, input.y, input.width, input.height, input.radius, input.background);

  ctx.save();
  roundedRectPath(ctx, input.x, input.y, input.width, input.height, input.radius);
  ctx.clip();

  if (input.screenshotImage) {
    const cover = coverRect(
      imageSize(input.screenshotImage).width,
      imageSize(input.screenshotImage).height,
      input.width,
      input.height
    );
    ctx.drawImage(
      input.screenshotImage,
      input.x + cover.offsetX,
      input.y + cover.offsetY,
      cover.drawWidth,
      cover.drawHeight
    );
  } else {
    drawPlaceholderScreen(ctx, input);
  }

  const gloss = ctx.createLinearGradient(input.x, input.y, input.x, input.y + input.height * 0.22);
  gloss.addColorStop(0, 'rgba(255,255,255,0.16)');
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gloss;
  ctx.fillRect(input.x, input.y, input.width, input.height * 0.22);
  ctx.restore();
}

function drawPlaceholderScreen(
  ctx: any,
  input: {
    x: number;
    y: number;
    width: number;
    height: number;
    placeholderColor: string;
    placeholderSubColor: string;
  }
): void {
  ctx.fillStyle = input.placeholderColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.round(input.width * 0.086)}px ${FONT_STACK}`;
  ctx.fillText('Replace me', input.x + input.width / 2, input.y + input.height * 0.47);

  ctx.fillStyle = input.placeholderSubColor;
  ctx.font = `500 ${Math.round(input.width * 0.038)}px ${FONT_STACK}`;
  ctx.fillText('(follow the “How to use”', input.x + input.width / 2, input.y + input.height * 0.54);
  ctx.fillText('instructions)', input.x + input.width / 2, input.y + input.height * 0.59);
}

function drawTitleBlock(
  ctx: any,
  input: {
    x: number;
    y: number;
    lines: string[];
    fontFamily: string;
    fontSize: number;
    lineHeight: number;
    lineGap?: number;
    weight: number;
    lineColors?: string[];
    color: string;
    accentColor?: string;
    accentFirstLine?: boolean;
  }
): void {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = `${input.weight} ${input.fontSize}px ${composeFontStack(input.fontFamily)}`;
  for (const [index, line] of input.lines.entries()) {
    ctx.fillStyle =
      input.lineColors?.[index] ??
      (input.accentFirstLine && index === 0 && input.accentColor ? input.accentColor : input.color);
    ctx.fillText(line, input.x, input.y + index * (input.lineHeight + (input.lineGap ?? 0)));
  }
}

function drawSoftShadow(
  ctx: any,
  x: number,
  y: number,
  radius: number,
  alpha: number,
  yStretch = 0,
  alreadyTranslated = false
): void {
  ctx.save();
  if (!alreadyTranslated) {
    ctx.translate(x, y + yStretch);
  }
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  gradient.addColorStop(0, `rgba(0,0,0,${alpha})`);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(0, 0, radius, radius * 0.74, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function coverRect(
  imageWidth: number,
  imageHeight: number,
  frameWidth: number,
  frameHeight: number
): { drawWidth: number; drawHeight: number; offsetX: number; offsetY: number } {
  const scale = Math.max(frameWidth / imageWidth, frameHeight / imageHeight);
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;
  return {
    drawWidth,
    drawHeight,
    offsetX: (frameWidth - drawWidth) / 2,
    offsetY: (frameHeight - drawHeight) / 2,
  };
}

function clearFrame(ctx: any, width: number, height: number): void {
  ctx.clearRect(0, 0, width, height);
}

function fillRoundedRect(
  ctx: any,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string
): void {
  ctx.save();
  roundedRectPath(ctx, x, y, width, height, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

function strokeRoundedRect(
  ctx: any,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  stroke: string,
  lineWidth: number
): void {
  ctx.save();
  roundedRectPath(ctx, x, y, width, height, radius);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  ctx.restore();
}

function drawOnPlane(
  ctx: any,
  plane: { tl: { x: number; y: number }; tr: { x: number; y: number }; bl: { x: number; y: number } },
  width: number,
  height: number,
  draw: () => void
): void {
  ctx.save();
  ctx.transform(
    (plane.tr.x - plane.tl.x) / width,
    (plane.tr.y - plane.tl.y) / width,
    (plane.bl.x - plane.tl.x) / height,
    (plane.bl.y - plane.tl.y) / height,
    plane.tl.x,
    plane.tl.y
  );
  draw();
  ctx.restore();
}

type Transform2D = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
};

function midpoint(
  left: { x: number; y: number },
  right: { x: number; y: number }
): { x: number; y: number } {
  return {
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2,
  };
}

function identityTransform2D(): Transform2D {
  return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
}

function translateTransform2D(x: number, y: number): Transform2D {
  return { a: 1, b: 0, c: 0, d: 1, e: x, f: y };
}

function rotateTransform2D(radians: number): Transform2D {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    a: cos,
    b: sin,
    c: -sin,
    d: cos,
    e: 0,
    f: 0,
  };
}

function scaleTransform2D(x: number, y: number): Transform2D {
  return { a: x, b: 0, c: 0, d: y, e: 0, f: 0 };
}

function skewTransform2D(x: number, y: number): Transform2D {
  return { a: 1, b: y, c: x, d: 1, e: 0, f: 0 };
}

function multiplyTransform2D(left: Transform2D, right: Transform2D): Transform2D {
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    e: left.a * right.e + left.c * right.f + left.e,
    f: left.b * right.e + left.d * right.f + left.f,
  };
}

function applyTransformToPoint(
  transform: Transform2D,
  point: { x: number; y: number }
): { x: number; y: number } {
  return {
    x: transform.a * point.x + transform.c * point.y + transform.e,
    y: transform.b * point.x + transform.d * point.y + transform.f,
  };
}

function createIosHeroAssetPoseTransform(
  heroPhonePose: IosHeroPhonePose,
  pivot: { x: number; y: number }
): Transform2D {
  const deltaRotateX = degToRad(
    normalizeSignedDegrees(heroPhonePose.rotateX - DEFAULT_IOS_HERO_PHONE_POSE.rotateX)
  );
  const deltaRotateY = degToRad(
    normalizeSignedDegrees(heroPhonePose.rotateY - DEFAULT_IOS_HERO_PHONE_POSE.rotateY)
  );
  const deltaRotateZ = degToRad(
    normalizeSignedDegrees(heroPhonePose.rotateZ - DEFAULT_IOS_HERO_PHONE_POSE.rotateZ)
  );

  const skewX = Math.sin(deltaRotateY) * 0.16;
  const skewY = Math.sin(deltaRotateX) * 0.08;
  const scaleX = clampNumber(1 - Math.abs(Math.sin(deltaRotateY)) * 0.08, 0.9, 1.08);
  const scaleY = clampNumber(1 - Math.abs(Math.sin(deltaRotateX)) * 0.05, 0.92, 1.08);
  const translateX = Math.sin(deltaRotateY) * 112 + Math.sin(deltaRotateZ) * 22;
  const translateY = Math.sin(deltaRotateX) * -96 + Math.sin(deltaRotateY) * 24;

  let transform = identityTransform2D();
  transform = multiplyTransform2D(translateTransform2D(-pivot.x, -pivot.y), transform);
  transform = multiplyTransform2D(scaleTransform2D(scaleX, scaleY), transform);
  transform = multiplyTransform2D(skewTransform2D(skewX, skewY), transform);
  transform = multiplyTransform2D(rotateTransform2D(deltaRotateZ), transform);
  transform = multiplyTransform2D(translateTransform2D(pivot.x, pivot.y), transform);
  transform = multiplyTransform2D(translateTransform2D(translateX, translateY), transform);
  return transform;
}

function roundedRectPath(
  ctx: any,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

export function buildTitleLines(slot: ScreenshotTemplateSlot, title: string): string[] {
  const normalized = title.replace(/\r/g, '').trim() || 'Your app headline';
  const manualLines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (manualLines.length > 1) {
    return manualLines;
  }

  const tokens = normalized
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  if (slot === 1 && tokens.length >= 4) {
    return [tokens.slice(0, 2).join(' '), tokens.slice(2).join(' ')];
  }

  if (slot === 2 && tokens.length >= 6) {
    return [
      tokens.slice(0, 3).join(' '),
      tokens.slice(3, 6).join(' '),
      tokens.slice(6).join(' '),
    ].filter((line) => line.length > 0);
  }

  return wrapTitle(normalized, slot <= 2 ? 24 : 17, 3);
}

function wrapTitle(title: string, maxCharsPerLine: number, maxLines: number): string[] {
  const tokens = title
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  const lines: string[] = [];
  let current = '';

  for (const token of tokens) {
    const candidate = current ? `${current} ${token}` : token;
    if (candidate.length <= maxCharsPerLine || current.length === 0) {
      current = candidate;
      continue;
    }

    lines.push(current);
    current = token;
    if (lines.length === maxLines - 1) break;
  }

  if (lines.length < maxLines && current) {
    lines.push(current);
  }

  const consumed = lines.join(' ').split(/\s+/).filter(Boolean).length;
  const remaining = tokens.slice(consumed);
  if (remaining.length > 0 && lines.length > 0) {
    lines[lines.length - 1] = `${lines[lines.length - 1]} ${remaining.join(' ')}`;
  }

  return lines.slice(0, maxLines);
}

function imageSize(image: any): { width: number; height: number } {
  return {
    width: Number(image?.naturalWidth ?? image?.width ?? 1),
    height: Number(image?.naturalHeight ?? image?.height ?? 1),
  };
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace('#', '').trim();
  const full = normalized.length === 3
    ? normalized
        .split('')
        .map((part) => `${part}${part}`)
        .join('')
    : normalized;

  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

function rgba(rgb: { r: number; g: number; b: number }, alpha: number): string {
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}


function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function normalizeDegrees360(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function normalizeSignedDegrees(value: number): number {
  const normalized = normalizeDegrees360(value);
  return normalized > 180 ? normalized - 360 : normalized;
}

function degToRad(value: number): number {
  return (value * Math.PI) / 180;
}

function composeFontStack(fontFamily: string): string {
  const normalized = fontFamily.trim().replace(/^['"]+|['"]+$/g, '');
  const primary = normalized.includes(' ') ? `"${normalized}"` : normalized;
  return `${primary}, ${FONT_STACK}`;
}

function getTitleLineHeight(
  store: ScreenshotStore,
  _slot: ScreenshotTemplateSlot,
  fontSize: number
): number {
  if (store === 'play_store') return Math.round(fontSize * PLAY_STORE_TITLE_LINE_HEIGHT_MULTIPLIER);
  return Math.round(fontSize * IOS_TITLE_LINE_HEIGHT_MULTIPLIER);
}

function resolveTitleLineGap(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}
