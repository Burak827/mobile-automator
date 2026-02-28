import dotenv from "dotenv";

dotenv.config();

export type EnvConfig = {
  webPort?: string;
  webDbPath?: string;
  webEnableUi?: string;
  ascIssuerId?: string;
  ascKeyId?: string;
  ascPrivateKeyPath?: string;
  ascAppId?: string;
  ascPlatform?: string;
  ascSourceLocale?: string;
  ascTargetLocales?: string;
  ascBaseUrl?: string;
  ascSyncFields?: string;
  ascLimitDescription?: string;
  ascLimitPromotionalText?: string;
  ascLimitWhatsNew?: string;
  ascLimitKeywords?: string;
  ascStrictLimits?: string;
  gpcServiceAccountKeyPath?: string;
  gpcPackageName?: string;
  gpcSourceLocale?: string;
  gpcTargetLocales?: string;
  gpcSyncFields?: string;
  gpcLimitTitle?: string;
  gpcLimitShortDescription?: string;
  gpcLimitFullDescription?: string;
  gpcStrictLimits?: string;
  openaiApiKey?: string;
  openaiModel?: string;
  openaiBaseUrl?: string;
};

export function loadEnvConfig(): EnvConfig {
  return {
    webPort: process.env.WEB_PORT,
    webDbPath: process.env.WEB_DB_PATH,
    webEnableUi: process.env.WEB_ENABLE_UI,
    ascIssuerId: process.env.ASC_ISSUER_ID,
    ascKeyId: process.env.ASC_KEY_ID,
    ascPrivateKeyPath: process.env.ASC_PRIVATE_KEY_PATH,
    ascAppId: process.env.ASC_APP_ID,
    ascPlatform: process.env.ASC_PLATFORM,
    ascSourceLocale: process.env.ASC_SOURCE_LOCALE,
    ascTargetLocales: process.env.ASC_TARGET_LOCALES,
    ascBaseUrl: process.env.ASC_BASE_URL,
    ascSyncFields: process.env.ASC_SYNC_FIELDS,
    ascLimitDescription: process.env.ASC_LIMIT_DESCRIPTION,
    ascLimitPromotionalText: process.env.ASC_LIMIT_PROMOTIONAL_TEXT,
    ascLimitWhatsNew: process.env.ASC_LIMIT_WHATS_NEW,
    ascLimitKeywords: process.env.ASC_LIMIT_KEYWORDS,
    ascStrictLimits: process.env.ASC_STRICT_LIMITS,
    gpcServiceAccountKeyPath: process.env.GPC_SERVICE_ACCOUNT_KEY_PATH,
    gpcPackageName: process.env.GPC_PACKAGE_NAME,
    gpcSourceLocale: process.env.GPC_SOURCE_LOCALE,
    gpcTargetLocales: process.env.GPC_TARGET_LOCALES,
    gpcSyncFields: process.env.GPC_SYNC_FIELDS,
    gpcLimitTitle: process.env.GPC_LIMIT_TITLE,
    gpcLimitShortDescription: process.env.GPC_LIMIT_SHORT_DESCRIPTION,
    gpcLimitFullDescription: process.env.GPC_LIMIT_FULL_DESCRIPTION,
    gpcStrictLimits: process.env.GPC_STRICT_LIMITS,
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
