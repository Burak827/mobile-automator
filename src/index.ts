#!/usr/bin/env node
import { Command } from "commander";
import { readFile } from "fs/promises";
import { AscClient } from "./ascClient.js";
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
import { translateWithOpenAI } from "./translate.js";

const program = new Command();
program
  .name("asc-auto")
  .description("App Store Connect localization automation")
  .showHelpAfterError();

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function uniqueList(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
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
        "fields[appStoreVersions]": ["versionString", "appVersionState", "platform"],
        limit: 200,
      });

      console.log("id\tversion\tstate\tplatform");
      for (const item of response.data) {
        const attrs = item.attributes ?? {};
        console.log(
          `${item.id}\t${attrs.versionString ?? ""}\t${
            attrs.appVersionState ?? ""
          }\t${attrs.platform ?? ""}`
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
  .option("--version-id <id>", "App Store version id")
  .action(async (opts) => {
    try {
      const env = loadEnvConfig();
      const client = resolveAscClient();
      const versionId = opts.versionId ?? env.ascVersionId;
      if (!versionId) {
        throw new Error("Missing version id. Use --version-id or ASC_VERSION_ID");
      }
      const response = await client.get<
        AscListResponse<AppStoreVersionLocalizationAttributes>
      >(`/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations`, {
        "fields[appStoreVersionLocalizations]": ["locale", "description"],
        limit: 200,
      });

      console.log("id\tlocale\tdescriptionLength");
      for (const item of response.data) {
        const attrs = item.attributes ?? {};
        const length = attrs.description?.length ?? 0;
        console.log(`${item.id}\t${attrs.locale ?? ""}\t${length}`);
      }
    } catch (error) {
      console.error(formatError(error));
      process.exitCode = 1;
    }
  });

program
  .command("sync-description")
  .description("Translate and sync description from a source locale")
  .option("--app-id <id>", "App Store Connect app id")
  .option("--version-id <id>", "App Store version id")
  .option("--version-string <version>", "App Store version string")
  .option("--platform <platform>", "Platform filter (IOS, MAC_OS, TV_OS, VISION_OS)")
  .option("--source-locale <locale>", "Source locale")
  .option("--target-locales <locales>", "Comma-separated list of target locales")
  .option("--source-text-file <path>", "Use a local file for the source text")
  .option("--dry-run", "Translate but do not update App Store Connect", false)
  .option("--no-create-missing", "Do not create missing localizations")
  .option("--openai-api-key <key>", "OpenAI API key")
  .option("--openai-model <model>", "OpenAI model")
  .option("--openai-base-url <url>", "OpenAI base URL")
  .action(async (opts) => {
    try {
      const env = loadEnvConfig();
      const client = resolveAscClient();
      const appId = opts.appId ?? env.ascAppId;
      const platform = opts.platform ?? env.ascPlatform;

      let versionId = opts.versionId ?? env.ascVersionId;
      const versionString = opts.versionString;

      if (!versionId) {
        if (!appId) {
          throw new Error("Missing app id. Use --app-id or ASC_APP_ID");
        }
        if (!versionString) {
          throw new Error(
            "Missing version id. Use --version-id or provide --version-string."
          );
        }
        versionId = await resolveVersionId({
          client,
          appId,
          versionString,
          platform,
        });
      }

      const localizationsResponse = await client.get<
        AscListResponse<AppStoreVersionLocalizationAttributes>
      >(`/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations`, {
        "fields[appStoreVersionLocalizations]": ["locale", "description"],
        limit: 200,
      });

      const localizations = localizationsResponse.data;
      const sourceLocale =
        opts.sourceLocale ?? env.ascSourceLocale ?? "en-US";

      let sourceText: string | undefined;
      if (opts.sourceTextFile) {
        sourceText = await readFile(opts.sourceTextFile, "utf8");
      } else {
        const source = localizations.find(
          (item) => item.attributes?.locale === sourceLocale
        );
        sourceText = source?.attributes?.description;
      }

      if (!sourceText) {
        throw new Error(
          `Source description not found for locale ${sourceLocale}. Provide --source-text-file to override.`
        );
      }

      const targetLocalesInput = parseCommaList(
        opts.targetLocales ?? env.ascTargetLocales
      );
      const targetLocales = uniqueList(
        targetLocalesInput.length > 0
          ? targetLocalesInput
          : localizations
              .map((item) => item.attributes?.locale)
              .filter((locale): locale is string => Boolean(locale))
              .filter((locale) => locale !== sourceLocale)
      );

      if (targetLocales.length === 0) {
        throw new Error("No target locales provided or discovered.");
      }

      const openaiApiKey = opts.openaiApiKey ?? env.openaiApiKey;
      const openaiModel = opts.openaiModel ?? env.openaiModel;
      const openaiBaseUrl = opts.openaiBaseUrl ?? env.openaiBaseUrl;

      const openaiConfig = {
        apiKey: requireValue(openaiApiKey, "OPENAI_API_KEY"),
        model: requireValue(openaiModel, "OPENAI_MODEL"),
        baseUrl: openaiBaseUrl,
      };

      console.log(`Source locale: ${sourceLocale}`);
      console.log(`Target locales: ${targetLocales.join(", ")}`);

      for (const locale of targetLocales) {
        if (locale === sourceLocale) continue;

        console.log(`Translating -> ${locale}`);
        const translated = await translateWithOpenAI({
          config: openaiConfig,
          sourceLocale,
          targetLocale: locale,
          text: sourceText,
        });

        const existing = localizations.find(
          (item) => item.attributes?.locale === locale
        );

        if (opts.dryRun) {
          console.log(`[dry-run] ${locale} length=${translated.length}`);
          continue;
        }

        if (existing) {
          await client.patch(`/v1/appStoreVersionLocalizations/${existing.id}`, {
            data: {
              type: "appStoreVersionLocalizations",
              id: existing.id,
              attributes: {
                description: translated,
              },
            },
          });
          console.log(`Updated ${locale}`);
        } else if (opts.createMissing) {
          await client.post(`/v1/appStoreVersionLocalizations`, {
            data: {
              type: "appStoreVersionLocalizations",
              attributes: {
                locale,
                description: translated,
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
    } catch (error) {
      console.error(formatError(error));
      process.exitCode = 1;
    }
  });

program.parseAsync(process.argv).catch((error) => {
  console.error(formatError(error));
  process.exitCode = 1;
});
