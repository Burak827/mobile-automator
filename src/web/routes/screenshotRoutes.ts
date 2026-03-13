import type express from 'express';
import { mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import {
  translateWithOpenAI,
  verifyTranslationWithOpenAI,
  type OpenAIConfig,
} from '../../translate.js';
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
  parseBoolean,
  parseScreenshotHeroCameraModeInput,
  parseScreenshotHeroCameraSettingsInput,
  parseScreenshotHeroKeyLightSettingsInput,
  parseScreenshotHeroKeyLightPositionInput,
  parseScreenshotHeroPhoneLocationInput,
  parseId,
  parseScreenshotHeroPhonePoseInput,
  parseScreenshotHeroPhoneShapeInput,
  parseScreenshotPaletteInput,
  parseScreenshotSlotBackgroundSettingsInput,
  parseScreenshotSlotPalettesInput,
  parseScreenshotSlotSbeSettingsInput,
  parseScreenshotSlot1SbeSettingsInput,
  parseScreenshotSlotTitleExtraLineColorsInput,
  parseScreenshotSlotTitleLineGapsInput,
  parseScreenshotSlotTitleCentersInput,
  parseScreenshotSlotTitleTypographyInput,
  parseScreenshotSlotTitlesInput,
  parseScreenshotTitleTranslationsInput,
  parseScreenshotSlot,
  parseScreenshotStoreParam,
  resolveImageExtension,
  sanitizePathToken,
  serializeScreenshotPresetRecord,
  serializeScreenshotTitleTranslationRecord,
  toNonEmptyString,
  toProjectRelativePath,
} from '../serverHelpers.js';

async function translateWithRetry(
  args: Parameters<typeof translateWithOpenAI>[0],
  maxRetries = 5
): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      return await translateWithOpenAI(args);
    } catch (err: unknown) {
      lastError = err;
      const status = (err as { status?: number }).status;
      if (status !== 429) throw err;
      const retryAfterMs = (err as { retryAfterMs?: number }).retryAfterMs;
      const delay = retryAfterMs ?? 1000 * Math.pow(2, attempt);
      await new Promise((resolveDelay) => setTimeout(resolveDelay, delay));
    }
  }
  throw lastError;
}

async function verifyWithRetry(
  args: Parameters<typeof verifyTranslationWithOpenAI>[0],
  maxRetries = 5
): Promise<{ verdict: 'evet' | 'hayir'; raw: string }> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      return await verifyTranslationWithOpenAI(args);
    } catch (err: unknown) {
      lastError = err;
      const status = (err as { status?: number }).status;
      if (status !== 429) throw err;
      const retryAfterMs = (err as { retryAfterMs?: number }).retryAfterMs;
      const delay = retryAfterMs ?? 1000 * Math.pow(2, attempt);
      await new Promise((resolveDelay) => setTimeout(resolveDelay, delay));
    }
  }
  throw lastError;
}

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
      const slotTitleCenters = parseScreenshotSlotTitleCentersInput(body.slotTitleCenters);
      const slotTitleTypography = parseScreenshotSlotTitleTypographyInput(store, body.slotTitleTypography);
      const slotBackgroundSettings = parseScreenshotSlotBackgroundSettingsInput(
        body.slotBackgroundSettings
      );
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
        slotTitleCenters,
        slotTitleTypography,
        slotBackgroundSettings,
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

  router.get('/api/apps/:id/screenshots/title-translations', (req, res, next) => {
    try {
      const appId = parseId(req.params.id);
      mustGetApp(ctx.repo, appId);
      const records = ctx.repo.listScreenshotTitleTranslations(appId);
      res.json({
        appId,
        translations: records.map(serializeScreenshotTitleTranslationRecord),
      });
    } catch (error) {
      next(error);
    }
  });

  router.put('/api/apps/:id/screenshots/title-translations', (req, res, next) => {
    try {
      const appId = parseId(req.params.id);
      mustGetApp(ctx.repo, appId);
      const body = (req.body ?? {}) as Record<string, unknown>;
      const translations = parseScreenshotTitleTranslationsInput(body.translations);
      const records = ctx.repo.replaceScreenshotTitleTranslations(
        appId,
        Object.entries(translations).map(([locale, slotTitles]) => ({
          locale,
          titles: slotTitles,
        }))
      );
      res.json({
        appId,
        translations: records.map(serializeScreenshotTitleTranslationRecord),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/api/apps/:id/screenshots/generate-title-translations', async (req, res, next) => {
    try {
      const appId = parseId(req.params.id);
      const appRow = mustGetApp(ctx.repo, appId);
      const body = (req.body ?? {}) as Record<string, unknown>;
      const sourceLocale = toNonEmptyString(body.sourceLocale) ?? appRow.sourceLocale ?? 'en-US';
      const sourceTitles = parseScreenshotSlotTitlesInput(body.sourceTitles);
      const requestedLocales = Array.isArray(body.locales)
        ? body.locales
            .filter((locale): locale is string => typeof locale === 'string')
            .map((locale) => locale.trim())
            .filter((locale) => locale.length > 0 && locale !== sourceLocale)
        : [];
      const verifyTranslations = parseBoolean(body.verify, true);
      const masterPrompt = toNonEmptyString(body.masterPrompt);
      const openaiApiKey = ctx.env.openaiApiKey;
      const openaiModel = ctx.env.openaiModel ?? 'gpt-4o-mini';
      if (!openaiApiKey) {
        res.status(400).json({ error: 'OPENAI_API_KEY is not configured.' });
        return;
      }
      const sourceEntries = Object.entries(sourceTitles).filter(([, value]) => value.trim().length > 0);
      if (sourceEntries.length === 0) {
        res.status(400).json({ error: 'Source locale için çevrilecek screenshot title bulunamadı.' });
        return;
      }
      const targetLocales = Array.from(new Set(requestedLocales)).sort((a, b) => a.localeCompare(b));
      if (targetLocales.length === 0) {
        res.status(400).json({ error: 'Çeviri için hedef locale bulunamadı.' });
        return;
      }

      const aiConfig: OpenAIConfig = {
        apiKey: openaiApiKey,
        model: openaiModel,
        baseUrl: ctx.env.openaiBaseUrl,
      };

      res.setHeader('Content-Type', 'application/x-ndjson');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Transfer-Encoding', 'chunked');
      res.flushHeaders();

      const writeLine = (data: Record<string, unknown>) => {
        res.write(JSON.stringify(data) + '\n');
      };

      writeLine({
        type: 'start',
        sourceLocale,
        totalLocales: targetLocales.length,
        totalSlots: sourceEntries.length,
      });

      const verifyQueue: Array<{
        locale: string;
        slot: string;
        sourceText: string;
        translatedText: string;
      }> = [];

      ctx.repo.upsertScreenshotTitleTranslation(appId, sourceLocale, sourceTitles);

      for (const locale of targetLocales) {
        const translatedSlotTitles = parseScreenshotSlotTitlesInput(undefined);
        for (const [slotKey, sourceText] of sourceEntries) {
          try {
            const translated = await translateWithRetry({
              config: aiConfig,
              sourceLocale,
              targetLocale: locale,
              text: sourceText,
              fieldName: `screenshot_slot_${slotKey}_title`,
              storeName: 'Screenshot Title',
              appTitle: appRow.canonicalName,
              masterPrompt: masterPrompt || undefined,
            });

            translatedSlotTitles[Number(slotKey) as keyof typeof translatedSlotTitles] = translated;
            verifyQueue.push({
              locale,
              slot: slotKey,
              sourceText,
              translatedText: translated,
            });
            writeLine({
              type: 'progress',
              locale,
              slot: Number(slotKey),
              status: 'translated',
            });
          } catch (error) {
            writeLine({
              type: 'error',
              locale,
              slot: Number(slotKey),
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        ctx.repo.upsertScreenshotTitleTranslation(appId, locale, translatedSlotTitles);
        writeLine({
          type: 'locale_done',
          locale,
          slotTitles: translatedSlotTitles,
        });
      }

      if (verifyTranslations) {
        writeLine({
          type: 'verify_start',
          totalChecks: verifyQueue.length,
        });

        const failed: Array<{
          locale: string;
          slot: number;
          reason: string;
          answer?: string;
        }> = [];

        for (const item of verifyQueue) {
          try {
            const verifyResult = await verifyWithRetry({
              config: aiConfig,
              sourceLocale,
              targetLocale: item.locale,
              sourceText: item.sourceText,
              translatedText: item.translatedText,
              fieldName: `screenshot_slot_${item.slot}_title`,
              storeName: 'Screenshot Title',
              appTitle: appRow.canonicalName,
              masterPrompt: masterPrompt || undefined,
            });
            if (verifyResult.verdict !== 'evet') {
              failed.push({
                locale: item.locale,
                slot: Number(item.slot),
                reason: 'AI sonucu hayir',
                answer: verifyResult.raw,
              });
            }
          } catch (error) {
            failed.push({
              locale: item.locale,
              slot: Number(item.slot),
              reason: error instanceof Error ? error.message : String(error),
            });
          }
        }

        writeLine({
          type: 'verify_done',
          totalChecks: verifyQueue.length,
          failedCount: failed.length,
          failed,
        });
      }

      writeLine({
        type: 'done',
        translatedLocales: targetLocales.length,
      });
      res.end();
    } catch (error) {
      if (!res.headersSent) {
        next(error);
      } else {
        try {
          res.write(JSON.stringify({ type: 'fatal', error: error instanceof Error ? error.message : String(error) }) + '\n');
        } catch {
          // ignore stream write errors during shutdown
        }
        res.end();
      }
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
  const slotTitleCenters = parseScreenshotSlotTitleCentersInput(body.slotTitleCenters);
  const slotTitleTypography = parseScreenshotSlotTitleTypographyInput(store, body.slotTitleTypography);
  const slotBackgroundSettings = parseScreenshotSlotBackgroundSettingsInput(
    body.slotBackgroundSettings
  );
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
    slotTitleCenters,
    slotTitleTypography,
    slotBackgroundSettings,
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
    slotBackgroundSettings,
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
