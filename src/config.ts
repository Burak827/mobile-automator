import dotenv from "dotenv";

dotenv.config();

export type EnvConfig = {
  ascIssuerId?: string;
  ascKeyId?: string;
  ascPrivateKeyPath?: string;
  ascAppId?: string;
  ascVersionId?: string;
  ascPlatform?: string;
  ascSourceLocale?: string;
  ascTargetLocales?: string;
  ascBaseUrl?: string;
  ascSyncFields?: string;
  ascLimitDescription?: string;
  ascLimitPromotionalText?: string;
  ascLimitWhatsNew?: string;
  ascStrictLimits?: string;
  openaiApiKey?: string;
  openaiModel?: string;
  openaiBaseUrl?: string;
};

export function loadEnvConfig(): EnvConfig {
  return {
    ascIssuerId: process.env.ASC_ISSUER_ID,
    ascKeyId: process.env.ASC_KEY_ID,
    ascPrivateKeyPath: process.env.ASC_PRIVATE_KEY_PATH,
    ascAppId: process.env.ASC_APP_ID,
    ascVersionId: process.env.ASC_VERSION_ID,
    ascPlatform: process.env.ASC_PLATFORM,
    ascSourceLocale: process.env.ASC_SOURCE_LOCALE,
    ascTargetLocales: process.env.ASC_TARGET_LOCALES,
    ascBaseUrl: process.env.ASC_BASE_URL,
    ascSyncFields: process.env.ASC_SYNC_FIELDS,
    ascLimitDescription: process.env.ASC_LIMIT_DESCRIPTION,
    ascLimitPromotionalText: process.env.ASC_LIMIT_PROMOTIONAL_TEXT,
    ascLimitWhatsNew: process.env.ASC_LIMIT_WHATS_NEW,
    ascStrictLimits: process.env.ASC_STRICT_LIMITS,
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiModel: process.env.OPENAI_MODEL,
    openaiBaseUrl: process.env.OPENAI_BASE_URL,
  };
}

export function requireValue(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing required value: ${name}`);
  }
  return value;
}

export function parseCommaList(value?: string): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}
