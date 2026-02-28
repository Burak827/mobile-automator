export type StoreId = "app_store" | "play_store";

export type StoreFieldRule = {
  minChars?: number;
  maxChars?: number;
  unit?: "chars" | "bytes";
  requiredForSave?: boolean;
  requiredForPublish: boolean;
  notes?: string;
};

export type ScreenshotRule = {
  requiredForPublish: boolean;
  minCount: number;
  notes: string;
  sourceUrl: string;
};

export type StoreRuleSet = {
  store: StoreId;
  displayName: string;
  localeLoadHint: "normal" | "high";
  fields: Record<string, StoreFieldRule>;
  screenshotRule: ScreenshotRule;
  sources: string[];
};

const APP_STORE_SOURCES = [
  "https://developer.apple.com/help/app-store-connect/reference/required-localizable-and-editable-properties/",
  "https://developer.apple.com/help/app-store-connect/manage-app-information/reference/app-information/",
  "https://developer.apple.com/help/app-store-connect/manage-platform-versions/view-and-edit-version-information/",
  "https://developer.apple.com/help/app-store-connect/reference/app-review-information/",
  "https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/",
];

const PLAY_STORE_SOURCES = [
  "https://support.google.com/googleplay/android-developer/answer/9866151",
  "https://support.google.com/googleplay/android-developer/answer/9859152",
];

export const STORE_RULES: Record<StoreId, StoreRuleSet> = {
  app_store: {
    store: "app_store",
    displayName: "App Store",
    localeLoadHint: "normal",
    fields: {
      appName: {
        minChars: 2,
        maxChars: 30,
        unit: "chars",
        requiredForSave: true,
        requiredForPublish: true,
        notes:
          "App Information: Name must be at least 2 and at most 30 characters.",
      },
      subtitle: {
        maxChars: 30,
        unit: "chars",
        requiredForSave: false,
        requiredForPublish: false,
        notes: "Optional. Max 30 characters.",
      },
      promotionalText: {
        maxChars: 170,
        unit: "chars",
        requiredForSave: false,
        requiredForPublish: false,
        notes: "Optional. Max 170 characters.",
      },
      keywords: {
        maxChars: 100,
        unit: "bytes",
        requiredForSave: true,
        requiredForPublish: true,
        notes:
          "Required. Up to 100 bytes total; each keyword must be longer than 2 characters.",
      },
      description: {
        maxChars: 4000,
        unit: "chars",
        requiredForSave: true,
        requiredForPublish: true,
        notes: "Required. Max 4000 characters.",
      },
      whatsNew: {
        maxChars: 4000,
        unit: "chars",
        requiredForSave: false,
        requiredForPublish: true,
        notes: "Required for app updates. Max 4000 characters.",
      },
    },
    screenshotRule: {
      requiredForPublish: true,
      minCount: 1,
      notes:
        "At least one screenshot is required per supported device size before submission.",
      sourceUrl:
        "https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/",
    },
    sources: APP_STORE_SOURCES,
  },
  play_store: {
    store: "play_store",
    displayName: "Google Play",
    localeLoadHint: "high",
    fields: {
      title: {
        maxChars: 30,
        unit: "chars",
        requiredForSave: true,
        requiredForPublish: true,
        notes: "App name in Main store listing. Max 30 characters.",
      },
      shortDescription: {
        maxChars: 80,
        unit: "chars",
        requiredForSave: true,
        requiredForPublish: true,
        notes: "Max 80 characters.",
      },
      fullDescription: {
        maxChars: 4000,
        unit: "chars",
        requiredForSave: true,
        requiredForPublish: true,
        notes: "Max 4000 characters.",
      },
    },
    screenshotRule: {
      requiredForPublish: true,
      minCount: 2,
      notes:
        "Google Play requires at least 2 screenshots across supported device types for publishing.",
      sourceUrl:
        "https://support.google.com/googleplay/android-developer/answer/9866151",
    },
    sources: PLAY_STORE_SOURCES,
  },
};

export type NamingIssueLevel = "error" | "warning";

export type NamingIssue = {
  level: NamingIssueLevel;
  locale: string;
  message: string;
};

export type NamingPayload = {
  locale: string;
  appStoreName?: string;
  appStoreKeywords?: string;
  playStoreTitle?: string;
  iosBundleDisplayName?: string;
};

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function checkLength(
  field: string,
  value: string,
  maxChars: number | undefined,
  locale: string,
  issues: NamingIssue[]
): void {
  if (typeof maxChars !== "number") return;
  if (value.length <= maxChars) return;
  issues.push({
    level: "error",
    locale,
    message: `${field} exceeds max length (${value.length}/${maxChars}).`,
  });
}

export function validateNamingConsistency(
  values: NamingPayload[]
): NamingIssue[] {
  const issues: NamingIssue[] = [];

  for (const row of values) {
    const locale = row.locale;

    if (row.appStoreName) {
      const appNameMax = STORE_RULES.app_store.fields.appName.maxChars;
      checkLength(
        "App Store name",
        row.appStoreName,
        appNameMax,
        locale,
        issues
      );
    }

    if (row.playStoreTitle) {
      const playTitleMax = STORE_RULES.play_store.fields.title.maxChars;
      checkLength(
        "Play title",
        row.playStoreTitle,
        playTitleMax,
        locale,
        issues
      );
    }

    if (row.appStoreKeywords) {
      const maxBytes = STORE_RULES.app_store.fields.keywords.maxChars;
      if (typeof maxBytes !== "number") continue;
      const bytes = utf8ByteLength(row.appStoreKeywords);
      if (bytes > maxBytes) {
        issues.push({
          level: "error",
          locale,
          message: `App Store keywords exceeds byte limit (${bytes}/${maxBytes}).`,
        });
      }
    }

    if (row.appStoreName && row.iosBundleDisplayName) {
      if (row.appStoreName.trim() !== row.iosBundleDisplayName.trim()) {
        issues.push({
          level: "warning",
          locale,
          message:
            "iOS bundle display name differs from App Store name. Keep CFBundleDisplayName aligned with store name.",
        });
      }
    }
  }

  return issues;
}

function escapeInfoPlistValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function renderInfoPlistStrings(appName: string): string {
  const escaped = escapeInfoPlistValue(appName);
  return [`\"CFBundleDisplayName\" = \"${escaped}\";`, `\"CFBundleName\" = \"${escaped}\";`].join("\n");
}
