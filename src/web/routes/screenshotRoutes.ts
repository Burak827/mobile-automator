import type express from 'express';
import { mkdirSync } from 'node:fs';
import { access, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { getAIProviderLabel, resolveAIConfig } from '../../aiProvider.js';
import {
  translateWithOpenAI,
  verifyTranslationWithOpenAI,
} from '../../translate.js';
import {
  getScreenshotTemplateCanvasSize,
  type ScreenshotTemplateSlot,
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
  parseJsonOrUndefined,
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
  normalizeScreenshotTranslationLocaleKey,
  resolveImageExtension,
  sanitizePathToken,
  serializeScreenshotUploadBatchRecord,
  serializeScreenshotPresetRecord,
  serializeScreenshotTitleTranslationRecord,
  toNonEmptyString,
  toProjectRelativePath,
} from '../serverHelpers.js';

const DEFAULT_ASC_SCREENSHOT_DISPLAY_TYPE = 'APP_IPHONE_65';
const GENERATED_SCREENSHOT_SLOTS = [1, 2, 3, 4, 5, 6] as const;
const SCREENSHOT_TITLE_LOCALE_CONCURRENCY = 5;

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];

  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        if (currentIndex >= items.length) return;
        results[currentIndex] = await worker(items[currentIndex] as T, currentIndex);
      }
    })
  );

  return results;
}

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
      const isRetryable = (err as { isRetryable?: boolean }).isRetryable;
      if (status !== 429 || isRetryable === false) throw err;
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
      const isRetryable = (err as { isRetryable?: boolean }).isRetryable;
      if (status !== 429 || isRetryable === false) throw err;
      const retryAfterMs = (err as { retryAfterMs?: number }).retryAfterMs;
      const delay = retryAfterMs ?? 1000 * Math.pow(2, attempt);
      await new Promise((resolveDelay) => setTimeout(resolveDelay, delay));
    }
  }
  throw lastError;
}

type ScreenshotTitleTemplateMask = {
  maskedText: string;
  tokens: string[];
};

type ScreenshotTitleVerifyItem = {
  locale: string;
  slot: string;
  sourceText: string;
  translatedText: string;
};

const PASSTHROUGH_SCREENSHOT_TITLE_TEMPLATE_TOKENS = new Set([
  'localeappname',
  'applocalename',
  'applocalizedname',
  'localappname',
  'empty',
]);

function mergeNormalizedScreenshotTitleTranslationEntries(
  entries: Array<[string, Record<ScreenshotTemplateSlot, string>]>
): Record<string, Record<ScreenshotTemplateSlot, string>> {
  return [...entries]
    .sort(
      ([leftLocale], [rightLocale]) =>
        (leftLocale.includes('_') ? 0 : 1) - (rightLocale.includes('_') ? 0 : 1)
    )
    .reduce((acc, [locale, titles]) => {
      const normalizedLocale = normalizeScreenshotTranslationLocaleKey(locale);
      if (!normalizedLocale) return acc;
      acc[normalizedLocale] = {
        ...(acc[normalizedLocale] ?? parseScreenshotSlotTitlesInput(undefined)),
        ...parseScreenshotSlotTitlesInput(titles),
      };
      return acc;
    }, {} as Record<string, Record<ScreenshotTemplateSlot, string>>);
}

function maskScreenshotTitleTemplateTokens(text: string): ScreenshotTitleTemplateMask {
  const tokens: string[] = [];
  const maskedText = text.replace(/\{\{[\s\S]*?\}\}/g, (match) => {
    const index = tokens.push(match) - 1;
    return `[[[SCREENSHOT_TOKEN_${index}]]]`;
  });
  return {
    maskedText,
    tokens,
  };
}

function restoreScreenshotTitleTemplateTokens(text: string, tokens: string[]): string {
  return text.replace(/\[\[\[SCREENSHOT_TOKEN_(\d+)\]\]\]/g, (match, rawIndex: string) => {
    const index = Number.parseInt(rawIndex, 10);
    return Number.isInteger(index) && tokens[index] ? tokens[index] : match;
  });
}

function shouldPassthroughScreenshotTitleTemplate(text: string): boolean {
  const match = text.trim().match(/^\{\{\s*([^}]+?)\s*\}\}$/);
  if (!match) return false;
  const compactBody = (match[1] ?? '').replace(/\s+/g, '').toLowerCase();
  return PASSTHROUGH_SCREENSHOT_TITLE_TEMPLATE_TOKENS.has(compactBody);
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

  router.get('/api/apps/:id/screenshots/upload-batches', (req, res, next) => {
    try {
      const appId = parseId(req.params.id);
      mustGetApp(ctx.repo, appId);
      const batches = ctx.repo.listScreenshotUploadBatches(appId).map((record) => ({
        ...serializeScreenshotUploadBatchRecord(record),
        outputRoot: toProjectRelativePath(
          resolve(
            process.cwd(),
            'data',
            'screenshots',
            'output',
            `app-${appId}`,
            getScreenshotStorePathToken(record.store)
          )
        ),
      }));
      res.json({ appId, batches });
    } catch (error) {
      next(error);
    }
  });

  router.post('/api/apps/:id/screenshots/:store/upload-batch', async (req, res, next) => {
    try {
      const appId = parseId(req.params.id);
      const appRow = mustGetApp(ctx.repo, appId);
      const store = parseScreenshotStoreParam(req.params.store);
      const batch = ctx.repo.getScreenshotUploadBatch(appId, store);
      if (!batch) {
        res.status(400).json({ error: 'Upload bekleyen screenshot batch bulunamadı.' });
        return;
      }

      const localesRaw = parseJsonOrUndefined(batch.localesJson);
      const locales = Array.isArray(localesRaw)
        ? localesRaw
            .filter((locale): locale is string => typeof locale === 'string')
            .map((locale) => locale.trim())
            .filter((locale) => locale.length > 0)
            .sort((a, b) => a.localeCompare(b))
        : [];
      if (locales.length === 0) {
        ctx.repo.deleteScreenshotUploadBatch(appId, store);
        res.status(400).json({ error: 'Batch içinde locale bulunamadı.' });
        return;
      }

      ctx.repo.markScreenshotUploadBatchUploading(appId, store);

      const fileDiscovery = await Promise.all(
        locales.map(async (locale) => ({
          locale,
          filePaths: await collectGeneratedScreenshotFilePaths(appId, store, locale),
        }))
      );

      const readyLocaleFiles = fileDiscovery.filter((entry) => entry.filePaths.length === GENERATED_SCREENSHOT_SLOTS.length);
      const preflightFailed = fileDiscovery
        .filter((entry) => entry.filePaths.length !== GENERATED_SCREENSHOT_SLOTS.length)
        .map((entry) => ({
          locale: entry.locale,
          error: `Eksik output bulundu (${entry.filePaths.length}/${GENERATED_SCREENSHOT_SLOTS.length}).`,
        }));

      const outputRoot = toProjectRelativePath(
        resolve(
          process.cwd(),
          'data',
          'screenshots',
          'output',
          `app-${appId}`,
          getScreenshotStorePathToken(store)
        )
      );

      if (readyLocaleFiles.length === 0) {
        ctx.repo.markScreenshotUploadBatchFailed(
          appId,
          store,
          'Upload için hazır locale bulunamadı.',
          preflightFailed.map((entry) => entry.locale)
        );
        res.status(400).json({
          appId,
          store,
          uploadedLocales: [],
          failedLocales: preflightFailed,
          outputRoot,
          message: 'Upload için hazır locale bulunamadı.',
        });
        return;
      }

      const uploadResult =
        store === 'ios'
          ? await ctx.storeApi.uploadAppStoreGeneratedScreenshots({
              app: appRow,
              displayType: resolvePreferredAscScreenshotDisplayType(ctx.repo, appId),
              localeFiles: readyLocaleFiles,
            })
          : await ctx.storeApi.uploadPlayStoreGeneratedScreenshots({
              app: appRow,
              localeFiles: readyLocaleFiles,
            });

      const failedLocales = [...preflightFailed, ...uploadResult.failed];
      if (failedLocales.length > 0) {
        ctx.repo.markScreenshotUploadBatchFailed(
          appId,
          store,
          failedLocales.map((entry) => `${entry.locale}: ${entry.error}`).join(' | '),
          failedLocales.map((entry) => entry.locale)
        );
      } else {
        ctx.repo.deleteScreenshotUploadBatch(appId, store);
      }

      res.json({
        appId,
        store,
        uploadedLocales: uploadResult.uploadedLocales,
        failedLocales,
        outputRoot,
        message:
          failedLocales.length === 0
            ? `${getScreenshotStoreLabel(store)} screenshot upload tamamlandı (${uploadResult.uploadedLocales.length} locale).`
            : `${getScreenshotStoreLabel(store)} screenshot upload kısmi tamamlandı (${uploadResult.uploadedLocales.length} başarılı, ${failedLocales.length} hatalı).`,
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
      const sourceLocale =
        normalizeScreenshotTranslationLocaleKey(body.sourceLocale) ??
        normalizeScreenshotTranslationLocaleKey(appRow.sourceLocale) ??
        'en-US';
      const sourceTitles = parseScreenshotSlotTitlesInput(body.sourceTitles);
      const requestedLocales = Array.isArray(body.locales)
        ? body.locales
            .map((locale) => normalizeScreenshotTranslationLocaleKey(locale))
            .filter((locale): locale is string => typeof locale === 'string')
            .filter((locale) => locale.length > 0 && locale.toLowerCase() !== sourceLocale.toLowerCase())
        : [];
      const verifyTranslations = parseBoolean(body.verify, true);
      const masterPrompt = toNonEmptyString(body.masterPrompt);
      let aiConfig;
      try {
        aiConfig = resolveAIConfig(ctx.env, body.provider);
      } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
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
        provider: aiConfig.provider === 'anthropic' ? 'anthropic' : 'openai',
        providerLabel: getAIProviderLabel(
          aiConfig.provider === 'anthropic' ? 'anthropic' : 'openai'
        ),
        totalLocales: targetLocales.length,
        totalSlots: sourceEntries.length,
      });

      const persistedTranslations = mergeNormalizedScreenshotTitleTranslationEntries([
        ...ctx.repo.listScreenshotTitleTranslations(appId).map((record) => [
          record.locale,
          parseScreenshotSlotTitlesInput(JSON.parse(record.titlesJson)),
        ] as [string, Record<ScreenshotTemplateSlot, string>]),
        [sourceLocale, sourceTitles],
      ]);

      const localeResults = await mapWithConcurrency(
        targetLocales,
        SCREENSHOT_TITLE_LOCALE_CONCURRENCY,
        async (locale) => {
          const translatedSlotTitles = parseScreenshotSlotTitlesInput(undefined);
          const verifyItems: ScreenshotTitleVerifyItem[] = [];

          for (const [slotKey, sourceText] of sourceEntries) {
            try {
              if (shouldPassthroughScreenshotTitleTemplate(sourceText)) {
                translatedSlotTitles[Number(slotKey) as keyof typeof translatedSlotTitles] = sourceText;
                verifyItems.push({
                  locale,
                  slot: slotKey,
                  sourceText,
                  translatedText: sourceText,
                });
                writeLine({
                  type: 'progress',
                  locale,
                  slot: Number(slotKey),
                  status: 'passthrough',
                });
                continue;
              }

              const templateMask = maskScreenshotTitleTemplateTokens(sourceText);
              const sourceCharCount = templateMask.maskedText.length;
              const translated = await translateWithRetry({
                config: aiConfig,
                sourceLocale,
                targetLocale: locale,
                text: templateMask.maskedText,
                fieldName: `screenshot_slot_${slotKey}_title`,
                storeName: 'Screenshot Title',
                appTitle: appRow.canonicalName,
                masterPrompt: masterPrompt || undefined,
                contextHint:
                  'This text will be displayed on a mobile app store screenshot image for marketing purposes. ' +
                  'Space is very limited. The translated text MUST stay similar in length to the source text ' +
                  `(source is ${sourceCharCount} characters). ` +
                  'If the target language produces a longer translation, use shorter synonyms, ' +
                  'abbreviations, or rephrase creatively to keep it concise. ' +
                  'Prioritize punchy, marketing-friendly copy over literal accuracy.',
              });
              const restoredTranslation = restoreScreenshotTitleTemplateTokens(
                translated,
                templateMask.tokens
              );

              translatedSlotTitles[Number(slotKey) as keyof typeof translatedSlotTitles] =
                restoredTranslation;
              verifyItems.push({
                locale,
                slot: slotKey,
                sourceText,
                translatedText: restoredTranslation,
              });
              writeLine({
                type: 'progress',
                locale,
                slot: Number(slotKey),
                status: 'translated',
              });
            } catch (error) {
              if ((error as { isQuotaExceeded?: boolean }).isQuotaExceeded) {
                throw error;
              }
              writeLine({
                type: 'error',
                locale,
                slot: Number(slotKey),
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }

          writeLine({
            type: 'locale_done',
            locale,
            slotTitles: translatedSlotTitles,
          });

          return {
            locale,
            translatedSlotTitles,
            verifyItems,
          };
        }
      );

      const verifyQueue: ScreenshotTitleVerifyItem[] = [];
      for (const { locale, translatedSlotTitles, verifyItems } of localeResults) {
        persistedTranslations[locale] = parseScreenshotSlotTitlesInput(translatedSlotTitles);
        verifyQueue.push(...verifyItems);
      }

      if (verifyTranslations) {
        writeLine({
          type: 'verify_start',
          totalChecks: verifyQueue.length,
        });

        const verifyItemsByLocale = new Map<string, ScreenshotTitleVerifyItem[]>();
        for (const item of verifyQueue) {
          const items = verifyItemsByLocale.get(item.locale) ?? [];
          items.push(item);
          verifyItemsByLocale.set(item.locale, items);
        }

        const failedByLocale = await mapWithConcurrency(
          targetLocales,
          SCREENSHOT_TITLE_LOCALE_CONCURRENCY,
          async (locale) => {
            const localeFailed: Array<{
              locale: string;
              slot: number;
              reason: string;
              answer?: string;
            }> = [];
            const localeVerifyItems = verifyItemsByLocale.get(locale) ?? [];

            for (const item of localeVerifyItems) {
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
                  localeFailed.push({
                    locale: item.locale,
                    slot: Number(item.slot),
                    reason: 'AI sonucu hayir',
                    answer: verifyResult.raw,
                  });
                }
              } catch (error) {
                if ((error as { isQuotaExceeded?: boolean }).isQuotaExceeded) {
                  throw error;
                }
                localeFailed.push({
                  locale: item.locale,
                  slot: Number(item.slot),
                  reason: error instanceof Error ? error.message : String(error),
                });
              }
            }

            return localeFailed;
          }
        );

        const failed = failedByLocale.flat();

        writeLine({
          type: 'verify_done',
          totalChecks: verifyQueue.length,
          failedCount: failed.length,
          failed,
        });
      }

      ctx.repo.replaceScreenshotTitleTranslations(
        appId,
        Object.entries(persistedTranslations).map(([locale, titles]) => ({
          locale,
          titles,
        }))
      );

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

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function collectGeneratedScreenshotFilePaths(
  appId: number,
  store: ScreenshotStore,
  locale: string
): Promise<string[]> {
  const localeToken = sanitizePathToken(locale || 'en-US') || 'en-US';
  const baseDir = resolve(
    process.cwd(),
    'data',
    'screenshots',
    'output',
    `app-${appId}`,
    getScreenshotStorePathToken(store),
    localeToken
  );
  const files: string[] = [];
  for (const slot of GENERATED_SCREENSHOT_SLOTS) {
    const path = join(baseDir, `${slot}.png`);
    if (await fileExists(path)) {
      files.push(path);
    }
  }
  return files;
}

function resolvePreferredAscScreenshotDisplayType(
  repo: Parameters<RouteRegistrar>[1]['repo'],
  appId: number
): string {
  const details = repo.listStoreLocaleDetails(appId, 'app_store');
  for (const detail of details) {
    const raw = parseJsonOrUndefined(detail.detailJson);
    if (!raw || typeof raw !== 'object') continue;
    const screenshots = (raw as Record<string, unknown>).screenshots;
    if (!Array.isArray(screenshots)) continue;
    for (const group of screenshots) {
      const displayType =
        group && typeof group === 'object'
          ? toNonEmptyString((group as Record<string, unknown>).displayType)
          : undefined;
      if (displayType) return displayType;
    }
  }
  return DEFAULT_ASC_SCREENSHOT_DISPLAY_TYPE;
}

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

  const localeFilePaths = await collectGeneratedScreenshotFilePaths(appId, store, locale);
  if (localeFilePaths.length === GENERATED_SCREENSHOT_SLOTS.length) {
    ctx.repo.upsertScreenshotUploadBatch(appId, store, [locale]);
  }

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
