import type express from 'express';
import { mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import {
  getScreenshotTemplateCanvasSize,
} from '../screenshotTemplates/storeScreenshotTemplateRegistry.js';
import {
  getScreenshotStoreLabel,
  getScreenshotStorePathToken,
  type ScreenshotStore,
} from '../screenshotTemplates/screenshotStores.js';
import type { RouteRegistrar } from '../serverHelpers.js';
import {
  mustGetApp,
  parseScreenshotHeroCameraModeInput,
  parseScreenshotHeroCameraSettingsInput,
  parseScreenshotHeroKeyLightSettingsInput,
  parseScreenshotHeroKeyLightPositionInput,
  parseScreenshotHeroPhoneLocationInput,
  parseId,
  parseScreenshotHeroPhonePoseInput,
  parseScreenshotHeroPhoneShapeInput,
  parseScreenshotPaletteInput,
  parseScreenshotSlotPalettesInput,
  parseScreenshotSlotSbeSettingsInput,
  parseScreenshotSlot1SbeSettingsInput,
  parseScreenshotSlotTitleExtraLineColorsInput,
  parseScreenshotSlotTitleLineGapsInput,
  parseScreenshotSlotTitleTypographyInput,
  parseScreenshotSlotTitlesInput,
  parseScreenshotSlot,
  parseScreenshotStoreParam,
  resolveImageExtension,
  sanitizePathToken,
  serializeScreenshotPresetRecord,
  toNonEmptyString,
  toProjectRelativePath,
} from '../serverHelpers.js';

export const registerScreenshotRoutes: RouteRegistrar = (router, ctx) => {
  router.get('/api/apps/:id/screenshots/presets', (req, res, next) => {
    try {
      const appId = parseId(req.params.id);
      mustGetApp(ctx.repo, appId);
      const records = ctx.repo.listScreenshotPresets(appId);
      res.json({
        appId,
        presets: records.map(serializeScreenshotPresetRecord),
      });
    } catch (error) {
      next(error);
    }
  });

  router.put('/api/apps/:id/screenshots/presets/:store', (req, res, next) => {
    try {
      const appId = parseId(req.params.id);
      mustGetApp(ctx.repo, appId);
      const store = parseScreenshotStoreParam(req.params.store);
      const body = (req.body ?? {}) as Record<string, unknown>;
      const palette = parseScreenshotPaletteInput(store, body.palette);
      const slotPalettes = parseScreenshotSlotPalettesInput(store, body.slotPalettes, palette);
      const slotTitles = parseScreenshotSlotTitlesInput(body.slotTitles);
      const slotTitleExtraLineColors = parseScreenshotSlotTitleExtraLineColorsInput(body.slotTitleExtraLineColors);
      const slotTitleLineGaps = parseScreenshotSlotTitleLineGapsInput(
        body.slotTitleLineGaps,
        body.titleLineGap
      );
      const slotTitleTypography = parseScreenshotSlotTitleTypographyInput(store, body.slotTitleTypography);
      const heroPhonePose = parseScreenshotHeroPhonePoseInput(store, body.heroPhonePose);
      const heroPhoneShape = parseScreenshotHeroPhoneShapeInput(store, body.heroPhoneShape);
      const heroPhoneLocation = parseScreenshotHeroPhoneLocationInput(store, body.heroPhoneLocation);
      const heroKeyLightPosition = parseScreenshotHeroKeyLightPositionInput(store, body.heroKeyLightPosition);
      const heroKeyLightSettings = parseScreenshotHeroKeyLightSettingsInput(
        store,
        body.heroKeyLightSettings,
        body.heroKeyLightPosition
      );
      const slotSbeSettings = parseScreenshotSlotSbeSettingsInput(
        store,
        body.slotSbeSettings,
        body.slot1SbeSettings
      );
      const heroCameraMode = parseScreenshotHeroCameraModeInput(store, body.heroCameraMode);
      const heroCameraSettings = parseScreenshotHeroCameraSettingsInput(
        store,
        body.heroCameraSettings
      );
      const record = ctx.repo.upsertScreenshotPreset(appId, store, {
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
        slotSbeSettings,
        heroCameraMode,
        heroCameraSettings,
      });

      res.json({
        appId,
        preset: serializeScreenshotPresetRecord(record),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/api/apps/:id/screenshots/ios/generate', async (req, res, next) => {
    try {
      await handleScreenshotGenerateRequest(ctx, req, res, 'ios');
    } catch (error) {
      next(error);
    }
  });

  router.post('/api/apps/:id/screenshots/play-store/generate', async (req, res, next) => {
    try {
      await handleScreenshotGenerateRequest(ctx, req, res, 'play_store');
    } catch (error) {
      next(error);
    }
  });
};

async function handleScreenshotGenerateRequest(
  ctx: Parameters<RouteRegistrar>[1],
  req: express.Request,
  res: express.Response,
  store: ScreenshotStore
): Promise<void> {
  const appId = parseId(Array.isArray(req.params.id) ? req.params.id[0] ?? '' : req.params.id);
  const appRow = mustGetApp(ctx.repo, appId);
  const body = (req.body ?? {}) as Record<string, unknown>;

  const slot = parseScreenshotSlot(body.slot);
  const locale = toNonEmptyString(body.locale) ?? toNonEmptyString(appRow.sourceLocale) ?? 'en-US';
  const title = toNonEmptyString(body.title) ?? appRow.canonicalName;
  const palette = parseScreenshotPaletteInput(store, body.palette);
  const slotPalettes = parseScreenshotSlotPalettesInput(store, body.slotPalettes, palette);
  const slotTitles = parseScreenshotSlotTitlesInput(body.slotTitles);
  const slotTitleExtraLineColors = parseScreenshotSlotTitleExtraLineColorsInput(body.slotTitleExtraLineColors);
  const slotTitleLineGaps = parseScreenshotSlotTitleLineGapsInput(
    body.slotTitleLineGaps,
    body.titleLineGap
  );
  const slotTitleTypography = parseScreenshotSlotTitleTypographyInput(store, body.slotTitleTypography);
  const heroPhonePose = parseScreenshotHeroPhonePoseInput(store, body.heroPhonePose);
  const heroPhoneShape = parseScreenshotHeroPhoneShapeInput(store, body.heroPhoneShape);
  const heroPhoneLocation = parseScreenshotHeroPhoneLocationInput(store, body.heroPhoneLocation);
  const heroKeyLightPosition = parseScreenshotHeroKeyLightPositionInput(store, body.heroKeyLightPosition);
  const heroKeyLightSettings = parseScreenshotHeroKeyLightSettingsInput(
    store,
    body.heroKeyLightSettings,
    body.heroKeyLightPosition
  );
  const slotSbeSettings = parseScreenshotSlotSbeSettingsInput(
    store,
    body.slotSbeSettings,
    body.slot1SbeSettings
  );
  const heroCameraMode = parseScreenshotHeroCameraModeInput(store, body.heroCameraMode);
  const heroCameraSettings = parseScreenshotHeroCameraSettingsInput(
    store,
    body.heroCameraSettings
  );
  const rendererMode = toNonEmptyString(body.rendererMode);
  const fileName = basename(toNonEmptyString(body.fileName) ?? `slot-${slot}.png`);
  const mimeType = toNonEmptyString(body.mimeType) ?? 'image/png';
  const imageBase64Raw = typeof body.imageBase64 === 'string' ? body.imageBase64.trim() : '';
  const renderedImageBase64Raw =
    typeof body.renderedImageBase64 === 'string' ? body.renderedImageBase64.trim() : '';
  if (!imageBase64Raw) {
    throw new Error('imageBase64 zorunlu.');
  }
  if (!renderedImageBase64Raw) {
    throw new Error('renderedImageBase64 zorunlu. Screenshot browser tarafında render edilmelidir.');
  }

  const imageBase64 = imageBase64Raw.replace(/^data:[^;]+;base64,/, '');
  if (!/^[A-Za-z0-9+/=\r\n]+$/.test(imageBase64)) {
    throw new Error('imageBase64 geçersiz.');
  }

  const inputBuffer = Buffer.from(imageBase64, 'base64');
  if (inputBuffer.length === 0) {
    throw new Error('Görsel decode edilemedi.');
  }

  const renderedImageBase64 = renderedImageBase64Raw.replace(/^data:[^;]+;base64,/, '');
  if (!/^[A-Za-z0-9+/=\r\n]+$/.test(renderedImageBase64)) {
    throw new Error('renderedImageBase64 geçersiz.');
  }
  const renderedBuffer = Buffer.from(renderedImageBase64, 'base64');
  if (renderedBuffer.length === 0) {
    throw new Error('Rendered PNG decode edilemedi.');
  }

  const localeToken = sanitizePathToken(locale || 'en-US') || 'en-US';
  const extension = resolveImageExtension(fileName, mimeType);
  const storePathToken = getScreenshotStorePathToken(store);
  const screenshotsRoot = resolve(process.cwd(), 'data', 'screenshots');
  const stagedDir = join(screenshotsRoot, 'staging', `app-${appId}`, storePathToken, localeToken);
  const outputDir = join(screenshotsRoot, 'output', `app-${appId}`, storePathToken, localeToken);
  mkdirSync(stagedDir, { recursive: true });
  mkdirSync(outputDir, { recursive: true });

  const stagedInputPath = join(stagedDir, `${slot}.${extension}`);
  await writeFile(stagedInputPath, inputBuffer);

  const outputPath = join(outputDir, `${slot}.png`);
  await writeFile(outputPath, renderedBuffer);

  ctx.repo.upsertScreenshotPreset(appId, store, {
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
    slotSbeSettings,
    heroCameraMode,
    heroCameraSettings,
  });

  res.status(201).json({
    appId,
    store,
    locale,
    slot,
    title,
    palette,
    heroPhonePose,
    heroPhoneShape,
    heroPhoneLocation,
    heroKeyLightPosition,
    heroKeyLightSettings,
    slotSbeSettings,
    heroCameraMode,
    heroCameraSettings,
    stagedInputPath: toProjectRelativePath(stagedInputPath),
    outputPath: toProjectRelativePath(outputPath),
    message: `Screenshot üretildi (${storePathToken}/${locale}/slot-${slot}).`,
    renderer: {
      template: store === 'ios' && slot <= 2 ? 'procedural-ios-hero' : 'browser-rendered',
      engine: rendererMode ?? 'browser-rendered',
      runtime: 'browser',
      canvasSize: getScreenshotTemplateCanvasSize(store),
    },
  });
}
