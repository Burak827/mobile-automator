#!/usr/bin/env node
import { Command } from "commander";
import { readFile } from "fs/promises";
import { createInterface } from "node:readline/promises";
import { AscClient } from "./ascClient.js";
import { GpcClient } from "./gpcClient.js";
import {
  loadEnvConfig,
  parseCommaList,
  requireValue,
} from "./config.js";
import {
  AppStoreVersionAttributes,
  AppStoreVersionLocalizationAttributes,
  AscListResponse,
} from "./ascTypes.js";
import { GpcListing, GpcListingsListResponse } from "./gpcTypes.js";
import { shortenWithOpenAI, translateWithOpenAI } from "./translate.js";
import { toCanonical, toStoreLocale } from "./web/localeCatalog.js";

type LocalizationField =
  | "description"
  | "promotionalText"
  | "whatsNew"
  | "keywords";

const program = new Command();
program
  .name("mobile-auto")
  .description("App Store Connect & Google Play localization automation")
  .showHelpAfterError();

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function uniqueList<T extends string>(values: T[]): T[] {
  const seen = new Set<T>();
  const result: T[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function resolveLimit(value: string | undefined, fallback: number): number | undefined {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.floor(parsed);
}

function parseBoolean(value?: string): boolean | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(normalized)) return true;
  if (["0", "false", "no", "n"].includes(normalized)) return false;
  return undefined;
}

function resolveNonNegativeInt(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid number value: ${value}`);
  }
  return Math.floor(parsed);
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function measureLocalizationFieldLength(
  field: LocalizationField,
  value: string
): number {
  if (field === "keywords") return utf8ByteLength(value);
  return value.length;
}

function localizationFieldLengthUnit(field: LocalizationField): "characters" | "bytes" {
  if (field === "keywords") return "bytes";
  return "characters";
}

const DEFAULT_FIELDS: LocalizationField[] = [
  "description",
  "promotionalText",
  "whatsNew",
  "keywords",
];

const FIELD_LABELS: Record<LocalizationField, string> = {
  description: "description",
  promotionalText: "promotional text",
  whatsNew: "what's new",
  keywords: "keywords",
};

const DEFAULT_LIMITS: Record<LocalizationField, number> = {
  description: 4000,
  promotionalText: 170,
  whatsNew: 4000,
  keywords: 100,
};

function parseFields(value?: string): LocalizationField[] {
  const items = parseCommaList(value);
  if (items.length === 0) return DEFAULT_FIELDS.slice();
  const fields = items.map((item) => item as LocalizationField);
  const invalid = fields.filter(
    (field) =>
      field !== "description" &&
      field !== "promotionalText" &&
      field !== "whatsNew" &&
      field !== "keywords"
  );
  if (invalid.length > 0) {
    throw new Error(
      `Unsupported field(s): ${invalid.join(", ")}. Use description, promotionalText, whatsNew, keywords.`
    );
  }
  return uniqueList(fields);
}

function parseVersionParts(versionString?: string): number[] | null {
  if (!versionString) return null;
  const parts = versionString.split(".");
  if (parts.some((part) => !/^\d+$/.test(part))) return null;
  return parts.map((part) => Number(part));
}

function compareVersionStrings(a?: string, b?: string): number | null {
  const aParts = parseVersionParts(a);
  const bParts = parseVersionParts(b);
  if (!aParts || !bParts) return null;
  const maxLen = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < maxLen; i += 1) {
    const aVal = aParts[i] ?? 0;
    const bVal = bParts[i] ?? 0;
    if (aVal === bVal) continue;
    return aVal > bVal ? 1 : -1;
  }
  return 0;
}

function resolveAscClient() {
  const env = loadEnvConfig();
  const issuerId = requireValue(env.ascIssuerId, "ASC_ISSUER_ID");
  const keyId = requireValue(env.ascKeyId, "ASC_KEY_ID");
  const privateKeyPath = requireValue(
    env.ascPrivateKeyPath,
    "ASC_PRIVATE_KEY_PATH"
  );
  return new AscClient({
    issuerId,
    keyId,
    privateKeyPath,
    baseUrl: env.ascBaseUrl,
  });
}

async function resolveVersionId(options: {
  client: AscClient;
  appId: string;
  versionString: string;
  platform?: string;
}): Promise<string> {
  const response = await options.client.get<
    AscListResponse<AppStoreVersionAttributes>
  >(`/v1/apps/${options.appId}/appStoreVersions`, {
    "filter[versionString]": [options.versionString],
    "filter[platform]": options.platform ? [options.platform] : undefined,
    "fields[appStoreVersions]": ["versionString", "appVersionState", "platform"],
    limit: 200,
  });

  if (response.data.length === 0) {
    throw new Error(
      `No App Store versions found for versionString=${options.versionString}`
    );
  }

  if (response.data.length > 1) {
    throw new Error(
      `Multiple versions matched versionString=${options.versionString}. Use --version-id to be explicit.`
    );
  }

  return response.data[0].id;
}

async function resolveLatestVersion(options: {
  client: AscClient;
  appId: string;
  platform?: string;
}): Promise<{ id: string; attributes?: AppStoreVersionAttributes }> {
  const response = await options.client.get<
    AscListResponse<AppStoreVersionAttributes>
  >(`/v1/apps/${options.appId}/appStoreVersions`, {
    "filter[platform]": options.platform ? [options.platform] : undefined,
    "fields[appStoreVersions]": [
      "versionString",
      "appVersionState",
      "platform",
      "createdDate",
    ],
    limit: 200,
  });

  if (response.data.length === 0) {
    throw new Error("No App Store versions found to resolve latest version.");
  }

  const candidates = response.data.map((item) => ({
    id: item.id,
    attributes: item.attributes ?? {},
  }));

  const withCreated = candidates.filter(
    (item) =>
      item.attributes?.createdDate &&
      !Number.isNaN(Date.parse(item.attributes.createdDate))
  );

  if (withCreated.length > 0) {
    let latest = withCreated[0];
    for (const candidate of withCreated.slice(1)) {
      const latestDate = Date.parse(latest.attributes?.createdDate ?? "");
      const candidateDate = Date.parse(candidate.attributes?.createdDate ?? "");
      if (candidateDate > latestDate) {
        latest = candidate;
      }
    }
    return latest;
  }

  let latest = candidates[0];
  for (const candidate of candidates.slice(1)) {
    const comparison = compareVersionStrings(
      candidate.attributes?.versionString,
      latest.attributes?.versionString
    );
    if (comparison !== null && comparison > 0) {
      latest = candidate;
    }
  }

  return latest;
}

program
  .command("list-versions")
  .description("List App Store versions for an app")
  .option("--app-id <id>", "App Store Connect app id")
  .option("--platform <platform>", "Platform filter (IOS, MAC_OS, TV_OS, VISION_OS)")
  .action(async (opts) => {
    try {
      const env = loadEnvConfig();
      const client = resolveAscClient();
      const appId = opts.appId ?? env.ascAppId;
      if (!appId) throw new Error("Missing app id. Use --app-id or ASC_APP_ID");

      const platform = opts.platform ?? env.ascPlatform;
      const response = await client.get<
        AscListResponse<AppStoreVersionAttributes>
      >(`/v1/apps/${appId}/appStoreVersions`, {
        "filter[platform]": platform ? [platform] : undefined,
        "fields[appStoreVersions]": [
          "versionString",
          "appVersionState",
          "platform",
          "createdDate",
        ],
        limit: 200,
      });

      console.log("id\tversion\tstate\tplatform\tcreatedDate");
      for (const item of response.data) {
        const attrs = item.attributes ?? {};
        console.log(
          `${item.id}\t${attrs.versionString ?? ""}\t${
            attrs.appVersionState ?? ""
          }\t${attrs.platform ?? ""}\t${attrs.createdDate ?? ""}`
        );
      }
    } catch (error) {
      console.error(formatError(error));
      process.exitCode = 1;
    }
  });

program
  .command("list-localizations")
  .description("List localizations for an App Store version")
  .option("--app-id <id>", "App Store Connect app id")
  .option("--version-id <id>", "App Store version id")
  .action(async (opts) => {
    try {
      const env = loadEnvConfig();
      const client = resolveAscClient();
      const appId = opts.appId ?? env.ascAppId;
      const versionId = opts.versionId ?? (appId ? (await resolveLatestVersion({ client, appId })).id : undefined);
      if (!versionId) {
        throw new Error("Missing version id. Use --version-id or --app-id / ASC_APP_ID");
      }
      const response = await client.get<
        AscListResponse<AppStoreVersionLocalizationAttributes>
      >(`/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations`, {
        "fields[appStoreVersionLocalizations]": [
          "locale",
          "description",
          "promotionalText",
          "whatsNew",
          "keywords",
        ],
        limit: 200,
      });

      console.log(
        "id\tlocale\tdescriptionLength\tpromoLength\twhatsNewLength\tkeywordsLength"
      );
      for (const item of response.data) {
        const attrs = item.attributes ?? {};
        const length = attrs.description?.length ?? 0;
        const promoLength = attrs.promotionalText?.length ?? 0;
        const whatsNewLength = attrs.whatsNew?.length ?? 0;
        const keywordsLength = attrs.keywords
          ? measureLocalizationFieldLength("keywords", attrs.keywords)
          : 0;
        console.log(
          `${item.id}\t${toCanonical(attrs.locale ?? "")}\t${length}\t${promoLength}\t${whatsNewLength}\t${keywordsLength}`
        );
      }
    } catch (error) {
      console.error(formatError(error));
      process.exitCode = 1;
    }
  });

program
  .command("sync")
  .description("Translate and sync localization fields from a source locale")
  .option("--app-id <id>", "App Store Connect app id")
  .option("--version-id <id>", "App Store version id")
  .option("--version-string <version>", "App Store version string")
  .option("--platform <platform>", "Platform filter (IOS, MAC_OS, TV_OS, VISION_OS)")
  .option("--source-locale <locale>", "Source locale")
  .option("--target-locales <locales>", "Comma-separated list of target locales")
  .option(
    "--fields <fields>",
    "Comma-separated fields to sync (description,promotionalText,whatsNew,keywords)"
  )
  .option("--source-text-file <path>", "Use a local file for the source description")
  .option("--source-description-file <path>", "Use a local file for the source description")
  .option(
    "--source-promotional-text-file <path>",
    "Use a local file for the source promotional text"
  )
  .option(
    "--source-whats-new-file <path>",
    "Use a local file for the source What's New text"
  )
  .option(
    "--source-keywords-file <path>",
    "Use a local file for the source App Store keywords text"
  )
  .option("--dry-run", "Translate but do not update App Store Connect", false)
  .option("--preview", "Print translated text per locale/field", false)
  .option("--confirm-each-locale", "Ask for confirmation before each locale")
  .option("--delay-ms <number>", "Delay between OpenAI requests (ms)")
  .option("--max-retries <number>", "Max retries for OpenAI 429 errors")
  .option("--retry-base-ms <number>", "Base backoff delay for retries (ms)")
  .option("--limit-description <number>", "Max length for description")
  .option("--limit-promotional-text <number>", "Max length for promotional text")
  .option("--limit-whats-new <number>", "Max length for What's New")
  .option("--limit-keywords <number>", "Max length for keywords")
  .option("--strict-limits", "Fail if a translation exceeds limits")
  .option("--no-create-missing", "Do not create missing localizations")
  .option("--openai-api-key <key>", "OpenAI API key")
  .option("--openai-model <model>", "OpenAI model")
  .option("--openai-base-url <url>", "OpenAI base URL")
  .action(async (opts) => {
    const prompt =
      opts.confirmEachLocale === true
        ? createInterface({ input: process.stdin, output: process.stdout })
        : null;
    try {
      const env = loadEnvConfig();
      const client = resolveAscClient();
      const appId = opts.appId ?? env.ascAppId;
      const platform = opts.platform ?? env.ascPlatform;

      let versionId = opts.versionId;
      const versionString = opts.versionString;
      let resolvedVersion: { id: string; attributes?: AppStoreVersionAttributes } | null =
        null;

      if (!versionId) {
        if (!appId) {
          throw new Error("Missing app id. Use --app-id or ASC_APP_ID");
        }
        if (!versionString) {
          resolvedVersion = await resolveLatestVersion({
            client,
            appId,
            platform,
          });
          versionId = resolvedVersion.id;
        } else {
          versionId = await resolveVersionId({
            client,
            appId,
            versionString,
            platform,
          });
        }
      }

      const localizationsResponse = await client.get<
        AscListResponse<AppStoreVersionLocalizationAttributes>
      >(`/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations`, {
        "fields[appStoreVersionLocalizations]": [
          "locale",
          "description",
          "promotionalText",
          "whatsNew",
          "keywords",
        ],
        limit: 200,
      });

      const localizations = localizationsResponse.data;
      const sourceLocale =
        opts.sourceLocale ?? env.ascSourceLocale ?? "en-US";

      const fieldsToSync = parseFields(opts.fields ?? env.ascSyncFields);
      const sourceLocalization = localizations.find(
        (item) => toCanonical(item.attributes?.locale ?? "") === sourceLocale
      );
      const sourceDescriptionFile =
        opts.sourceDescriptionFile ?? opts.sourceTextFile;
      const sourceFiles: Partial<Record<LocalizationField, string>> = {
        description: sourceDescriptionFile,
        promotionalText: opts.sourcePromotionalTextFile,
        whatsNew: opts.sourceWhatsNewFile,
        keywords: opts.sourceKeywordsFile,
      };

      const sourceTexts: Partial<Record<LocalizationField, string>> = {};
      for (const field of fieldsToSync) {
        const sourceFile = sourceFiles[field];
        if (sourceFile) {
          sourceTexts[field] = await readFile(sourceFile, "utf8");
          continue;
        }
        const value = sourceLocalization?.attributes?.[
          field
        ] as string | undefined;
        sourceTexts[field] = value;
      }

      if (
        fieldsToSync.includes("description") &&
        sourceTexts.description === undefined
      ) {
        throw new Error(
          `Source description not found for locale ${sourceLocale}. Provide --source-description-file to override.`
        );
      }

      const targetLocalesInput = parseCommaList(
        opts.targetLocales ?? env.ascTargetLocales
      );
      const targetLocales = uniqueList(
        targetLocalesInput.length > 0
          ? targetLocalesInput
          : localizations
              .map((item) => toCanonical(item.attributes?.locale ?? ""))
              .filter((locale): locale is string => Boolean(locale))
              .filter((locale) => locale !== sourceLocale)
      );

      if (targetLocales.length === 0) {
        throw new Error("No target locales provided or discovered.");
      }

      const strictLimits =
        opts.strictLimits ?? parseBoolean(env.ascStrictLimits) ?? false;
      const limits: Record<LocalizationField, number | undefined> = {
        description: resolveLimit(
          opts.limitDescription ?? env.ascLimitDescription,
          DEFAULT_LIMITS.description
        ),
        promotionalText: resolveLimit(
          opts.limitPromotionalText ?? env.ascLimitPromotionalText,
          DEFAULT_LIMITS.promotionalText
        ),
        whatsNew: resolveLimit(
          opts.limitWhatsNew ?? env.ascLimitWhatsNew,
          DEFAULT_LIMITS.whatsNew
        ),
        keywords: resolveLimit(
          opts.limitKeywords ?? env.ascLimitKeywords,
          DEFAULT_LIMITS.keywords
        ),
      };

      const delayMs = resolveNonNegativeInt(opts.delayMs, 1200);
      const maxRetries = resolveNonNegativeInt(opts.maxRetries, 5);
      const retryBaseMs = resolveNonNegativeInt(opts.retryBaseMs, 1000);

      const openaiApiKey = opts.openaiApiKey ?? env.openaiApiKey;
      const openaiModel = opts.openaiModel ?? env.openaiModel;
      const openaiBaseUrl = opts.openaiBaseUrl ?? env.openaiBaseUrl;

      const openaiConfig = {
        apiKey: requireValue(openaiApiKey, "OPENAI_API_KEY"),
        model: requireValue(openaiModel, "OPENAI_MODEL"),
        baseUrl: openaiBaseUrl,
      };

      if (resolvedVersion) {
        const resolvedLabel =
          resolvedVersion.attributes?.versionString ?? resolvedVersion.id;
        console.log(`Resolved latest version: ${resolvedLabel} (${versionId})`);
      }
      console.log(`Source locale: ${sourceLocale}`);
      console.log(`Target locales: ${targetLocales.join(", ")}`);
      console.log(`Fields: ${fieldsToSync.join(", ")}`);

      const skippedFields: Record<LocalizationField, Set<string>> = {
        description: new Set(),
        promotionalText: new Set(),
        whatsNew: new Set(),
        keywords: new Set(),
      };

      const missingSourceFields = fieldsToSync.filter(
        (field) => sourceTexts[field] === undefined
      );
      if (missingSourceFields.length > 0) {
        console.log(
          `Skipping fields missing in source locale: ${missingSourceFields.join(
            ", "
          )}`
        );
      }

      if (prompt && !process.stdin.isTTY) {
        throw new Error("--confirm-each-locale requires an interactive terminal.");
      }

      const translateWithRetry = async (params: {
        sourceLocale: string;
        targetLocale: string;
        text: string;
        fieldName: string;
        maxLength?: number;
        lengthUnit?: "characters" | "bytes";
      }) => {
        let attempt = 0;
        while (true) {
          try {
            return await translateWithOpenAI({
              config: openaiConfig,
              sourceLocale: params.sourceLocale,
              targetLocale: params.targetLocale,
              text: params.text,
              fieldName: params.fieldName,
              maxLength: params.maxLength,
              lengthUnit: params.lengthUnit,
            });
          } catch (error) {
            const err = error as Error & { status?: number; retryAfterMs?: number };
            if (err.status === 429 && attempt < maxRetries) {
              const backoff = retryBaseMs * Math.pow(2, attempt);
              const waitMs = err.retryAfterMs ?? backoff;
              console.log(
                `[retry] ${params.targetLocale} ${params.fieldName} in ${waitMs}ms`
              );
              attempt += 1;
              await sleep(waitMs);
              continue;
            }
            throw error;
          }
        }
      };

      const shortenWithRetry = async (params: {
        targetLocale: string;
        text: string;
        fieldName: string;
        maxLength: number;
        lengthUnit?: "characters" | "bytes";
      }) => {
        let attempt = 0;
        while (true) {
          try {
            return await shortenWithOpenAI({
              config: openaiConfig,
              targetLocale: params.targetLocale,
              text: params.text,
              fieldName: params.fieldName,
              maxLength: params.maxLength,
              lengthUnit: params.lengthUnit,
            });
          } catch (error) {
            const err = error as Error & { status?: number; retryAfterMs?: number };
            if (err.status === 429 && attempt < maxRetries) {
              const backoff = retryBaseMs * Math.pow(2, attempt);
              const waitMs = err.retryAfterMs ?? backoff;
              console.log(
                `[retry] ${params.targetLocale} ${params.fieldName} shorten in ${waitMs}ms`
              );
              attempt += 1;
              await sleep(waitMs);
              continue;
            }
            throw error;
          }
        }
      };

      for (const locale of targetLocales) {
        if (locale === sourceLocale) continue;

        if (prompt) {
          const answer = await prompt.question(
            `Process locale ${locale}? (y/n) `
          );
          if (!/^y(es)?$/i.test(answer.trim())) {
            console.log(`Skipping ${locale} (user declined)`);
            continue;
          }
        }

        console.log(`Translating -> ${locale}`);
        const ascLocale = toStoreLocale(locale, "app_store");
        const existing = localizations.find(
          (item) => item.attributes?.locale === ascLocale
        );

        const updates: Partial<AppStoreVersionLocalizationAttributes> = {};

        for (const field of fieldsToSync) {
          const sourceText = sourceTexts[field];
          if (sourceText === undefined) {
            continue;
          }

          if (sourceText.length === 0) {
            updates[field] = "";
            if (opts.dryRun) {
              console.log(`[dry-run] ${locale} ${field} length=0`);
            }
            if (opts.preview) {
              console.log(`[preview] ${locale} ${field} (empty)`);
            }
            continue;
          }

          const translated = await translateWithRetry({
            sourceLocale,
            targetLocale: locale,
            text: sourceText,
            fieldName: FIELD_LABELS[field],
            maxLength: limits[field],
            lengthUnit: localizationFieldLengthUnit(field),
          });
          console.log(`Translated ${locale} ${field}`);
          await sleep(delayMs);

          const limit = limits[field];
          let finalText = translated;
          const translatedLength = measureLocalizationFieldLength(field, translated);
          if (limit !== undefined && translatedLength > limit) {
            console.log(
              `[limit] ${FIELD_LABELS[field]} for ${locale} exceeds limit (${translatedLength}/${limit} ${localizationFieldLengthUnit(field)}) -> shortening`
            );
            finalText = await shortenWithRetry({
              targetLocale: locale,
              text: translated,
              fieldName: FIELD_LABELS[field],
              maxLength: limit,
              lengthUnit: localizationFieldLengthUnit(field),
            });
            console.log(
              `Shortened ${locale} ${field} length=${measureLocalizationFieldLength(
                field,
                finalText
              )}`
            );
            await sleep(delayMs);
          }

          const finalLength = measureLocalizationFieldLength(field, finalText);
          if (limit !== undefined && finalLength > limit) {
            const message = `${FIELD_LABELS[field]} for ${locale} still exceeds limit (${finalLength}/${limit} ${localizationFieldLengthUnit(field)})`;
            if (strictLimits) {
              throw new Error(message);
            }
            console.log(`[limit] ${message} -> skipping field`);
            skippedFields[field].add(locale);
            continue;
          }

          updates[field] = finalText;

          if (opts.dryRun) {
            console.log(
              `[dry-run] ${locale} ${field} length=${measureLocalizationFieldLength(
                field,
                finalText
              )}`
            );
          }
          if (opts.preview) {
            console.log(`[preview] ${locale} ${field}`);
            console.log(finalText);
          }
        }

        if (opts.dryRun) {
          const updatedFields = Object.keys(updates);
          if (updatedFields.length === 0) {
            console.log(`[dry-run] ${locale} no updates`);
          }
          continue;
        }

        if (Object.keys(updates).length === 0) {
          console.log(`Skipping ${locale} (no fields to update)`);
          continue;
        }

        if (existing) {
          await client.patch(`/v1/appStoreVersionLocalizations/${existing.id}`, {
            data: {
              type: "appStoreVersionLocalizations",
              id: existing.id,
              attributes: updates,
            },
          });
          console.log(`Updated ${locale}`);
        } else if (opts.createMissing) {
          await client.post(`/v1/appStoreVersionLocalizations`, {
            data: {
              type: "appStoreVersionLocalizations",
              attributes: {
                locale: ascLocale,
                ...updates,
              },
              relationships: {
                appStoreVersion: {
                  data: {
                    type: "appStoreVersions",
                    id: versionId,
                  },
                },
              },
            },
          });
          console.log(`Created ${locale}`);
        } else {
          console.log(`Skipping ${locale} (missing localization)`);
        }
      }

      const skippedSummary = fieldsToSync
        .map((field) => ({
          field,
          locales: targetLocales.filter((locale) => skippedFields[field].has(locale)),
        }))
        .filter((entry) => entry.locales.length > 0);

      if (skippedSummary.length > 0) {
        console.log("Skipped fields:");
        for (const entry of skippedSummary) {
          console.log(`${entry.field}: ${entry.locales.join(", ")}`);
        }
      }
    } catch (error) {
      console.error(formatError(error));
      process.exitCode = 1;
    } finally {
      if (prompt) {
        await prompt.close();
      }
    }
  });

/* ------------------------------------------------------------------ */
/*  Google Play Console commands                                       */
/* ------------------------------------------------------------------ */

type GpcListingField = "title" | "shortDescription" | "fullDescription";

const GPC_DEFAULT_FIELDS: GpcListingField[] = [
  "title",
  "shortDescription",
  "fullDescription",
];

const GPC_FIELD_LABELS: Record<GpcListingField, string> = {
  title: "title",
  shortDescription: "short description",
  fullDescription: "full description",
};

const GPC_DEFAULT_LIMITS: Record<GpcListingField, number> = {
  title: 30,
  shortDescription: 80,
  fullDescription: 4000,
};

function parseGpcFields(value?: string): GpcListingField[] {
  const items = parseCommaList(value);
  if (items.length === 0) return GPC_DEFAULT_FIELDS.slice();
  const fields = items.map((item) => item as GpcListingField);
  const invalid = fields.filter(
    (field) =>
      field !== "title" &&
      field !== "shortDescription" &&
      field !== "fullDescription"
  );
  if (invalid.length > 0) {
    throw new Error(
      `Unsupported field(s): ${invalid.join(", ")}. Use title, shortDescription, fullDescription.`
    );
  }
  return uniqueList(fields);
}

function resolveGpcClient() {
  const env = loadEnvConfig();
  const serviceAccountKeyPath = requireValue(
    env.gpcServiceAccountKeyPath,
    "GPC_SERVICE_ACCOUNT_KEY_PATH"
  );
  return new GpcClient({ serviceAccountKeyPath });
}

program
  .command("gpc-list-listings")
  .description("List Google Play store listings for a package")
  .option("--package-name <name>", "Android package name")
  .action(async (opts) => {
    let editId: string | undefined;
    let client: GpcClient | undefined;
    let packageName: string | undefined;
    try {
      const env = loadEnvConfig();
      client = resolveGpcClient();
      packageName = opts.packageName ?? env.gpcPackageName;
      if (!packageName) {
        throw new Error(
          "Missing package name. Use --package-name or GPC_PACKAGE_NAME"
        );
      }

      editId = await client.createEdit(packageName);
      const response = await client.get<GpcListingsListResponse>(
        `/androidpublisher/v3/applications/${packageName}/edits/${editId}/listings`
      );

      const listings = response.listings ?? [];
      console.log("language\ttitleLength\tshortDescLength\tfullDescLength");
      for (const listing of listings) {
        const titleLen = listing.title?.length ?? 0;
        const shortLen = listing.shortDescription?.length ?? 0;
        const fullLen = listing.fullDescription?.length ?? 0;
        console.log(
          `${toCanonical(listing.language ?? "")}\t${titleLen}\t${shortLen}\t${fullLen}`
        );
      }
    } catch (error) {
      console.error(formatError(error));
      process.exitCode = 1;
    } finally {
      if (client && packageName && editId) {
        try {
          await client.deleteEdit(packageName, editId);
        } catch {
          // ignore cleanup errors
        }
      }
    }
  });

program
  .command("gpc-sync")
  .description(
    "Translate and sync Google Play store listing fields from a source locale"
  )
  .option("--package-name <name>", "Android package name")
  .option("--source-locale <locale>", "Source locale")
  .option(
    "--target-locales <locales>",
    "Comma-separated list of target locales"
  )
  .option(
    "--fields <fields>",
    "Comma-separated fields to sync (title,shortDescription,fullDescription)"
  )
  .option(
    "--source-title-file <path>",
    "Use a local file for the source title"
  )
  .option(
    "--source-short-description-file <path>",
    "Use a local file for the source short description"
  )
  .option(
    "--source-full-description-file <path>",
    "Use a local file for the source full description"
  )
  .option(
    "--dry-run",
    "Translate but do not update Google Play",
    false
  )
  .option("--preview", "Print translated text per locale/field", false)
  .option("--confirm-each-locale", "Ask for confirmation before each locale")
  .option("--delay-ms <number>", "Delay between OpenAI requests (ms)")
  .option("--max-retries <number>", "Max retries for OpenAI 429 errors")
  .option("--retry-base-ms <number>", "Base backoff delay for retries (ms)")
  .option("--limit-title <number>", "Max length for title")
  .option(
    "--limit-short-description <number>",
    "Max length for short description"
  )
  .option(
    "--limit-full-description <number>",
    "Max length for full description"
  )
  .option("--strict-limits", "Fail if a translation exceeds limits")
  .option("--no-create-missing", "Do not create listings for new languages")
  .option("--openai-api-key <key>", "OpenAI API key")
  .option("--openai-model <model>", "OpenAI model")
  .option("--openai-base-url <url>", "OpenAI base URL")
  .action(async (opts) => {
    const rl =
      opts.confirmEachLocale === true
        ? createInterface({ input: process.stdin, output: process.stdout })
        : null;
    let editId: string | undefined;
    let client: GpcClient | undefined;
    let packageName: string | undefined;
    let committed = false;
    try {
      const env = loadEnvConfig();
      client = resolveGpcClient();
      packageName = opts.packageName ?? env.gpcPackageName;
      if (!packageName) {
        throw new Error(
          "Missing package name. Use --package-name or GPC_PACKAGE_NAME"
        );
      }

      editId = await client.createEdit(packageName);
      const basePath = `/androidpublisher/v3/applications/${packageName}/edits/${editId}`;

      const listingsResponse = await client.get<GpcListingsListResponse>(
        `${basePath}/listings`
      );
      const listings = listingsResponse.listings ?? [];

      const sourceLocale =
        opts.sourceLocale ?? env.gpcSourceLocale ?? "en-US";

      const fieldsToSync = parseGpcFields(opts.fields ?? env.gpcSyncFields);
      const sourceListing = listings.find(
        (item) => toCanonical(item.language ?? "") === sourceLocale
      );

      const sourceFiles: Partial<Record<GpcListingField, string>> = {
        title: opts.sourceTitleFile,
        shortDescription: opts.sourceShortDescriptionFile,
        fullDescription: opts.sourceFullDescriptionFile,
      };

      const sourceTexts: Partial<Record<GpcListingField, string>> = {};
      for (const field of fieldsToSync) {
        const sourceFile = sourceFiles[field];
        if (sourceFile) {
          sourceTexts[field] = await readFile(sourceFile, "utf8");
          continue;
        }
        sourceTexts[field] = sourceListing?.[field];
      }

      if (
        fieldsToSync.includes("fullDescription") &&
        sourceTexts.fullDescription === undefined
      ) {
        throw new Error(
          `Source full description not found for locale ${sourceLocale}. Provide --source-full-description-file to override.`
        );
      }

      const targetLocalesInput = parseCommaList(
        opts.targetLocales ?? env.gpcTargetLocales
      );
      const targetLocales = uniqueList(
        targetLocalesInput.length > 0
          ? targetLocalesInput
          : listings
              .map((item) => toCanonical(item.language ?? ""))
              .filter((lang): lang is string => Boolean(lang))
              .filter((lang) => lang !== sourceLocale)
      );

      if (targetLocales.length === 0) {
        throw new Error("No target locales provided or discovered.");
      }

      const strictLimits =
        opts.strictLimits ?? parseBoolean(env.gpcStrictLimits) ?? false;
      const limits: Record<GpcListingField, number | undefined> = {
        title: resolveLimit(
          opts.limitTitle ?? env.gpcLimitTitle,
          GPC_DEFAULT_LIMITS.title
        ),
        shortDescription: resolveLimit(
          opts.limitShortDescription ?? env.gpcLimitShortDescription,
          GPC_DEFAULT_LIMITS.shortDescription
        ),
        fullDescription: resolveLimit(
          opts.limitFullDescription ?? env.gpcLimitFullDescription,
          GPC_DEFAULT_LIMITS.fullDescription
        ),
      };

      const delayMs = resolveNonNegativeInt(opts.delayMs, 1200);
      const maxRetries = resolveNonNegativeInt(opts.maxRetries, 5);
      const retryBaseMs = resolveNonNegativeInt(opts.retryBaseMs, 1000);

      const openaiApiKey = opts.openaiApiKey ?? env.openaiApiKey;
      const openaiModel = opts.openaiModel ?? env.openaiModel;
      const openaiBaseUrl = opts.openaiBaseUrl ?? env.openaiBaseUrl;

      const openaiConfig = {
        apiKey: requireValue(openaiApiKey, "OPENAI_API_KEY"),
        model: requireValue(openaiModel, "OPENAI_MODEL"),
        baseUrl: openaiBaseUrl,
      };

      console.log(`Package: ${packageName}`);
      console.log(`Source locale: ${sourceLocale}`);
      console.log(`Target locales: ${targetLocales.join(", ")}`);
      console.log(`Fields: ${fieldsToSync.join(", ")}`);

      const skippedFields: Record<GpcListingField, Set<string>> = {
        title: new Set(),
        shortDescription: new Set(),
        fullDescription: new Set(),
      };

      const missingSourceFields = fieldsToSync.filter(
        (field) => sourceTexts[field] === undefined
      );
      if (missingSourceFields.length > 0) {
        console.log(
          `Skipping fields missing in source locale: ${missingSourceFields.join(
            ", "
          )}`
        );
      }

      if (rl && !process.stdin.isTTY) {
        throw new Error(
          "--confirm-each-locale requires an interactive terminal."
        );
      }

      const translateWithRetry = async (params: {
        sourceLocale: string;
        targetLocale: string;
        text: string;
        fieldName: string;
        maxLength?: number;
      }) => {
        let attempt = 0;
        while (true) {
          try {
            return await translateWithOpenAI({
              config: openaiConfig,
              sourceLocale: params.sourceLocale,
              targetLocale: params.targetLocale,
              text: params.text,
              fieldName: params.fieldName,
              maxLength: params.maxLength,
              storeName: "Google Play Store",
            });
          } catch (error) {
            const err = error as Error & {
              status?: number;
              retryAfterMs?: number;
            };
            if (err.status === 429 && attempt < maxRetries) {
              const backoff = retryBaseMs * Math.pow(2, attempt);
              const waitMs = err.retryAfterMs ?? backoff;
              console.log(
                `[retry] ${params.targetLocale} ${params.fieldName} in ${waitMs}ms`
              );
              attempt += 1;
              await sleep(waitMs);
              continue;
            }
            throw error;
          }
        }
      };

      const shortenWithRetry = async (params: {
        targetLocale: string;
        text: string;
        fieldName: string;
        maxLength: number;
      }) => {
        let attempt = 0;
        while (true) {
          try {
            return await shortenWithOpenAI({
              config: openaiConfig,
              targetLocale: params.targetLocale,
              text: params.text,
              fieldName: params.fieldName,
              maxLength: params.maxLength,
              storeName: "Google Play Store",
            });
          } catch (error) {
            const err = error as Error & {
              status?: number;
              retryAfterMs?: number;
            };
            if (err.status === 429 && attempt < maxRetries) {
              const backoff = retryBaseMs * Math.pow(2, attempt);
              const waitMs = err.retryAfterMs ?? backoff;
              console.log(
                `[retry] ${params.targetLocale} ${params.fieldName} shorten in ${waitMs}ms`
              );
              attempt += 1;
              await sleep(waitMs);
              continue;
            }
            throw error;
          }
        }
      };

      let anyUpdated = false;

      for (const locale of targetLocales) {
        if (locale === sourceLocale) continue;

        if (rl) {
          const answer = await rl.question(
            `Process locale ${locale}? (y/n) `
          );
          if (!/^y(es)?$/i.test(answer.trim())) {
            console.log(`Skipping ${locale} (user declined)`);
            continue;
          }
        }

        console.log(`Translating -> ${locale}`);
        const gpcLocale = toStoreLocale(locale, "play_store");
        const existing = listings.find(
          (item) => item.language === gpcLocale
        );

        const updates: Partial<GpcListing> = {};

        for (const field of fieldsToSync) {
          const sourceText = sourceTexts[field];
          if (sourceText === undefined) {
            continue;
          }

          if (sourceText.length === 0) {
            updates[field] = "";
            if (opts.dryRun) {
              console.log(`[dry-run] ${locale} ${field} length=0`);
            }
            if (opts.preview) {
              console.log(`[preview] ${locale} ${field} (empty)`);
            }
            continue;
          }

          const translated = await translateWithRetry({
            sourceLocale,
            targetLocale: locale,
            text: sourceText,
            fieldName: GPC_FIELD_LABELS[field],
            maxLength: limits[field],
          });
          console.log(`Translated ${locale} ${field}`);
          await sleep(delayMs);

          const limit = limits[field];
          let finalText = translated;
          if (limit !== undefined && translated.length > limit) {
            console.log(
              `[limit] ${GPC_FIELD_LABELS[field]} for ${locale} exceeds limit (${translated.length}/${limit}) -> shortening`
            );
            finalText = await shortenWithRetry({
              targetLocale: locale,
              text: translated,
              fieldName: GPC_FIELD_LABELS[field],
              maxLength: limit,
            });
            console.log(
              `Shortened ${locale} ${field} length=${finalText.length}`
            );
            await sleep(delayMs);
          }

          if (limit !== undefined && finalText.length > limit) {
            const message = `${GPC_FIELD_LABELS[field]} for ${locale} still exceeds limit (${finalText.length}/${limit})`;
            if (strictLimits) {
              throw new Error(message);
            }
            console.log(`[limit] ${message} -> skipping field`);
            skippedFields[field].add(locale);
            continue;
          }

          updates[field] = finalText;

          if (opts.dryRun) {
            console.log(
              `[dry-run] ${locale} ${field} length=${finalText.length}`
            );
          }
          if (opts.preview) {
            console.log(`[preview] ${locale} ${field}`);
            console.log(finalText);
          }
        }

        if (opts.dryRun) {
          const updatedFields = Object.keys(updates);
          if (updatedFields.length === 0) {
            console.log(`[dry-run] ${locale} no updates`);
          }
          continue;
        }

        if (Object.keys(updates).length === 0) {
          console.log(`Skipping ${locale} (no fields to update)`);
          continue;
        }

        if (existing || opts.createMissing) {
          const merged: GpcListing = {
            language: gpcLocale,
            title: updates.title ?? existing?.title ?? "",
            shortDescription:
              updates.shortDescription ?? existing?.shortDescription ?? "",
            fullDescription:
              updates.fullDescription ?? existing?.fullDescription ?? "",
          };
          await client.put(
            `${basePath}/listings/${gpcLocale}`,
            merged
          );
          console.log(`${existing ? "Updated" : "Created"} ${locale}`);
          anyUpdated = true;
        } else {
          console.log(`Skipping ${locale} (missing listing)`);
        }
      }

      const skippedSummary = fieldsToSync
        .map((field) => ({
          field,
          locales: targetLocales.filter((locale) =>
            skippedFields[field].has(locale)
          ),
        }))
        .filter((entry) => entry.locales.length > 0);

      if (skippedSummary.length > 0) {
        console.log("Skipped fields:");
        for (const entry of skippedSummary) {
          console.log(`${entry.field}: ${entry.locales.join(", ")}`);
        }
      }

      if (!opts.dryRun && anyUpdated) {
        await client.commitEdit(packageName, editId);
        console.log("Edit committed.");
        committed = true;
      }
    } catch (error) {
      console.error(formatError(error));
      process.exitCode = 1;
    } finally {
      if (rl) {
        await rl.close();
      }
      if (client && packageName && editId && !committed) {
        try {
          await client.deleteEdit(packageName, editId);
        } catch {
          // ignore cleanup errors
        }
      }
    }
  });

program.parseAsync(process.argv).catch((error) => {
  console.error(formatError(error));
  process.exitCode = 1;
});
