export type LocaleCatalogEntry = {
  locale: string;
  iosSupported: boolean;
  androidSupported: boolean;
};

// ---------------------------------------------------------------------------
// Locale alias mapping
// Store-specific codes that map to the same canonical locale.
// Key = store-specific code, Value = canonical code used in our system.
// ---------------------------------------------------------------------------

/** Store-specific locale code → canonical locale code */
export const LOCALE_ALIASES: Record<string, string> = {
  "iw-IL": "he",       // Hebrew  (Android legacy Java code)
  "zh-CN": "zh-Hans",  // Chinese Simplified (Android region code)
  "zh-TW": "zh-Hant",  // Chinese Traditional (Android region code)
  "ms-MY": "ms",       // Malay (Android adds region)
};

/** Canonical locale → iOS (App Store Connect) code */
const CANONICAL_TO_IOS: Record<string, string> = {
  "he": "he",
  "zh-Hans": "zh-Hans",
  "zh-Hant": "zh-Hant",
  "ms": "ms",
};

/** Canonical locale → Android (Google Play) code */
const CANONICAL_TO_ANDROID: Record<string, string> = {
  "he": "iw-IL",
  "zh-Hans": "zh-CN",
  "zh-Hant": "zh-TW",
  "ms": "ms-MY",
};

/**
 * Convert any locale code to its canonical form.
 * If the code is an alias, returns the canonical equivalent.
 * Otherwise returns the code as-is.
 */
export function toCanonical(locale: string): string {
  return LOCALE_ALIASES[locale] ?? locale;
}

/**
 * Convert a canonical locale code to the store-specific code.
 * If no mapping exists, returns the canonical code as-is
 * (most codes are the same across stores).
 */
export function toStoreLocale(
  canonical: string,
  store: "app_store" | "play_store"
): string {
  const map = store === "app_store" ? CANONICAL_TO_IOS : CANONICAL_TO_ANDROID;
  return map[canonical] ?? canonical;
}

// ---------------------------------------------------------------------------
// Store locale lists (using canonical codes)
// ---------------------------------------------------------------------------

export const APP_STORE_LOCALES: string[] = [
  "ar",
  "ca",
  "cs-CZ",
  "da-DK",
  "de-DE",
  "el-GR",
  "en-AU",
  "en-CA",
  "en-GB",
  "en-US",
  "es-ES",
  "es-MX",
  "fi-FI",
  "fr-CA",
  "fr-FR",
  "he",
  "hi-IN",
  "hr",
  "hu-HU",
  "id",
  "it-IT",
  "ja-JP",
  "ko-KR",
  "ms",
  "nl-NL",
  "no-NO",
  "pl-PL",
  "pt-BR",
  "pt-PT",
  "ro",
  "ru-RU",
  "sk",
  "sv-SE",
  "th",
  "tr-TR",
  "uk",
  "vi",
  "zh-Hans",
  "zh-Hant",
];

// Source: Google Play Console Help - "App language support".
// Codes that have a canonical alias (iw-IL, zh-CN, zh-TW, ms-MY) are
// replaced with their canonical equivalents in this list.
export const PLAY_STORE_LOCALES: string[] = [
  "af",
  "sq",
  "am",
  "ar",
  "hy-AM",
  "az-AZ",
  "bn-BD",
  "eu-ES",
  "be",
  "bg",
  "my-MM",
  "ca",
  "zh-HK",
  "zh-Hans",   // canonical for zh-CN
  "zh-Hant",   // canonical for zh-TW
  "hr",
  "cs-CZ",
  "da-DK",
  "nl-NL",
  "en-AU",
  "en-CA",
  "en-US",
  "en-GB",
  "en-IN",
  "en-SG",
  "en-ZA",
  "et",
  "fil",
  "fi-FI",
  "fr-CA",
  "fr-FR",
  "gl-ES",
  "ka-GE",
  "de-DE",
  "el-GR",
  "gu",
  "he",        // canonical for iw-IL
  "hi-IN",
  "hu-HU",
  "is-IS",
  "id",
  "it-IT",
  "ja-JP",
  "kn-IN",
  "kk",
  "km-KH",
  "ko-KR",
  "ky-KG",
  "lo-LA",
  "lv",
  "lt",
  "mk-MK",
  "ms",        // canonical for ms-MY
  "ml-IN",
  "mr-IN",
  "mn-MN",
  "ne-NP",
  "no-NO",
  "fa",
  "fa-AE",
  "fa-AF",
  "fa-IR",
  "pl-PL",
  "pt-BR",
  "pt-PT",
  "pa",
  "ro",
  "rm",
  "ru-RU",
  "sr",
  "si-LK",
  "sk",
  "sl",
  "es-419",
  "es-ES",
  "es-US",
  "sw",
  "sv-SE",
  "ta-IN",
  "te-IN",
  "th",
  "tr-TR",
  "uk",
  "ur",
  "vi",
];

const APP_STORE_SET = new Set(APP_STORE_LOCALES);
const PLAY_STORE_SET = new Set(PLAY_STORE_LOCALES);

export const ALL_STORE_LOCALES: string[] = Array.from(
  new Set([...APP_STORE_LOCALES, ...PLAY_STORE_LOCALES])
).sort((a, b) => a.localeCompare(b));

export const LOCALE_CATALOG: LocaleCatalogEntry[] = ALL_STORE_LOCALES.map((locale) => ({
  locale,
  iosSupported: APP_STORE_SET.has(locale),
  androidSupported: PLAY_STORE_SET.has(locale),
}));

const SUPPORT_BY_LOCALE = new Map(
  LOCALE_CATALOG.map((entry) => [entry.locale, entry] as const)
);

export type LocaleMatrixRow = {
  locale: string;
  asc: boolean;
  android: boolean;
  iosSupported: boolean;
  androidSupported: boolean;
};

export function buildLocaleMatrix(options: {
  knownLocales?: string[];
  ascLocales: string[];
  playLocales: string[];
}): LocaleMatrixRow[] {
  const ascSet = new Set(options.ascLocales.map(toCanonical));
  const playSet = new Set(options.playLocales.map(toCanonical));
  const allLocales = new Set<string>([
    ...(options.knownLocales ?? ALL_STORE_LOCALES).map(toCanonical),
    ...options.ascLocales.map(toCanonical),
    ...options.playLocales.map(toCanonical),
  ]);

  return Array.from(allLocales)
    .sort((a, b) => a.localeCompare(b))
    .map((locale) => {
      const support = SUPPORT_BY_LOCALE.get(locale);
      return {
        locale,
        asc: ascSet.has(locale),
        android: playSet.has(locale),
        iosSupported: support?.iosSupported ?? false,
        androidSupported: support?.androidSupported ?? false,
      };
    });
}
