import { getAIProviderLabel, resolveAIConfig } from '../../aiProvider.js';
import {
  shortenBatchWithOpenAI,
  shortenWithOpenAI,
  translateBatchWithOpenAI,
  translateWithOpenAI,
  verifyBatchWithOpenAI,
  verifyTranslationWithOpenAI,
} from '../../translate.js';
import { APP_STORE_LOCALES, PLAY_STORE_LOCALES, toCanonical } from '../localeCatalog.js';
import { STORE_RULES, type StoreId } from '../storeRules.js';
import type { RouteRegistrar } from '../serverHelpers.js';
import { mustGetApp, parseBoolean, parseId, parseStoreId } from '../serverHelpers.js';

type TranslationField = {
  fieldId: string;
  maxChars: number;
  unit: 'chars' | 'bytes';
  storeName: string;
};

function getTranslatableFields(store: StoreId): TranslationField[] {
  const rules = STORE_RULES[store];
  const storeName = rules.displayName;
  return Object.entries(rules.fields)
    .filter(([, rule]) => typeof rule.maxChars === 'number')
    .map(([fieldId, rule]) => ({
      fieldId,
      maxChars: rule.maxChars!,
      unit: rule.unit ?? 'chars',
      storeName,
    }));
}

function extractFieldValue(
  detail: Record<string, unknown>,
  store: StoreId,
  fieldId: string
): string {
  if (store === 'app_store') {
    const appInfo = detail.appInfo as Record<string, unknown> | undefined;
    const versionLoc = detail.versionLocalization as Record<string, unknown> | undefined;
    switch (fieldId) {
      case 'appName': return (appInfo?.name as string) ?? '';
      case 'subtitle': return (appInfo?.subtitle as string) ?? '';
      case 'promotionalText': return (versionLoc?.promotionalText as string) ?? '';
      case 'description': return (versionLoc?.description as string) ?? '';
      case 'whatsNew': return (versionLoc?.whatsNew as string) ?? '';
      case 'keywords': return (versionLoc?.keywords as string) ?? '';
      default: return '';
    }
  }

  const listing = detail.listing as Record<string, unknown> | undefined;
  switch (fieldId) {
    case 'title': return (listing?.title as string) ?? '';
    case 'shortDescription': return (listing?.shortDescription as string) ?? '';
    case 'fullDescription': return (listing?.fullDescription as string) ?? '';
    default: return '';
  }
}

function measureFieldLength(value: string, unit: 'chars' | 'bytes'): number {
  if (unit === 'bytes') return new TextEncoder().encode(value).length;
  return value.length;
}

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];

  const results = new Array<R>(items.length);
  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  let nextIndex = 0;

  const runWorker = async () => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) return;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
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

async function shortenWithRetry(
  args: Parameters<typeof shortenWithOpenAI>[0],
  maxRetries = 5
): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      return await shortenWithOpenAI(args);
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

async function translateBatchWithRetry(
  args: Parameters<typeof translateBatchWithOpenAI>[0],
  maxRetries = 5
): Promise<Record<string, string>> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      return await translateBatchWithOpenAI(args);
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

async function shortenBatchWithRetry(
  args: Parameters<typeof shortenBatchWithOpenAI>[0],
  maxRetries = 5
): Promise<Record<string, string>> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      return await shortenBatchWithOpenAI(args);
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

async function verifyBatchWithRetry(
  args: Parameters<typeof verifyBatchWithOpenAI>[0],
  maxRetries = 5
): Promise<Record<string, 'evet' | 'hayir'>> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      return await verifyBatchWithOpenAI(args);
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

type AppStoreIapLocalizationLike = {
  locale: string;
  name?: string;
  description?: string;
};

type AppStoreIapDetailLike = {
  productId: string;
  inAppPurchaseType?: string;
  localizations: AppStoreIapLocalizationLike[];
};

type PlayStoreIapListingLike = {
  locale: string;
  title?: string;
  description?: string;
  benefits?: string[];
};

type PlayStoreIapDetailLike = {
  productId: string;
  purchaseType?: string;
  listings: PlayStoreIapListingLike[];
};

function normalizeLocaleForMatch(locale: string): string {
  return toCanonical(locale || '').toLowerCase();
}

function localeLanguage(locale: string): string {
  const normalized = normalizeLocaleForMatch(locale);
  return normalized.split('-')[0] ?? '';
}

function findLocaleEntry<T extends { locale: string }>(entries: T[], locale: string): T | undefined {
  const target = normalizeLocaleForMatch(locale);
  if (!target) return undefined;

  const exact = entries.find((entry) => normalizeLocaleForMatch(entry.locale) === target);
  if (exact) return exact;

  const targetLang = localeLanguage(target);
  if (!targetLang) return undefined;
  const languageMatches = entries.filter((entry) => localeLanguage(entry.locale) === targetLang);
  if (languageMatches.length === 1) return languageMatches[0];
  return undefined;
}

function parseIapDetailJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function parseAppStoreIapDetail(detail: unknown): AppStoreIapDetailLike | null {
  if (!detail || typeof detail !== 'object') return null;
  const row = detail as Record<string, unknown>;
  const productId = typeof row.productId === 'string' ? row.productId.trim() : '';
  if (!productId) return null;

  const localizationsRaw = Array.isArray(row.localizations) ? row.localizations : [];
  const localizations: AppStoreIapLocalizationLike[] = [];
  for (const item of localizationsRaw) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as Record<string, unknown>;
    const locale = typeof entry.locale === 'string' ? toCanonical(entry.locale) : '';
    if (!locale) continue;
    localizations.push({
      locale,
      name: typeof entry.name === 'string' ? entry.name : undefined,
      description: typeof entry.description === 'string' ? entry.description : undefined,
    });
  }

  return {
    productId,
    inAppPurchaseType: typeof row.inAppPurchaseType === 'string' ? row.inAppPurchaseType : undefined,
    localizations,
  };
}

function parsePlayStoreIapDetail(detail: unknown): PlayStoreIapDetailLike | null {
  if (!detail || typeof detail !== 'object') return null;
  const row = detail as Record<string, unknown>;
  const productId = typeof row.productId === 'string' ? row.productId.trim() : '';
  if (!productId) return null;

  const listingsRaw = Array.isArray(row.listings) ? row.listings : [];
  const listings: PlayStoreIapListingLike[] = [];
  for (const item of listingsRaw) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as Record<string, unknown>;
    const locale = typeof entry.locale === 'string' ? toCanonical(entry.locale) : '';
    if (!locale) continue;
    listings.push({
      locale,
      title: typeof entry.title === 'string' ? entry.title : undefined,
      description: typeof entry.description === 'string' ? entry.description : undefined,
      benefits: Array.isArray(entry.benefits)
        ? entry.benefits
            .filter((value): value is string => typeof value === 'string')
            .map((value) => value.trim())
            .filter((value) => value.length > 0)
        : undefined,
    });
  }

  return {
    productId,
    purchaseType: typeof row.purchaseType === 'string' ? row.purchaseType : undefined,
    listings,
  };
}

export const registerTranslationRoutes: RouteRegistrar = (router, ctx) => {
  router.post('/api/apps/:id/generate-iap-translations', async (req, res, next) => {
    try {
      const appId = parseId(req.params.id);
      const appRow = mustGetApp(ctx.repo, appId);
      const body = (req.body ?? {}) as Record<string, unknown>;
      const store = parseStoreId(
        (typeof req.query.store === 'string' ? req.query.store : undefined) ??
          (typeof body.store === 'string'
            ? (body.store as string)
            : '')
      );
      const sourceLocale = toCanonical(appRow.sourceLocale || 'en-US') || 'en-US';
      let aiConfig;
      try {
        aiConfig = resolveAIConfig(ctx.env, body.provider);
      } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
        return;
      }
      const aiProviderLabel = getAIProviderLabel(aiConfig.provider === 'anthropic' ? 'anthropic' : 'openai');

      const iapRows = ctx.repo.listStoreIaps(appId, store);
      const storeLocales = ctx.repo
        .listStoreLocales(appId)
        .filter((row) => row.store === store)
        .map((row) => toCanonical(row.locale))
        .filter((locale) => locale.length > 0 && locale !== sourceLocale);

      res.setHeader('Content-Type', 'application/x-ndjson');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Transfer-Encoding', 'chunked');
      res.flushHeaders();

      const writeLine = (data: Record<string, unknown>) => {
        res.write(JSON.stringify(data) + '\n');
      };

      writeLine({
        type: 'start',
        store,
        sourceLocale,
        provider: aiConfig.provider === 'anthropic' ? 'anthropic' : 'openai',
        providerLabel: aiProviderLabel,
        totalIaps: iapRows.length,
        totalLocales: storeLocales.length,
      });

      if (iapRows.length === 0) {
        writeLine({ type: 'done', translatedLocales: 0, changedFields: 0 });
        res.end();
        return;
      }

      const DELAY_BETWEEN_CALLS_MS = 500;
      const storeName = store === 'app_store' ? 'App Store IAP' : 'Play Store IAP';
      let translatedLocaleCount = 0;
      let changedFieldCount = 0;

      for (const row of iapRows) {
        const detail = parseIapDetailJson(row.detailJson);
        if (store === 'app_store') {
          const parsed = parseAppStoreIapDetail(detail);
          if (!parsed) {
            writeLine({ type: 'iap_skip', productId: row.productId, reason: 'IAP detayı parse edilemedi.' });
            continue;
          }

          const sourceEntry = findLocaleEntry(parsed.localizations, sourceLocale);
          const sourceName = sourceEntry?.name?.trim() || '';
          const sourceDescription = sourceEntry?.description?.trim() || '';

          if (!sourceName && !sourceDescription) {
            writeLine({
              type: 'iap_skip',
              productId: parsed.productId,
              iapType: parsed.inAppPurchaseType,
              reason: `Source locale (${sourceLocale}) için name/description bulunamadı.`,
            });
            continue;
          }

          const targetLocaleSet = new Set<string>(storeLocales);
          for (const localization of parsed.localizations) {
            const locale = toCanonical(localization.locale);
            if (locale && locale !== sourceLocale) targetLocaleSet.add(locale);
          }
          const targetLocales = Array.from(targetLocaleSet).sort((a, b) => a.localeCompare(b));

          writeLine({
            type: 'iap_start',
            productId: parsed.productId,
            iapType: parsed.inAppPurchaseType,
            localeCount: targetLocales.length,
          });

          for (const targetLocale of targetLocales) {
            const targetEntry = findLocaleEntry(parsed.localizations, targetLocale);
            const localeFields: Array<{ field: string; value: string; oldValue: string }> = [];

            if (sourceName) {
              try {
                const translated = await translateWithRetry({
                  config: aiConfig,
                  sourceLocale,
                  targetLocale,
                  text: sourceName,
                  fieldName: 'name',
                  storeName,
                });
                const oldValue = targetEntry?.name ?? '';
                if (translated.trim() !== oldValue.trim()) {
                  localeFields.push({ field: 'name', value: translated, oldValue });
                  changedFieldCount += 1;
                }
                writeLine({
                  type: 'progress',
                  productId: parsed.productId,
                  iapType: parsed.inAppPurchaseType,
                  locale: targetLocale,
                  field: 'name',
                  status: 'translated',
                });
              } catch (error) {
                writeLine({
                  type: 'error',
                  productId: parsed.productId,
                  iapType: parsed.inAppPurchaseType,
                  locale: targetLocale,
                  field: 'name',
                  error: error instanceof Error ? error.message : String(error),
                });
              }
              await new Promise((resolveDelay) => setTimeout(resolveDelay, DELAY_BETWEEN_CALLS_MS));
            }

            if (sourceDescription) {
              try {
                const translated = await translateWithRetry({
                  config: aiConfig,
                  sourceLocale,
                  targetLocale,
                  text: sourceDescription,
                  fieldName: 'description',
                  storeName,
                });
                const oldValue = targetEntry?.description ?? '';
                if (translated.trim() !== oldValue.trim()) {
                  localeFields.push({ field: 'description', value: translated, oldValue });
                  changedFieldCount += 1;
                }
                writeLine({
                  type: 'progress',
                  productId: parsed.productId,
                  iapType: parsed.inAppPurchaseType,
                  locale: targetLocale,
                  field: 'description',
                  status: 'translated',
                });
              } catch (error) {
                writeLine({
                  type: 'error',
                  productId: parsed.productId,
                  iapType: parsed.inAppPurchaseType,
                  locale: targetLocale,
                  field: 'description',
                  error: error instanceof Error ? error.message : String(error),
                });
              }
              await new Promise((resolveDelay) => setTimeout(resolveDelay, DELAY_BETWEEN_CALLS_MS));
            }

            if (localeFields.length > 0) {
              translatedLocaleCount += 1;
              writeLine({
                type: 'locale_done',
                productId: parsed.productId,
                iapType: parsed.inAppPurchaseType,
                locale: targetLocale,
                fields: localeFields,
              });
            } else {
              writeLine({
                type: 'locale_skip',
                productId: parsed.productId,
                iapType: parsed.inAppPurchaseType,
                locale: targetLocale,
                reason: 'Fark yok',
              });
            }
          }
          continue;
        }

        const parsed = parsePlayStoreIapDetail(detail);
        if (!parsed) {
          writeLine({ type: 'iap_skip', productId: row.productId, reason: 'IAP detayı parse edilemedi.' });
          continue;
        }

        const sourceEntry = findLocaleEntry(parsed.listings, sourceLocale);
        const sourceTitle = sourceEntry?.title?.trim() || '';
        const sourceDescription = sourceEntry?.description?.trim() || '';
        const sourceBenefits = (sourceEntry?.benefits ?? []).map((item) => item.trim()).filter((item) => item.length > 0);

        if (!sourceTitle && !sourceDescription && sourceBenefits.length === 0) {
          writeLine({
            type: 'iap_skip',
            productId: parsed.productId,
            iapType: parsed.purchaseType,
            reason: `Source locale (${sourceLocale}) için title/description/benefits bulunamadı.`,
          });
          continue;
        }

        const targetLocaleSet = new Set<string>(storeLocales);
        for (const listing of parsed.listings) {
          const locale = toCanonical(listing.locale);
          if (locale && locale !== sourceLocale) targetLocaleSet.add(locale);
        }
        const targetLocales = Array.from(targetLocaleSet).sort((a, b) => a.localeCompare(b));

        writeLine({
          type: 'iap_start',
          productId: parsed.productId,
          iapType: parsed.purchaseType,
          localeCount: targetLocales.length,
        });

        for (const targetLocale of targetLocales) {
          const targetEntry = findLocaleEntry(parsed.listings, targetLocale);
          const localeFields: Array<{ field: string; value: string; oldValue: string }> = [];

          if (sourceTitle) {
            try {
              const translated = await translateWithRetry({
                config: aiConfig,
                sourceLocale,
                targetLocale,
                text: sourceTitle,
                fieldName: 'title',
                storeName,
              });
              const oldValue = targetEntry?.title ?? '';
              if (translated.trim() !== oldValue.trim()) {
                localeFields.push({ field: 'title', value: translated, oldValue });
                changedFieldCount += 1;
              }
              writeLine({
                type: 'progress',
                productId: parsed.productId,
                iapType: parsed.purchaseType,
                locale: targetLocale,
                field: 'title',
                status: 'translated',
              });
            } catch (error) {
              writeLine({
                type: 'error',
                productId: parsed.productId,
                iapType: parsed.purchaseType,
                locale: targetLocale,
                field: 'title',
                error: error instanceof Error ? error.message : String(error),
              });
            }
            await new Promise((resolveDelay) => setTimeout(resolveDelay, DELAY_BETWEEN_CALLS_MS));
          }

          if (sourceDescription) {
            try {
              const translated = await translateWithRetry({
                config: aiConfig,
                sourceLocale,
                targetLocale,
                text: sourceDescription,
                fieldName: 'description',
                storeName,
              });
              const oldValue = targetEntry?.description ?? '';
              if (translated.trim() !== oldValue.trim()) {
                localeFields.push({ field: 'description', value: translated, oldValue });
                changedFieldCount += 1;
              }
              writeLine({
                type: 'progress',
                productId: parsed.productId,
                iapType: parsed.purchaseType,
                locale: targetLocale,
                field: 'description',
                status: 'translated',
              });
            } catch (error) {
              writeLine({
                type: 'error',
                productId: parsed.productId,
                iapType: parsed.purchaseType,
                locale: targetLocale,
                field: 'description',
                error: error instanceof Error ? error.message : String(error),
              });
            }
            await new Promise((resolveDelay) => setTimeout(resolveDelay, DELAY_BETWEEN_CALLS_MS));
          }

          if (sourceBenefits.length > 0) {
            try {
              const translatedBenefits: string[] = [];
              for (const benefit of sourceBenefits) {
                const translated = await translateWithRetry({
                  config: aiConfig,
                  sourceLocale,
                  targetLocale,
                  text: benefit,
                  fieldName: 'benefits',
                  storeName,
                });
                translatedBenefits.push(translated);
                await new Promise((resolveDelay) => setTimeout(resolveDelay, DELAY_BETWEEN_CALLS_MS));
              }
              const newValue = translatedBenefits.join('\n');
              const oldValue = (targetEntry?.benefits ?? []).join('\n');
              if (newValue.trim() !== oldValue.trim()) {
                localeFields.push({ field: 'benefits', value: newValue, oldValue });
                changedFieldCount += 1;
              }
              writeLine({
                type: 'progress',
                productId: parsed.productId,
                iapType: parsed.purchaseType,
                locale: targetLocale,
                field: 'benefits',
                status: 'translated',
              });
            } catch (error) {
              writeLine({
                type: 'error',
                productId: parsed.productId,
                iapType: parsed.purchaseType,
                locale: targetLocale,
                field: 'benefits',
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }

          if (localeFields.length > 0) {
            translatedLocaleCount += 1;
            writeLine({
              type: 'locale_done',
              productId: parsed.productId,
              iapType: parsed.purchaseType,
              locale: targetLocale,
              fields: localeFields,
            });
          } else {
            writeLine({
              type: 'locale_skip',
              productId: parsed.productId,
              iapType: parsed.purchaseType,
              locale: targetLocale,
              reason: 'Fark yok',
            });
          }
        }
      }

      writeLine({
        type: 'done',
        translatedLocales: translatedLocaleCount,
        changedFields: changedFieldCount,
      });
      res.end();
    } catch (error) {
      if (!res.headersSent) {
        next(error);
      } else {
        try {
          res.write(JSON.stringify({ type: 'fatal', error: error instanceof Error ? error.message : String(error) }) + '\n');
        } catch {
          // Ignore write errors while shutting down stream
        }
        res.end();
      }
    }
  });

  router.post('/api/apps/:id/generate-translations', async (req, res, next) => {
    try {
      const appId = parseId(req.params.id);
      const appRow = mustGetApp(ctx.repo, appId);
      const store = parseStoreId(
        (typeof req.query.store === 'string' ? req.query.store : undefined) ??
          (typeof (req.body as Record<string, unknown>)?.store === 'string'
            ? ((req.body as Record<string, unknown>).store as string)
            : '')
      );

      const body = req.body as Record<string, unknown>;
      const requestedLocales = Array.isArray(body.locales)
        ? (body.locales as unknown[]).filter((locale): locale is string => typeof locale === 'string')
        : null;
      const masterPrompt = typeof body.masterPrompt === 'string' ? body.masterPrompt.trim() : '';
      const verifyTranslations = parseBoolean(body.verify, false);
      const mode = body.mode === 'update_existing' ? 'update_existing' : 'generate_missing';
      const requestedFields = Array.isArray(body.fields)
        ? (body.fields as unknown[]).filter((field): field is string => typeof field === 'string')
        : null;
      let aiConfig;
      try {
        aiConfig = resolveAIConfig(ctx.env, body.provider);
      } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
        return;
      }
      const aiProvider = aiConfig.provider === 'anthropic' ? 'anthropic' : 'openai';
      const aiProviderLabel = getAIProviderLabel(aiProvider);

      const sourceLocale = appRow.sourceLocale || 'en-US';
      const sourceDetailRow = ctx.repo.getStoreLocaleDetail(appId, store, sourceLocale);
      if (!sourceDetailRow) {
        res.status(400).json({
          error: `Source locale (${sourceLocale}) detail not found for ${store}. Sync first.`,
        });
        return;
      }
      const sourceDetail = JSON.parse(sourceDetailRow.detailJson) as Record<string, unknown>;

      const translatableFields = getTranslatableFields(store);
      const sourceTexts = new Map<string, string>();
      for (const field of translatableFields) {
        const value = extractFieldValue(sourceDetail, store, field.fieldId);
        if (value.trim()) {
          sourceTexts.set(field.fieldId, value);
        }
      }

      if (sourceTexts.size === 0) {
        res.status(400).json({ error: 'Source locale has no text to translate.' });
        return;
      }

      let targetLocales: string[];
      if (mode === 'update_existing') {
        const existingRows = ctx.repo.listStoreLocales(appId).filter((row) => row.store === store);
        targetLocales = existingRows
          .map((row) => row.locale)
          .filter((locale) => locale !== sourceLocale)
          .sort((a, b) => a.localeCompare(b));
      } else {
        const allSupportedLocales = store === 'app_store' ? APP_STORE_LOCALES : PLAY_STORE_LOCALES;
        targetLocales = allSupportedLocales
          .filter((locale) => locale !== sourceLocale)
          .sort((a, b) => a.localeCompare(b));
      }

      if (requestedLocales && requestedLocales.length > 0) {
        const requestedSet = new Set(requestedLocales);
        targetLocales = targetLocales.filter((locale) => requestedSet.has(locale));
      }

      if (targetLocales.length === 0) {
        res.status(400).json({ error: 'No target locales to translate.' });
        return;
      }

      const activeFields = requestedFields && requestedFields.length > 0
        ? translatableFields.filter((field) => requestedFields.includes(field.fieldId) && sourceTexts.has(field.fieldId))
        : translatableFields.filter((field) => sourceTexts.has(field.fieldId));

      if (activeFields.length === 0) {
        res.status(400).json({ error: 'No translatable fields selected.' });
        return;
      }

      const storeName = STORE_RULES[store].displayName;
      const titleFieldId = store === 'app_store' ? 'appName' : 'title';

      type LocaleWork = {
        locale: string;
        workFields: string[];
        targetDetail: Record<string, unknown> | null;
      };

      const localeWorkList: LocaleWork[] = [];
      for (const targetLocale of targetLocales) {
        const targetDetailRow = ctx.repo.getStoreLocaleDetail(appId, store, targetLocale);
        const targetDetail = targetDetailRow
          ? (JSON.parse(targetDetailRow.detailJson) as Record<string, unknown>)
          : null;

        if (mode === 'update_existing') {
          const workFields = activeFields.map((field) => field.fieldId);
          localeWorkList.push({ locale: targetLocale, workFields, targetDetail });
        } else {
          const workFields: string[] = [];
          for (const field of activeFields) {
            const existingValue = targetDetail
              ? extractFieldValue(targetDetail, store, field.fieldId).trim()
              : '';
            if (!existingValue) {
              workFields.push(field.fieldId);
            }
          }
          if (workFields.length > 0) {
            localeWorkList.push({ locale: targetLocale, workFields, targetDetail });
          }
        }
      }

      if (localeWorkList.length === 0) {
        res.status(400).json({ error: 'All target locales already have translations. No missing fields.' });
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
        totalLocales: localeWorkList.length,
        sourceLocale,
        store,
        provider: aiProvider,
        providerLabel: aiProviderLabel,
      });

      const TRANSLATE_CONCURRENCY = store === 'play_store' ? 4 : 3;
      const VERIFY_CONCURRENCY = store === 'play_store' ? 4 : 3;
      const DELAY_BETWEEN_CALLS_MS = 75;
      const existingLocaleSet = new Set(
        ctx.repo
          .listStoreLocales(appId)
          .filter((row) => row.store === store)
          .map((row) => row.locale)
      );

      type CompletedLocale = {
        locale: string;
        translatedFields: Array<{ field: string; value: string; oldValue: string }>;
        appTitle?: string;
      };

      const completedLocales = (
        await mapWithConcurrency(localeWorkList, TRANSLATE_CONCURRENCY, async (work): Promise<CompletedLocale | null> => {
          const workFieldDefs = activeFields.filter((field) => work.workFields.includes(field.fieldId));
          if (workFieldDefs.length === 0) return null;

          const oldValueByField = new Map<string, string>();
          for (const field of workFieldDefs) {
            oldValueByField.set(
              field.fieldId,
              work.targetDetail ? extractFieldValue(work.targetDetail, store, field.fieldId) : ''
            );
          }

          const existingTitle = work.targetDetail
            ? extractFieldValue(work.targetDetail, store, titleFieldId).trim()
            : '';
          const fieldResults = new Map<string, string>();
          const titleFieldDef = workFieldDefs.find((field) => field.fieldId === titleFieldId);
          const contentFieldDefs = workFieldDefs.filter((field) => field.fieldId !== titleFieldId);

          const recordFieldValue = (
            field: TranslationField,
            value: string,
            status: 'translated' | 'shortened'
          ): { accepted: boolean; overLimit: boolean } => {
            const normalizedValue = value.trim();
            if (!normalizedValue) {
              writeLine({
                type: 'error',
                locale: work.locale,
                field: field.fieldId,
                error: `${status === 'translated' ? 'Translate' : 'Shorten'} response missing field text.`,
              });
              return { accepted: false, overLimit: false };
            }

            const len = measureFieldLength(normalizedValue, field.unit);
            writeLine({
              type: 'progress',
              locale: work.locale,
              field: field.fieldId,
              status,
              chars: len,
              maxChars: field.maxChars,
            });

            if (len > field.maxChars) {
              return { accepted: false, overLimit: true };
            }

            fieldResults.set(field.fieldId, normalizedValue);
            return { accepted: true, overLimit: false };
          };

          if (titleFieldDef) {
            let translatedTitle = '';
            try {
              translatedTitle = await translateWithRetry({
                config: aiConfig,
                sourceLocale,
                targetLocale: work.locale,
                text: sourceTexts.get(titleFieldDef.fieldId)!,
                fieldName: titleFieldDef.fieldId,
                maxLength: titleFieldDef.maxChars,
                lengthUnit: titleFieldDef.unit === 'bytes' ? 'bytes' : 'characters',
                storeName,
                masterPrompt: masterPrompt || undefined,
              });
            } catch (error) {
              if ((error as { isQuotaExceeded?: boolean }).isQuotaExceeded) {
                throw error;
              }
              const message = error instanceof Error ? error.message : String(error);
              writeLine({
                type: 'locale_skip',
                locale: work.locale,
                reason: `Title translation failed: ${message}`,
              });
              return null;
            } finally {
              await sleep(DELAY_BETWEEN_CALLS_MS);
            }

            const titleResult = recordFieldValue(titleFieldDef, translatedTitle, 'translated');
            if (titleResult.overLimit) {
              try {
                const shortenedTitle = await shortenWithRetry({
                  config: aiConfig,
                  targetLocale: work.locale,
                  text: translatedTitle,
                  fieldName: titleFieldDef.fieldId,
                  maxLength: titleFieldDef.maxChars,
                  lengthUnit: titleFieldDef.unit === 'bytes' ? 'bytes' : 'characters',
                  storeName,
                  masterPrompt: masterPrompt || undefined,
                });

                const shortenedResult = recordFieldValue(titleFieldDef, shortenedTitle, 'shortened');
                if (!shortenedResult.accepted) {
                  const shortenedLen = measureFieldLength(shortenedTitle.trim(), titleFieldDef.unit);
                  if (shortenedResult.overLimit) {
                    writeLine({
                      type: 'error',
                      locale: work.locale,
                      field: titleFieldDef.fieldId,
                      error: `Still over limit after shortening (${shortenedLen}/${titleFieldDef.maxChars}).`,
                    });
                  }
                  writeLine({
                    type: 'locale_skip',
                    locale: work.locale,
                    reason: 'Localized title could not be finalized within limits.',
                  });
                  return null;
                }
              } catch (error) {
                if ((error as { isQuotaExceeded?: boolean }).isQuotaExceeded) {
                  throw error;
                }
                const message = error instanceof Error ? error.message : String(error);
                writeLine({
                  type: 'locale_skip',
                  locale: work.locale,
                  reason: `Title shortening failed: ${message}`,
                });
                return null;
              } finally {
                await sleep(DELAY_BETWEEN_CALLS_MS);
              }
            } else if (!titleResult.accepted) {
              writeLine({
                type: 'locale_skip',
                locale: work.locale,
                reason: 'Localized title response was empty.',
              });
              return null;
            }
          }

          const localizedTitle = fieldResults.get(titleFieldId) ?? (existingTitle || undefined);

          if (contentFieldDefs.length > 0) {
            let translatedMap: Record<string, string> = {};
            try {
              translatedMap = await translateBatchWithRetry({
                config: aiConfig,
                sourceLocale,
                targetLocale: work.locale,
                fields: contentFieldDefs.map((field) => ({
                  key: field.fieldId,
                  text: sourceTexts.get(field.fieldId)!,
                  maxLength: field.maxChars,
                  lengthUnit: field.unit === 'bytes' ? 'bytes' : 'characters',
                })),
                storeName,
                appTitle: localizedTitle,
                masterPrompt: masterPrompt || undefined,
              });
            } catch (error) {
              if ((error as { isQuotaExceeded?: boolean }).isQuotaExceeded) {
                throw error;
              }
              const message = error instanceof Error ? error.message : String(error);
              if (fieldResults.size === 0) {
                writeLine({ type: 'locale_skip', locale: work.locale, reason: message });
                return null;
              }
              for (const field of contentFieldDefs) {
                writeLine({
                  type: 'error',
                  locale: work.locale,
                  field: field.fieldId,
                  error: message,
                });
              }
              translatedMap = {};
            } finally {
              await sleep(DELAY_BETWEEN_CALLS_MS);
            }

            const overLimitDefs: TranslationField[] = [];

            for (const field of contentFieldDefs) {
              const translated = translatedMap[field.fieldId]?.trim() ?? '';
              if (!translated) {
                if (Object.prototype.hasOwnProperty.call(translatedMap, field.fieldId)) {
                  writeLine({
                    type: 'error',
                    locale: work.locale,
                    field: field.fieldId,
                    error: 'Batch translate response missing field text.',
                  });
                }
                continue;
              }

              const fieldResult = recordFieldValue(field, translated, 'translated');
              if (fieldResult.overLimit) {
                overLimitDefs.push(field);
              }
            }

            if (overLimitDefs.length > 0) {
              try {
                const shortenedMap = await shortenBatchWithRetry({
                  config: aiConfig,
                  targetLocale: work.locale,
                  fields: overLimitDefs.map((field) => ({
                    key: field.fieldId,
                    text: translatedMap[field.fieldId] ?? '',
                    maxLength: field.maxChars,
                    lengthUnit: field.unit === 'bytes' ? 'bytes' : 'characters',
                  })),
                  storeName,
                  masterPrompt: masterPrompt || undefined,
                });

                for (const field of overLimitDefs) {
                  const shortened = shortenedMap[field.fieldId]?.trim() ?? '';
                  const shortenedResult = recordFieldValue(field, shortened, 'shortened');
                  if (!shortenedResult.accepted && shortenedResult.overLimit) {
                    const shortenedLen = measureFieldLength(shortened, field.unit);
                    writeLine({
                      type: 'error',
                      locale: work.locale,
                      field: field.fieldId,
                      error: `Still over limit after shortening (${shortenedLen}/${field.maxChars}). Skipped.`,
                    });
                  }
                }
              } catch (error) {
                if ((error as { isQuotaExceeded?: boolean }).isQuotaExceeded) {
                  throw error;
                }
                const message = error instanceof Error ? error.message : String(error);
                for (const field of overLimitDefs) {
                  writeLine({
                    type: 'error',
                    locale: work.locale,
                    field: field.fieldId,
                    error: message,
                  });
                }
              } finally {
                await sleep(DELAY_BETWEEN_CALLS_MS);
              }
            }
          }

          const translatedFields = work.workFields
            .map((fieldId) => {
              const value = fieldResults.get(fieldId);
              if (!value) return null;
              return {
                field: fieldId,
                value,
                oldValue: oldValueByField.get(fieldId) ?? '',
              };
            })
            .filter(
              (
                entry
              ): entry is {
                field: string;
                value: string;
                oldValue: string;
              } => Boolean(entry)
            );

          if (translatedFields.length === 0) {
            writeLine({ type: 'locale_skip', locale: work.locale, reason: 'No valid fields translated' });
            return null;
          }

          const appTitle =
            fieldResults.get(titleFieldId) ??
            (existingTitle || undefined);

          writeLine({
            type: 'locale_done',
            locale: work.locale,
            isNewLocale: !existingLocaleSet.has(work.locale),
            fields: translatedFields.map((field) => ({
              field: field.field,
              value: field.value,
              oldValue: field.oldValue,
            })),
          });

          return {
            locale: work.locale,
            translatedFields,
            appTitle,
          };
        })
      ).filter((entry): entry is CompletedLocale => Boolean(entry));

      const translatedCount = completedLocales.length;

      if (verifyTranslations && translatedCount > 0) {
        const verifyChecks = completedLocales
          .map((entry) => ({
            locale: entry.locale,
            appTitle: entry.appTitle,
            fields: entry.translatedFields
              .map((field) => {
                const sourceText = sourceTexts.get(field.field) ?? '';
                if (!sourceText.trim() || !field.value.trim()) return null;
                return {
                  key: field.field,
                  sourceText,
                  translatedText: field.value,
                };
              })
              .filter(
                (
                  field
                ): field is {
                  key: string;
                  sourceText: string;
                  translatedText: string;
                } => Boolean(field)
              ),
          }))
          .filter((entry) => entry.fields.length > 0);

        const verifyCheckCount = verifyChecks.reduce((sum, entry) => sum + entry.fields.length, 0);

        writeLine({ type: 'verify_start', totalChecks: verifyCheckCount });

        const verifyFailed = (
          await mapWithConcurrency(verifyChecks, VERIFY_CONCURRENCY, async (entry) => {
            try {
              const verdicts = await verifyBatchWithRetry({
                config: aiConfig,
                sourceLocale,
                targetLocale: entry.locale,
                fields: entry.fields,
                storeName,
                appTitle: entry.appTitle,
                masterPrompt: masterPrompt || undefined,
              });

              const failures: Array<{
                locale: string;
                field: string;
                reason: string;
                answer?: string;
              }> = [];

              for (const field of entry.fields) {
                if (verdicts[field.key] === 'evet') continue;
                failures.push({
                  locale: entry.locale,
                  field: field.key,
                  reason: 'AI sonucu hayir',
                  answer: verdicts[field.key],
                });
              }

                return failures;
            } catch (error) {
              if ((error as { isQuotaExceeded?: boolean }).isQuotaExceeded) {
                throw error;
              }
              const message = error instanceof Error ? error.message : String(error);
              return entry.fields.map((field) => ({
                locale: entry.locale,
                field: field.key,
                reason: message,
              }));
            } finally {
              await sleep(DELAY_BETWEEN_CALLS_MS);
            }
          })
        ).flat();

        writeLine({
          type: 'verify_done',
          totalChecks: verifyCheckCount,
          failedCount: verifyFailed.length,
          failed: verifyFailed,
        });
      }

      writeLine({ type: 'done', translated: translatedCount });
      res.end();
    } catch (error) {
      if (!res.headersSent) {
        next(error);
      } else {
        try {
          res.write(JSON.stringify({ type: 'fatal', error: error instanceof Error ? error.message : String(error) }) + '\n');
        } catch {
          // ignore write errors
        }
        res.end();
      }
    }
  });
};
