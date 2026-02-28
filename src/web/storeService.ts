import { AscClient } from "../ascClient.js";
import {
  AppStoreVersionAttributes,
  AppScreenshotSetAttributes,
  AppScreenshotAttributes,
  AscResource,
} from "../ascTypes.js";
import { loadEnvConfig, requireValue } from "../config.js";
import { GpcClient } from "../gpcClient.js";
import { GpcImagesListResponse } from "../gpcTypes.js";
import { AppRecord, LocaleRecord } from "./db.js";
import { toCanonical } from "./localeCatalog.js";
import { type StoreId } from "./storeRules.js";

export type ScreenshotImage = {
  url: string;
  width: number;
  height: number;
};

export type ScreenshotEntry = {
  displayType: string;
  images: ScreenshotImage[];
};

export type LocaleSnapshot = {
  locale: string;
  lengths: Record<string, number>;
};

export type AppStoreLocaleSnapshot = LocaleSnapshot & {
  description?: string;
  promotionalText?: string;
  whatsNew?: string;
  keywords?: string;
  supportUrl?: string;
  marketingUrl?: string;
  screenshots?: ScreenshotEntry[];
};

export type PlayStoreLocaleSnapshot = LocaleSnapshot & {
  title?: string;
  shortDescription?: string;
  fullDescription?: string;
  screenshots?: ScreenshotEntry[];
};

export type AppStoreSnapshot = {
  store: "app_store";
  appId: string;
  versionId: string;
  versionString?: string;
  locales: AppStoreLocaleSnapshot[];
  appInfoNames: Array<{
    locale: string;
    name?: string;
    subtitle?: string;
    privacyPolicyUrl?: string;
  }>;
  fetchedAt: string;
};

export type PlayStoreSnapshot = {
  store: "play_store";
  packageName: string;
  editId: string;
  locales: PlayStoreLocaleSnapshot[];
  fetchedAt: string;
};

export type StoreConnectionResult = {
  ok: boolean;
  store: StoreId;
  message: string;
  metadata?: Record<string, unknown>;
};

export type LocaleWorkload = {
  configuredLocales: string[];
  remoteLocales: string[];
  overlapLocales: string[];
  missingInRemote: string[];
  unmanagedInConfig: string[];
};

function nowIso(): string {
  return new Date().toISOString();
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
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

function buildLocaleWorkload(configuredLocales: string[], remoteLocales: string[]): LocaleWorkload {
  const configuredSet = new Set(unique(configuredLocales));
  const remoteSet = new Set(unique(remoteLocales));

  const overlapLocales = Array.from(configuredSet).filter((locale) => remoteSet.has(locale));
  const missingInRemote = Array.from(configuredSet).filter((locale) => !remoteSet.has(locale));
  const unmanagedInConfig = Array.from(remoteSet).filter((locale) => !configuredSet.has(locale));

  overlapLocales.sort();
  missingInRemote.sort();
  unmanagedInConfig.sort();

  return {
    configuredLocales: Array.from(configuredSet).sort(),
    remoteLocales: Array.from(remoteSet).sort(),
    overlapLocales,
    missingInRemote,
    unmanagedInConfig,
  };
}

type AscVersionResponse = {
  data: Array<{
    id: string;
    attributes?: AppStoreVersionAttributes;
  }>;
};

type ResolvedAscVersion = {
  versionId: string;
  versionString?: string;
};

type AscLocalizationListResponse = {
  data: Array<{
    id: string;
    attributes?: {
      locale?: string;
      description?: string;
      promotionalText?: string;
      whatsNew?: string;
      keywords?: string;
      supportUrl?: string;
      marketingUrl?: string;
    };
  }>;
};

type AscAppInfoListResponse = {
  data: Array<{
    id: string;
    attributes?: {
      appStoreState?: string;
    };
  }>;
};

type AscAppInfoLocalizationResponse = {
  data: Array<{
    id: string;
    attributes?: {
      locale?: string;
      name?: string;
      subtitle?: string;
      privacyPolicyUrl?: string;
    };
  }>;
};

type AscScreenshotSetsResponse = {
  data: Array<AscResource<AppScreenshotSetAttributes> & {
    relationships?: {
      appScreenshots?: {
        data?: Array<{ id: string; type: string }>;
      };
    };
  }>;
  included?: Array<AscResource<AppScreenshotAttributes>>;
};

function ascTemplateUrlToReal(templateUrl: string, width: number, height: number): string {
  return templateUrl
    .replace("{w}", String(width))
    .replace("{h}", String(height))
    .replace("{f}", "png");
}

const GPC_IMAGE_TYPES = ["phoneScreenshots"] as const;

type GpcListingsListResponse = {
  listings?: Array<{
    language?: string;
    title?: string;
    shortDescription?: string;
    fullDescription?: string;
  }>;
};

export class StoreApiService {
  private resolveAscClient(): AscClient {
    const env = loadEnvConfig();
    const issuerId = requireValue(env.ascIssuerId, "ASC_ISSUER_ID");
    const keyId = requireValue(env.ascKeyId, "ASC_KEY_ID");
    const privateKeyPath = requireValue(env.ascPrivateKeyPath, "ASC_PRIVATE_KEY_PATH");

    return new AscClient({
      issuerId,
      keyId,
      privateKeyPath,
      baseUrl: env.ascBaseUrl,
    });
  }

  private resolveGpcClient(): GpcClient {
    const env = loadEnvConfig();
    const serviceAccountKeyPath = requireValue(
      env.gpcServiceAccountKeyPath,
      "GPC_SERVICE_ACCOUNT_KEY_PATH"
    );
    return new GpcClient({ serviceAccountKeyPath });
  }

  private async resolveLatestAscVersion(
    client: AscClient,
    appId: string
  ): Promise<ResolvedAscVersion> {
    const response = await client.get<AscVersionResponse>(
      `/v1/apps/${appId}/appStoreVersions`,
      {
        "fields[appStoreVersions]": [
          "versionString",
          "createdDate",
          "appVersionState",
          "platform",
        ],
        limit: 200,
      }
    );

    if (!response.data.length) {
      throw new Error("No App Store versions found for this app.");
    }

    let latest = response.data[0];

    for (const candidate of response.data.slice(1)) {
      const latestDate = latest.attributes?.createdDate
        ? Date.parse(latest.attributes.createdDate)
        : NaN;
      const candidateDate = candidate.attributes?.createdDate
        ? Date.parse(candidate.attributes.createdDate)
        : NaN;

      if (!Number.isNaN(candidateDate) && (Number.isNaN(latestDate) || candidateDate > latestDate)) {
        latest = candidate;
        continue;
      }

      const comparison = compareVersionStrings(
        candidate.attributes?.versionString,
        latest.attributes?.versionString
      );
      if (comparison !== null && comparison > 0) {
        latest = candidate;
      }
    }

    const rawVersionString = latest.attributes?.versionString;
    const versionString =
      typeof rawVersionString === "string" && rawVersionString.trim().length > 0
        ? rawVersionString.trim()
        : undefined;

    return {
      versionId: latest.id,
      versionString,
    };
  }

  async testAppStoreConnection(app: AppRecord): Promise<StoreConnectionResult> {
    if (!app.ascAppId) {
      return {
        ok: false,
        store: "app_store",
        message: "App Store connection skipped: ascAppId is missing on app config.",
      };
    }

    const client = this.resolveAscClient();
    const payload = await client.get<{ data?: { id?: string; attributes?: { name?: string } } }>(
      `/v1/apps/${app.ascAppId}`
    );

    return {
      ok: true,
      store: "app_store",
      message: "App Store Connect API reachable.",
      metadata: {
        appId: payload.data?.id,
        appName: payload.data?.attributes?.name,
      },
    };
  }

  async testPlayStoreConnection(app: AppRecord): Promise<StoreConnectionResult> {
    if (!app.androidPackageName) {
      return {
        ok: false,
        store: "play_store",
        message: "Play connection skipped: androidPackageName is missing on app config.",
      };
    }

    const client = this.resolveGpcClient();
    let editId: string | undefined;
    try {
      editId = await client.createEdit(app.androidPackageName);
      const listingResponse = await client.get<GpcListingsListResponse>(
        `/androidpublisher/v3/applications/${app.androidPackageName}/edits/${editId}/listings`
      );

      return {
        ok: true,
        store: "play_store",
        message: "Google Play Developer API reachable.",
        metadata: {
          packageName: app.androidPackageName,
          listingCount: listingResponse.listings?.length ?? 0,
          editId,
        },
      };
    } finally {
      if (editId) {
        try {
          await client.deleteEdit(app.androidPackageName, editId);
        } catch {
          // Ignore cleanup failures in connectivity probes.
        }
      }
    }
  }

  async fetchAppStoreSnapshot(app: AppRecord): Promise<AppStoreSnapshot> {
    const ascAppId = app.ascAppId;
    if (!ascAppId) {
      throw new Error("Cannot fetch App Store snapshot: ascAppId is missing.");
    }

    const client = this.resolveAscClient();
    const resolvedVersion = await this.resolveLatestAscVersion(client, ascAppId);
    const versionId = resolvedVersion.versionId;

    let localizationPayload: AscLocalizationListResponse;
    try {
      localizationPayload = await client.get<AscLocalizationListResponse>(
        `/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations`,
        {
          "fields[appStoreVersionLocalizations]": [
            "locale",
            "description",
            "promotionalText",
            "whatsNew",
            "keywords",
            "supportUrl",
            "marketingUrl",
          ],
          limit: 200,
        }
      );
    } catch {
      localizationPayload = await client.get<AscLocalizationListResponse>(
        `/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations`,
        {
          "fields[appStoreVersionLocalizations]": [
            "locale",
            "description",
            "promotionalText",
            "whatsNew",
            "keywords",
          ],
          limit: 200,
        }
      );
    }

    const validRows = (localizationPayload.data ?? []).filter(
      (row) => row.attributes?.locale
    );

    // Fetch screenshots for all locales in parallel
    const screenshotResults = await Promise.allSettled(
      validRows.map(async (row) => {
        const setsResponse = await client.get<AscScreenshotSetsResponse>(
          `/v1/appStoreVersionLocalizations/${row.id}/appScreenshotSets`,
          {
            "fields[appScreenshotSets]": ["screenshotDisplayType"],
            include: ["appScreenshots"],
            "fields[appScreenshots]": ["imageAsset", "fileName"],
            limit: 200,
          }
        );

        const includedById = new Map<string, AscResource<AppScreenshotAttributes>>();
        for (const inc of setsResponse.included ?? []) {
          includedById.set(inc.id, inc);
        }

        const entries: ScreenshotEntry[] = [];
        for (const setItem of setsResponse.data ?? []) {
          const displayType = setItem.attributes?.screenshotDisplayType;
          if (!displayType) continue;

          const relIds = setItem.relationships?.appScreenshots?.data ?? [];
          const images: ScreenshotImage[] = [];
          for (const rel of relIds) {
            const included = includedById.get(rel.id);
            const asset = included?.attributes?.imageAsset;
            if (asset?.templateUrl && asset.width && asset.height) {
              images.push({
                url: ascTemplateUrlToReal(asset.templateUrl, asset.width, asset.height),
                width: asset.width,
                height: asset.height,
              });
            }
          }

          if (images.length > 0) {
            entries.push({ displayType, images });
          }
        }
        return entries.length > 0 ? entries : undefined;
      })
    );

    const locales: AppStoreLocaleSnapshot[] = validRows.map((row, i) => {
      const attrs = row.attributes ?? {};
      const locale = toCanonical(attrs.locale!);
      const result = screenshotResults[i];
      const screenshots = result.status === "fulfilled" ? result.value : undefined;

      return {
        locale,
        lengths: {
          description: attrs.description?.length ?? 0,
          promotionalText: attrs.promotionalText?.length ?? 0,
          whatsNew: attrs.whatsNew?.length ?? 0,
          keywords: attrs.keywords?.length ?? 0,
          supportUrl: attrs.supportUrl?.length ?? 0,
          marketingUrl: attrs.marketingUrl?.length ?? 0,
        },
        description: attrs.description,
        promotionalText: attrs.promotionalText,
        whatsNew: attrs.whatsNew,
        keywords: attrs.keywords,
        supportUrl: attrs.supportUrl,
        marketingUrl: attrs.marketingUrl,
        screenshots,
      };
    });
    locales.sort((a, b) => a.locale.localeCompare(b.locale));

    const appInfos = await client.get<AscAppInfoListResponse>(`/v1/apps/${ascAppId}/appInfos`, {
      limit: 200,
    });

    let appInfoNames: AppStoreSnapshot["appInfoNames"] = [];
    const appInfoId = appInfos.data?.[0]?.id;
    if (appInfoId) {
      let namePayload: AscAppInfoLocalizationResponse;
      try {
        namePayload = await client.get<AscAppInfoLocalizationResponse>(
          `/v1/appInfos/${appInfoId}/appInfoLocalizations`,
          {
            "fields[appInfoLocalizations]": [
              "locale",
              "name",
              "subtitle",
              "privacyPolicyUrl",
            ],
            limit: 200,
          }
        );
      } catch {
        namePayload = await client.get<AscAppInfoLocalizationResponse>(
          `/v1/appInfos/${appInfoId}/appInfoLocalizations`,
          {
            "fields[appInfoLocalizations]": ["locale", "name", "subtitle"],
            limit: 200,
          }
        );
      }

      appInfoNames = (namePayload.data ?? [])
        .map((entry) => ({
          locale: toCanonical(entry.attributes?.locale ?? ""),
          name: entry.attributes?.name,
          subtitle: entry.attributes?.subtitle,
          privacyPolicyUrl: entry.attributes?.privacyPolicyUrl,
        }))
        .filter((entry) => entry.locale.length > 0)
        .sort((a, b) => a.locale.localeCompare(b.locale));
    }

    return {
      store: "app_store",
      appId: ascAppId,
      versionId,
      versionString: resolvedVersion.versionString,
      locales,
      appInfoNames,
      fetchedAt: nowIso(),
    };
  }

  async fetchPlayStoreSnapshot(app: AppRecord): Promise<PlayStoreSnapshot> {
    const packageName = app.androidPackageName;
    if (!packageName) {
      throw new Error("Cannot fetch Play snapshot: androidPackageName is missing.");
    }

    const client = this.resolveGpcClient();
    const editId = await client.createEdit(packageName);

    try {
      const payload = await client.get<GpcListingsListResponse>(
        `/androidpublisher/v3/applications/${packageName}/edits/${editId}/listings`
      );

      const validListings = (payload.listings ?? []).filter(
        (listing) => listing.language
      );

      // Fetch screenshots for all locales in parallel
      const screenshotResults = await Promise.allSettled(
        validListings.map(async (listing) => {
          const entries: ScreenshotEntry[] = [];
          for (const imageType of GPC_IMAGE_TYPES) {
            const imagesResponse = await client.get<GpcImagesListResponse>(
              `/androidpublisher/v3/applications/${packageName}/edits/${editId}/listings/${listing.language}/${imageType}`
            );
            const images: ScreenshotImage[] = [];
            for (const img of imagesResponse.images ?? []) {
              if (img.url) {
                images.push({ url: img.url, width: 0, height: 0 });
              }
            }
            if (images.length > 0) {
              entries.push({ displayType: imageType, images });
            }
          }
          return entries.length > 0 ? entries : undefined;
        })
      );

      const locales: PlayStoreLocaleSnapshot[] = validListings.map((listing, i) => {
        const result = screenshotResults[i];
        const screenshots = result.status === "fulfilled" ? result.value : undefined;

        return {
          locale: toCanonical(listing.language!),
          lengths: {
            title: listing.title?.length ?? 0,
            shortDescription: listing.shortDescription?.length ?? 0,
            fullDescription: listing.fullDescription?.length ?? 0,
          },
          title: listing.title,
          shortDescription: listing.shortDescription,
          fullDescription: listing.fullDescription,
          screenshots,
        };
      });
      locales.sort((a, b) => a.locale.localeCompare(b.locale));

      return {
        store: "play_store",
        packageName,
        editId,
        locales,
        fetchedAt: nowIso(),
      };
    } finally {
      try {
        await client.deleteEdit(packageName, editId);
      } catch {
        // Ignore cleanup errors during snapshot fetch.
      }
    }
  }

  async computeWorkload(options: {
    app: AppRecord;
    localeRows: LocaleRecord[];
    includeRemote?: boolean;
  }): Promise<{
    appStore: {
      configuredCount: number;
      remoteCount?: number;
      workload: LocaleWorkload;
      highLoad: boolean;
    };
    playStore: {
      configuredCount: number;
      remoteCount?: number;
      workload: LocaleWorkload;
      highLoad: boolean;
    };
    fetchedAt: string;
  }> {
    const appStoreConfigured = options.localeRows
      .filter((row) => row.store === "app_store" && row.enabled)
      .map((row) => row.locale);

    const playConfigured = options.localeRows
      .filter((row) => row.store === "play_store" && row.enabled)
      .map((row) => row.locale);

    let appStoreRemote: string[] = [];
    let playRemote: string[] = [];

    if (options.includeRemote) {
      try {
        const snapshot = await this.fetchAppStoreSnapshot(options.app);
        appStoreRemote = snapshot.locales.map((item) => item.locale);
      } catch {
        appStoreRemote = [];
      }

      try {
        const snapshot = await this.fetchPlayStoreSnapshot(options.app);
        playRemote = snapshot.locales.map((item) => item.locale);
      } catch {
        playRemote = [];
      }
    }

    const appStoreWorkload = buildLocaleWorkload(appStoreConfigured, appStoreRemote);
    const playStoreWorkload = buildLocaleWorkload(playConfigured, playRemote);

    return {
      appStore: {
        configuredCount: appStoreConfigured.length,
        remoteCount: appStoreRemote.length,
        workload: appStoreWorkload,
        highLoad: appStoreConfigured.length >= 40,
      },
      playStore: {
        configuredCount: playConfigured.length,
        remoteCount: playRemote.length,
        workload: playStoreWorkload,
        highLoad: playConfigured.length >= 40,
      },
      fetchedAt: nowIso(),
    };
  }
}
