import { AscClient, type QueryValue } from "../ascClient.js";
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
import { toCanonical, toStoreLocale } from "./localeCatalog.js";
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

export type AppStoreIapLocalizationSnapshot = {
  locale: string;
  name?: string;
  description?: string;
  state?: string;
};

export type AppStoreIapSnapshot = {
  productId: string;
  referenceName?: string;
  inAppPurchaseType?: string;
  state?: string;
  familySharable?: boolean;
  localizations: AppStoreIapLocalizationSnapshot[];
};

export type AppStoreIapCatalog = {
  store: "app_store";
  appId: string;
  items: AppStoreIapSnapshot[];
  fetchedAt: string;
};

export type PlayStoreIapListingSnapshot = {
  locale: string;
  title?: string;
  description?: string;
  benefits?: string[];
};

export type PlayStoreIapSnapshot = {
  productId: string;
  status?: string;
  purchaseType?: string;
  defaultLanguage?: string;
  listings: PlayStoreIapListingSnapshot[];
};

export type PlayStoreIapCatalog = {
  store: "play_store";
  packageName: string;
  items: PlayStoreIapSnapshot[];
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

const GPC_IMAGE_TYPES = [
  "phoneScreenshots",
  "sevenInchScreenshots",
  "tenInchScreenshots",
  "wearScreenshots",
  "tvScreenshots",
] as const;

type GpcListingsListResponse = {
  listings?: Array<{
    language?: string;
    title?: string;
    shortDescription?: string;
    fullDescription?: string;
  }>;
};

type AscInAppPurchasesV2Response = {
  data?: Array<{
    id: string;
    attributes?: {
      productId?: string;
      referenceName?: string;
      inAppPurchaseType?: string;
      state?: string;
      familySharable?: boolean;
    };
    relationships?: {
      inAppPurchaseLocalizations?: {
        links?: {
          related?: string;
        };
      };
    };
  }>;
  included?: Array<{
    id: string;
    type?: string;
    attributes?: {
      locale?: string;
      name?: string;
      description?: string;
      state?: string;
    };
    relationships?: {
      inAppPurchaseV2?: {
        data?: { id?: string };
      };
      inAppPurchase?: {
        data?: { id?: string };
      };
    };
  }>;
  links?: {
    next?: string;
  };
};

type GpcOneTimeProductListing = {
  languageCode?: string;
  title?: string;
  description?: string;
  benefits?: string[];
};

type GpcMapBasedIapListing = {
  title?: string;
  description?: string;
  benefits?: string[];
};

type GpcOneTimeProduct = {
  productId?: string;
  listings?: GpcOneTimeProductListing[] | Record<string, GpcMapBasedIapListing>;
  purchaseOptions?: Array<{
    state?: string;
  }>;
};

type GpcOneTimeProductsListResponse = {
  oneTimeProducts?: GpcOneTimeProduct[];
  nextPageToken?: string;
};

type GpcSubscriptionListing = {
  languageCode?: string;
  title?: string;
  description?: string;
  benefits?: string[];
};

type GpcSubscription = {
  productId?: string;
  listings?: GpcSubscriptionListing[] | Record<string, GpcMapBasedIapListing>;
  basePlans?: Array<{
    state?: string;
  }>;
};

type GpcSubscriptionsListResponse = {
  subscriptions?: GpcSubscription[];
  nextPageToken?: string;
};

type AscIapLocalizationListResponse = {
  data?: Array<{
    id: string;
    attributes?: {
      locale?: string;
      name?: string;
      description?: string;
      state?: string;
    };
  }>;
  links?: {
    next?: string;
  };
};

type AscIapLocalizationResource = {
  id: string;
  attributes?: {
    locale?: string;
    name?: string;
    description?: string;
    state?: string;
  };
};

type AscIapLookupEntry = {
  iapId: string;
  localizationsByLocale: Map<string, AscIapLocalizationResource>;
};

type AscIapLookupCacheEntry = {
  expiresAt: number;
  byProductId: Map<string, AscIapLookupEntry>;
};

type AscIapLookupResponse = {
  data?: Array<{
    id: string;
    attributes?: {
      productId?: string;
    };
  }>;
  included?: Array<{
    id: string;
    type?: string;
    attributes?: {
      locale?: string;
      name?: string;
      description?: string;
      state?: string;
    };
    relationships?: {
      inAppPurchaseV2?: {
        data?: { id?: string };
      };
      inAppPurchase?: {
        data?: { id?: string };
      };
    };
  }>;
};

type PlayIapLocalizationUpdateInput = {
  productId: string;
  iapType?: string;
  locale: string;
  title?: string;
  description?: string;
  benefits?: string[];
};

type GpcRegionsVersion = {
  version?: string;
};

const GPC_DEFAULT_REGIONS_VERSION = "2022/02";

export class StoreApiService {
  private ascIapLookupCache = new Map<string, AscIapLookupCacheEntry>();

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

  private toAscRelativePath(urlOrPath: string): string {
    const raw = (urlOrPath || "").trim();
    if (!raw) return "";
    if (raw.startsWith("/")) return raw;

    try {
      const parsed = new URL(raw);
      return `${parsed.pathname}${parsed.search}`;
    } catch {
      return raw.startsWith("?") ? `/${raw}` : `/${raw.replace(/^\/+/, "")}`;
    }
  }

  private async fetchAscPaginated<TData, TIncluded = never>(options: {
    client: AscClient;
    path: string;
    query?: Record<string, QueryValue>;
    maxPages?: number;
  }): Promise<{
    data: TData[];
    included: TIncluded[];
  }> {
    const allData: TData[] = [];
    const allIncluded: TIncluded[] = [];
    const seenPaths = new Set<string>();
    const maxPages = options.maxPages ?? 100;

    let currentPath = options.path;
    let currentQuery: Record<string, QueryValue> | undefined = options.query;
    for (let page = 0; page < maxPages; page += 1) {
      const fingerprint =
        page === 0
          ? JSON.stringify([currentPath, currentQuery ?? null])
          : JSON.stringify([currentPath, null]);
      if (seenPaths.has(fingerprint)) break;
      seenPaths.add(fingerprint);

      const payload = await options.client.get<{
        data?: TData[];
        included?: TIncluded[];
        links?: { next?: string };
      }>(currentPath, currentQuery);

      if (Array.isArray(payload.data)) {
        allData.push(...payload.data);
      }
      if (Array.isArray(payload.included)) {
        allIncluded.push(...payload.included);
      }

      const next = payload.links?.next?.trim();
      if (!next) break;
      currentPath = this.toAscRelativePath(next);
      currentQuery = undefined;
    }

    return { data: allData, included: allIncluded };
  }

  private mergeAppStoreIapLocalizations(
    ...groups: AppStoreIapLocalizationSnapshot[][]
  ): AppStoreIapLocalizationSnapshot[] {
    const byLocale = new Map<string, AppStoreIapLocalizationSnapshot>();
    const prefer = (incoming?: string, current?: string): string | undefined => {
      const next = incoming?.trim();
      if (next) return next;
      const prev = current?.trim();
      return prev || undefined;
    };

    for (const group of groups) {
      for (const item of group) {
        const locale = toCanonical(item.locale || "");
        if (!locale) continue;
        const existing = byLocale.get(locale);
        if (!existing) {
          byLocale.set(locale, {
            locale,
            name: prefer(item.name),
            description: prefer(item.description),
            state: prefer(item.state),
          });
          continue;
        }

        byLocale.set(locale, {
          locale,
          name: prefer(item.name, existing.name),
          description: prefer(item.description, existing.description),
          state: prefer(item.state, existing.state),
        });
      }
    }

    return Array.from(byLocale.values()).sort((a, b) => a.locale.localeCompare(b.locale));
  }

  private async fetchAscIapLocalizationsFromRelated(
    client: AscClient,
    relatedLink?: string
  ): Promise<AppStoreIapLocalizationSnapshot[]> {
    if (!relatedLink) return [];

    const path = this.toAscRelativePath(relatedLink);
    if (!path) return [];

    const payload = await this.fetchAscPaginated<
      NonNullable<AscIapLocalizationListResponse["data"]>[number]
    >({
      client,
      path,
      query: {
        "fields[inAppPurchaseLocalizations]": ["locale", "name", "description", "state"],
        limit: 200,
      },
    });

    const rows: AppStoreIapLocalizationSnapshot[] = [];
    for (const item of payload.data) {
      const locale = toCanonical(item.attributes?.locale ?? "");
      if (!locale) continue;
      rows.push({
        locale,
        name: item.attributes?.name,
        description: item.attributes?.description,
        state: item.attributes?.state,
      });
    }

    return this.mergeAppStoreIapLocalizations(rows);
  }

  private async buildAscIapLookup(
    client: AscClient,
    ascAppId: string
  ): Promise<Map<string, AscIapLookupEntry>> {
    const payload = await this.fetchAscPaginated<
      NonNullable<AscIapLookupResponse["data"]>[number],
      NonNullable<AscIapLookupResponse["included"]>[number]
    >({
      client,
      path: `/v1/apps/${ascAppId}/inAppPurchasesV2`,
      query: {
        "fields[inAppPurchasesV2]": ["productId"],
        "fields[inAppPurchaseLocalizations]": ["locale", "name", "description", "state"],
        include: ["inAppPurchaseLocalizations"],
        limit: 200,
      },
    });

    const byPurchaseId = new Map<string, AscIapLookupEntry>();
    const byProductId = new Map<string, AscIapLookupEntry>();

    for (const row of payload.data) {
      const iapId = row.id?.trim();
      const productId = row.attributes?.productId?.trim();
      if (!iapId || !productId) continue;
      const entry: AscIapLookupEntry = {
        iapId,
        localizationsByLocale: new Map<string, AscIapLocalizationResource>(),
      };
      byPurchaseId.set(iapId, entry);
      byProductId.set(productId, entry);
    }

    for (const inc of payload.included) {
      const locale = toCanonical(inc.attributes?.locale ?? "");
      if (!locale) continue;
      const parentId =
        inc.relationships?.inAppPurchaseV2?.data?.id ??
        inc.relationships?.inAppPurchase?.data?.id;
      if (!parentId) continue;
      const parent = byPurchaseId.get(parentId);
      if (!parent) continue;

      parent.localizationsByLocale.set(locale, {
        id: inc.id,
        attributes: {
          locale,
          name: inc.attributes?.name,
          description: inc.attributes?.description,
          state: inc.attributes?.state,
        },
      });
    }

    const missingLocalizationFetches: Promise<void>[] = [];
    for (const entry of byProductId.values()) {
      if (entry.localizationsByLocale.size > 0) continue;
      missingLocalizationFetches.push(
        (async () => {
          try {
            const iapPayload = await this.fetchAscPaginated<
              NonNullable<AscIapLocalizationListResponse["data"]>[number]
            >({
              client,
              path: `/v1/inAppPurchasesV2/${entry.iapId}/inAppPurchaseLocalizations`,
              query: {
                "fields[inAppPurchaseLocalizations]": ["locale", "name", "description", "state"],
                limit: 200,
              },
            });

            for (const item of iapPayload.data) {
              const locale = toCanonical(item.attributes?.locale ?? "");
              if (!locale || !item.id) continue;
              entry.localizationsByLocale.set(locale, {
                id: item.id,
                attributes: {
                  locale,
                  name: item.attributes?.name,
                  description: item.attributes?.description,
                  state: item.attributes?.state,
                },
              });
            }
          } catch {
            // Keep partial lookup; create flow can still proceed for missing locales.
          }
        })()
      );
    }
    if (missingLocalizationFetches.length > 0) {
      await Promise.all(missingLocalizationFetches);
    }

    return byProductId;
  }

  private async getAscIapLookup(
    client: AscClient,
    ascAppId: string,
    options?: { forceRefresh?: boolean }
  ): Promise<Map<string, AscIapLookupEntry>> {
    const forceRefresh = options?.forceRefresh ?? false;
    const now = Date.now();
    const cacheEntry = this.ascIapLookupCache.get(ascAppId);
    if (!forceRefresh && cacheEntry && cacheEntry.expiresAt > now) {
      return cacheEntry.byProductId;
    }

    const byProductId = await this.buildAscIapLookup(client, ascAppId);
    this.ascIapLookupCache.set(ascAppId, {
      byProductId,
      expiresAt: now + 60_000,
    });
    return byProductId;
  }

  private clearAscIapLookup(ascAppId: string): void {
    this.ascIapLookupCache.delete(ascAppId);
  }

  private normalizePlayIapType(iapType?: string): "one_time" | "subscription" | undefined {
    const normalized = (iapType ?? "").trim().toLowerCase();
    if (!normalized) return undefined;
    if (normalized.includes("sub")) return "subscription";
    if (
      normalized === "one_time" ||
      normalized === "one-time" ||
      normalized === "onetime" ||
      normalized === "managed_product" ||
      normalized === "managedproduct" ||
      normalized === "inapp" ||
      normalized === "one_time_product"
    ) {
      return "one_time";
    }
    return undefined;
  }

  private listPlayIapListingTitles(
    rawListings:
      | Array<GpcOneTimeProductListing | GpcSubscriptionListing>
      | Record<string, GpcMapBasedIapListing>
      | undefined
  ): Array<{ locale: string; title: string }> {
    const rows: Array<{ locale: string; title: string }> = [];

    const pushRow = (localeRaw: string, titleRaw: unknown): void => {
      const locale = toCanonical(localeRaw ?? "");
      if (!locale) return;
      if (typeof titleRaw !== "string") return;
      const title = titleRaw.trim();
      if (!title) return;
      rows.push({ locale, title });
    };

    if (Array.isArray(rawListings)) {
      for (const listing of rawListings) {
        pushRow(listing.languageCode ?? "", listing.title);
      }
      return rows;
    }

    if (!rawListings || typeof rawListings !== "object") return rows;
    for (const [locale, listing] of Object.entries(rawListings)) {
      pushRow(locale, listing?.title);
    }
    return rows;
  }

  private getPlayIapTitleForLocale(
    rawListings:
      | Array<GpcOneTimeProductListing | GpcSubscriptionListing>
      | Record<string, GpcMapBasedIapListing>
      | undefined,
    canonicalLocale: string
  ): string | undefined {
    const normalizedTarget = toCanonical(canonicalLocale);
    if (!normalizedTarget) return undefined;
    return this.listPlayIapListingTitles(rawListings).find(
      (row) => row.locale === normalizedTarget
    )?.title;
  }

  private resolvePlayIapTitleFallback(
    rawListings:
      | Array<GpcOneTimeProductListing | GpcSubscriptionListing>
      | Record<string, GpcMapBasedIapListing>
      | undefined,
    canonicalLocale: string
  ): string | undefined {
    const normalizedTarget = toCanonical(canonicalLocale);
    if (!normalizedTarget) return undefined;

    const exact = this.getPlayIapTitleForLocale(rawListings, normalizedTarget);
    if (exact) return exact;

    const targetLanguage = normalizedTarget.split("-")[0] ?? "";
    const rows = this.listPlayIapListingTitles(rawListings);
    let sameLanguage: string | undefined;
    let english: string | undefined;
    let any: string | undefined;

    for (const row of rows) {
      if (!any) any = row.title;
      const rowLanguage = row.locale.split("-")[0] ?? "";
      if (!sameLanguage && rowLanguage === targetLanguage) {
        sameLanguage = row.title;
      }
      if (!english && (row.locale === "en-US" || row.locale === "en")) {
        english = row.title;
      }
    }

    return sameLanguage ?? english ?? any;
  }

  private mergePlayIapListings(
    rawListings:
      | Array<GpcOneTimeProductListing | GpcSubscriptionListing>
      | Record<string, GpcMapBasedIapListing>
      | undefined,
    canonicalLocale: string,
    nextFields: {
      title?: string;
      description?: string;
      benefits?: string[];
    }
  ): Array<GpcOneTimeProductListing | GpcSubscriptionListing> | Record<string, GpcMapBasedIapListing> {
    const playLocale = toStoreLocale(canonicalLocale, "play_store");
    const titleFallback = this.resolvePlayIapTitleFallback(rawListings, canonicalLocale);
    const merged: GpcMapBasedIapListing = {};
    if (nextFields.title !== undefined) merged.title = nextFields.title;
    if (nextFields.description !== undefined) merged.description = nextFields.description;
    if (nextFields.benefits !== undefined) merged.benefits = nextFields.benefits;

    if (Array.isArray(rawListings)) {
      const nextListings = rawListings.map((entry) => ({ ...entry }));
      const index = nextListings.findIndex((entry) => {
        const candidate = toCanonical(entry.languageCode ?? "");
        return candidate === canonicalLocale;
      });
      if (index >= 0) {
        nextListings[index] = {
          ...nextListings[index],
          ...merged,
          languageCode: nextListings[index].languageCode ?? playLocale,
        };
        const title = nextListings[index].title?.trim();
        if (!title && titleFallback) {
          nextListings[index].title = titleFallback;
        }
      } else {
        const newEntry: GpcOneTimeProductListing | GpcSubscriptionListing = {
          languageCode: playLocale,
          ...merged,
        };
        if (!newEntry.title?.trim() && titleFallback) {
          newEntry.title = titleFallback;
        }
        nextListings.push(newEntry);
      }
      return nextListings;
    }

    const listingMap: Record<string, GpcMapBasedIapListing> =
      rawListings && typeof rawListings === "object" ? { ...rawListings } : {};

    let key = playLocale;
    for (const existingKey of Object.keys(listingMap)) {
      if (toCanonical(existingKey) === canonicalLocale) {
        key = existingKey;
        break;
      }
    }

    listingMap[key] = {
      ...(listingMap[key] ?? {}),
      ...merged,
    };
    if (!listingMap[key].title?.trim() && titleFallback) {
      listingMap[key].title = titleFallback;
    }
    return listingMap;
  }

  private resolvePlayRegionsVersion(product: unknown): string {
    if (!product || typeof product !== "object") return GPC_DEFAULT_REGIONS_VERSION;
    const row = product as { regionsVersion?: GpcRegionsVersion };
    const version = row.regionsVersion?.version?.trim();
    return version || GPC_DEFAULT_REGIONS_VERSION;
  }

  private async getPlayOneTimeProduct(
    client: GpcClient,
    packageName: string,
    productId: string
  ): Promise<GpcOneTimeProduct> {
    const encodedProductId = encodeURIComponent(productId);
    try {
      return await client.get<GpcOneTimeProduct>(
        `/androidpublisher/v3/applications/${packageName}/onetimeproducts/${encodedProductId}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/404|Not Found|not found/i.test(message)) throw error;
      return client.get<GpcOneTimeProduct>(
        `/androidpublisher/v3/applications/${packageName}/oneTimeProducts/${encodedProductId}`
      );
    }
  }

  private async patchPlayOneTimeProduct(
    client: GpcClient,
    packageName: string,
    productId: string,
    body: Record<string, unknown>,
    regionsVersion: string
  ): Promise<void> {
    const encodedProductId = encodeURIComponent(productId);
    const query = new URLSearchParams();
    query.set("updateMask", "listings");
    query.set("regionsVersion.version", regionsVersion);

    const withRegionsQuery = query.toString();
    const withoutRegions = new URLSearchParams();
    withoutRegions.set("updateMask", "listings");
    const withoutRegionsQuery = withoutRegions.toString();

    const attemptPatch = async (basePath: string, queryString: string): Promise<void> => {
      await client.patch(`${basePath}?${queryString}`, body);
    };

    const lowerBase = `/androidpublisher/v3/applications/${packageName}/onetimeproducts/${encodedProductId}`;
    const camelBase = `/androidpublisher/v3/applications/${packageName}/oneTimeProducts/${encodedProductId}`;

    try {
      await attemptPatch(lowerBase, withRegionsQuery);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const shouldRetryWithoutRegions =
        /regionsversion|unknown.*regions|invalid.*regions/i.test(message);

      if (shouldRetryWithoutRegions) {
        try {
          await attemptPatch(lowerBase, withoutRegionsQuery);
          return;
        } catch {
          // Fall through to alternative path below.
        }
      }

      if (!/404|Not Found|not found/i.test(message)) throw error;
    }

    try {
      await attemptPatch(camelBase, withRegionsQuery);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const shouldRetryWithoutRegions =
        /regionsversion|unknown.*regions|invalid.*regions/i.test(message);
      if (shouldRetryWithoutRegions) {
        await attemptPatch(camelBase, withoutRegionsQuery);
        return;
      }
      throw error;
    }
  }

  private async getPlaySubscription(
    client: GpcClient,
    packageName: string,
    productId: string
  ): Promise<GpcSubscription> {
    const encodedProductId = encodeURIComponent(productId);
    return client.get<GpcSubscription>(
      `/androidpublisher/v3/applications/${packageName}/subscriptions/${encodedProductId}`
    );
  }

  private async patchPlaySubscription(
    client: GpcClient,
    packageName: string,
    productId: string,
    body: Record<string, unknown>,
    regionsVersion: string
  ): Promise<void> {
    const encodedProductId = encodeURIComponent(productId);
    const query = new URLSearchParams();
    query.set("updateMask", "listings");
    query.set("regionsVersion.version", regionsVersion);
    const withRegionsQuery = query.toString();
    const withoutRegions = new URLSearchParams();
    withoutRegions.set("updateMask", "listings");
    const withoutRegionsQuery = withoutRegions.toString();

    const pathBase = `/androidpublisher/v3/applications/${packageName}/subscriptions/${encodedProductId}`;
    try {
      await client.patch(`${pathBase}?${withRegionsQuery}`, body);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/regionsversion|unknown.*regions|invalid.*regions/i.test(message)) {
        throw error;
      }
      await client.patch(`${pathBase}?${withoutRegionsQuery}`, body);
    }
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

  async fetchAppStoreIapCatalog(app: AppRecord): Promise<AppStoreIapCatalog> {
    const ascAppId = app.ascAppId;
    if (!ascAppId) {
      throw new Error("Cannot fetch App Store IAP catalog: ascAppId is missing.");
    }

    const client = this.resolveAscClient();

    let iapData: NonNullable<AscInAppPurchasesV2Response["data"]>;
    let iapIncluded: NonNullable<AscInAppPurchasesV2Response["included"]>;
    try {
      const payload = await this.fetchAscPaginated<
        NonNullable<AscInAppPurchasesV2Response["data"]>[number],
        NonNullable<AscInAppPurchasesV2Response["included"]>[number]
      >({
        client,
        path: `/v1/apps/${ascAppId}/inAppPurchasesV2`,
        query: {
          "fields[inAppPurchaseLocalizations]": ["locale", "name", "description", "state"],
          include: ["inAppPurchaseLocalizations"],
          limit: 200,
        },
      });
      iapData = payload.data;
      iapIncluded = payload.included;
    } catch {
      const payload = await this.fetchAscPaginated<
        NonNullable<AscInAppPurchasesV2Response["data"]>[number],
        NonNullable<AscInAppPurchasesV2Response["included"]>[number]
      >({
        client,
        path: `/v1/apps/${ascAppId}/inAppPurchasesV2`,
        query: { limit: 200 },
      });
      iapData = payload.data;
      iapIncluded = payload.included;
    }

    const localizationByPurchaseId = new Map<string, AppStoreIapLocalizationSnapshot[]>();
    for (const item of iapIncluded ?? []) {
      const rawLocale = item.attributes?.locale;
      if (!rawLocale) continue;

      const parentId =
        item.relationships?.inAppPurchaseV2?.data?.id ??
        item.relationships?.inAppPurchase?.data?.id;
      if (!parentId) continue;

      if (!localizationByPurchaseId.has(parentId)) {
        localizationByPurchaseId.set(parentId, []);
      }

      localizationByPurchaseId.get(parentId)!.push({
        locale: toCanonical(rawLocale),
        name: item.attributes?.name,
        description: item.attributes?.description,
        state: item.attributes?.state,
      });
    }

    const items: AppStoreIapSnapshot[] = [];
    for (const item of iapData ?? []) {
      const productId = item.attributes?.productId?.trim() || "";
      if (!productId) continue;

      const baseLocalizations = localizationByPurchaseId.get(item.id) ?? [];
      let relatedLocalizations: AppStoreIapLocalizationSnapshot[] = [];

      const relatedLink = item.relationships?.inAppPurchaseLocalizations?.links?.related;
      if (relatedLink) {
        try {
          relatedLocalizations = await this.fetchAscIapLocalizationsFromRelated(client, relatedLink);
        } catch {
          relatedLocalizations = [];
        }
      }

      const localizations = this.mergeAppStoreIapLocalizations(
        baseLocalizations,
        relatedLocalizations
      );

      items.push({
        productId,
        referenceName: item.attributes?.referenceName,
        inAppPurchaseType: item.attributes?.inAppPurchaseType,
        state: item.attributes?.state,
        familySharable: item.attributes?.familySharable,
        localizations,
      });
    }

    items.sort((a, b) => a.productId.localeCompare(b.productId));

    return {
      store: "app_store",
      appId: ascAppId,
      items,
      fetchedAt: nowIso(),
    };
  }

  async fetchPlayStoreIapCatalog(app: AppRecord): Promise<PlayStoreIapCatalog> {
    const packageName = app.androidPackageName;
    if (!packageName) {
      throw new Error("Cannot fetch Play IAP catalog: androidPackageName is missing.");
    }

    const client = this.resolveGpcClient();
    const byProductId = new Map<string, PlayStoreIapSnapshot>();

    const parseListings = (
      rawListings:
        | Array<GpcOneTimeProductListing | GpcSubscriptionListing>
        | Record<string, GpcMapBasedIapListing>
        | undefined
    ): PlayStoreIapListingSnapshot[] => {
      const byLocale = new Map<string, PlayStoreIapListingSnapshot>();

      const upsert = (localeRaw: string, listing: GpcMapBasedIapListing): void => {
        const locale = toCanonical(localeRaw);
        if (!locale) return;
        const existing = byLocale.get(locale);
        const next: PlayStoreIapListingSnapshot = {
          locale,
          title: listing.title?.trim() || existing?.title,
          description: listing.description?.trim() || existing?.description,
          benefits: Array.isArray(listing.benefits)
            ? listing.benefits.filter((entry): entry is string => typeof entry === "string")
            : existing?.benefits,
        };
        byLocale.set(locale, next);
      };

      if (Array.isArray(rawListings)) {
        for (const listing of rawListings) {
          upsert(listing.languageCode ?? "", listing);
        }
      } else if (rawListings && typeof rawListings === "object") {
        for (const [locale, listing] of Object.entries(rawListings)) {
          upsert(locale, listing ?? {});
        }
      }

      return Array.from(byLocale.values()).sort((a, b) => a.locale.localeCompare(b.locale));
    };

    const mergeListings = (
      base: PlayStoreIapListingSnapshot[],
      incoming: PlayStoreIapListingSnapshot[]
    ): PlayStoreIapListingSnapshot[] => {
      const byLocale = new Map<string, PlayStoreIapListingSnapshot>();
      for (const entry of [...base, ...incoming]) {
        const locale = toCanonical(entry.locale);
        if (!locale) continue;
        const existing = byLocale.get(locale);
        byLocale.set(locale, {
          locale,
          title: entry.title || existing?.title,
          description: entry.description || existing?.description,
          benefits: entry.benefits ?? existing?.benefits,
        });
      }
      return Array.from(byLocale.values()).sort((a, b) => a.locale.localeCompare(b.locale));
    };

    const fetchAllOneTimeProducts = async (): Promise<void> => {
      const seenPageTokens = new Set<string>();
      let currentPageToken: string | undefined;

      while (true) {
        if (currentPageToken && seenPageTokens.has(currentPageToken)) break;
        if (currentPageToken) seenPageTokens.add(currentPageToken);

        const search = new URLSearchParams();
        search.set("pageSize", "1000");
        if (currentPageToken) search.set("pageToken", currentPageToken);

        const payload = await client.get<GpcOneTimeProductsListResponse>(
          `/androidpublisher/v3/applications/${packageName}/oneTimeProducts?${search.toString()}`
        );

        for (const item of payload.oneTimeProducts ?? []) {
          const productId = (item.productId ?? "").trim();
          if (!productId) continue;

          const listings = parseListings(item.listings ?? []);
          const states = unique(
            (item.purchaseOptions ?? [])
              .map((purchaseOption) => purchaseOption.state?.trim())
              .filter((state): state is string => Boolean(state))
          );

          const existing = byProductId.get(productId);
          byProductId.set(productId, {
            productId,
            status: states.length > 0 ? states.join(", ") : existing?.status,
            purchaseType: "one_time",
            defaultLanguage: existing?.defaultLanguage ?? listings[0]?.locale,
            listings: mergeListings(existing?.listings ?? [], listings),
          });
        }

        const nextPageToken = payload.nextPageToken?.trim();
        if (!nextPageToken) break;
        currentPageToken = nextPageToken;
      }
    };

    const fetchAllSubscriptions = async (): Promise<void> => {
      const seenPageTokens = new Set<string>();
      let currentPageToken: string | undefined;

      while (true) {
        if (currentPageToken && seenPageTokens.has(currentPageToken)) break;
        if (currentPageToken) seenPageTokens.add(currentPageToken);

        const search = new URLSearchParams();
        search.set("pageSize", "1000");
        if (currentPageToken) search.set("pageToken", currentPageToken);

        const payload = await client.get<GpcSubscriptionsListResponse>(
          `/androidpublisher/v3/applications/${packageName}/subscriptions?${search.toString()}`
        );

        for (const item of payload.subscriptions ?? []) {
          const productId = (item.productId ?? "").trim();
          if (!productId) continue;

          const listings = parseListings(item.listings ?? []);
          const states = unique(
            (item.basePlans ?? [])
              .map((basePlan) => basePlan.state?.trim())
              .filter((state): state is string => Boolean(state))
          );

          const existing = byProductId.get(productId);
          byProductId.set(productId, {
            productId,
            status: states.length > 0 ? states.join(", ") : existing?.status,
            purchaseType: "subscription",
            defaultLanguage: existing?.defaultLanguage ?? listings[0]?.locale,
            listings: mergeListings(existing?.listings ?? [], listings),
          });
        }

        const nextPageToken = payload.nextPageToken?.trim();
        if (!nextPageToken) break;
        currentPageToken = nextPageToken;
      }
    };

    await Promise.all([fetchAllOneTimeProducts(), fetchAllSubscriptions()]);

    const items = Array.from(byProductId.values()).sort((a, b) => a.productId.localeCompare(b.productId));

    return {
      store: "play_store",
      packageName,
      items,
      fetchedAt: nowIso(),
    };
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

  // ---------------------------------------------------------------------------
  // ASC locale mutations
  // ---------------------------------------------------------------------------

  private async resolveAscAppInfoId(
    client: AscClient,
    ascAppId: string
  ): Promise<string> {
    const response = await client.get<AscAppInfoListResponse>(
      `/v1/apps/${ascAppId}/appInfos`,
      { limit: 1 }
    );
    const appInfoId = response.data?.[0]?.id;
    if (!appInfoId) {
      throw new Error(`No appInfo found for ascAppId: ${ascAppId}`);
    }
    return appInfoId;
  }

  async addAscLocale(
    app: AppRecord,
    canonicalLocale: string,
    fields?: Record<string, string>
  ): Promise<void> {
    const ascAppId = app.ascAppId;
    if (!ascAppId) throw new Error("ascAppId missing");

    const client = this.resolveAscClient();
    const { versionId } = await this.resolveLatestAscVersion(client, ascAppId);
    const storeLocale = toStoreLocale(canonicalLocale, "app_store");

    // Version localization: description, keywords, promotionalText, whatsNew
    const versionAttrs: Record<string, string> = { locale: storeLocale };
    if (fields?.description) versionAttrs.description = fields.description;
    if (fields?.keywords) versionAttrs.keywords = fields.keywords;
    if (fields?.promotionalText) versionAttrs.promotionalText = fields.promotionalText;
    if (fields?.whatsNew) versionAttrs.whatsNew = fields.whatsNew;

    await client.post(`/v1/appStoreVersionLocalizations`, {
      data: {
        type: "appStoreVersionLocalizations",
        attributes: versionAttrs,
        relationships: {
          appStoreVersion: {
            data: { id: versionId, type: "appStoreVersions" },
          },
        },
      },
    });

    // App info localization: name (appName), subtitle
    const appInfoAttrs: Record<string, string> = { locale: storeLocale };
    if (fields?.appName) appInfoAttrs.name = fields.appName;
    if (fields?.subtitle) appInfoAttrs.subtitle = fields.subtitle;

    const appInfoId = await this.resolveAscAppInfoId(client, ascAppId);
    await client.post(`/v1/appInfoLocalizations`, {
      data: {
        type: "appInfoLocalizations",
        attributes: appInfoAttrs,
        relationships: {
          appInfo: {
            data: { id: appInfoId, type: "appInfos" },
          },
        },
      },
    });
  }

  async deleteAscLocale(app: AppRecord, canonicalLocale: string): Promise<void> {
    const ascAppId = app.ascAppId;
    if (!ascAppId) throw new Error("ascAppId missing");

    const client = this.resolveAscClient();
    const { versionId } = await this.resolveLatestAscVersion(client, ascAppId);
    const storeLocale = toStoreLocale(canonicalLocale, "app_store");

    const versionLocPayload = await client.get<AscLocalizationListResponse>(
      `/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations`,
      { "fields[appStoreVersionLocalizations]": ["locale"], limit: 200 }
    );
    const versionLocId = versionLocPayload.data?.find(
      (row) => row.attributes?.locale === storeLocale
    )?.id;

    const appInfoId = await this.resolveAscAppInfoId(client, ascAppId);
    const appInfoLocPayload = await client.get<AscAppInfoLocalizationResponse>(
      `/v1/appInfos/${appInfoId}/appInfoLocalizations`,
      { "fields[appInfoLocalizations]": ["locale"], limit: 200 }
    );
    const appInfoLocId = appInfoLocPayload.data?.find(
      (row) => row.attributes?.locale === storeLocale
    )?.id;

    const deletions: Promise<void>[] = [];
    if (versionLocId) {
      deletions.push(client.delete(`/v1/appStoreVersionLocalizations/${versionLocId}`));
    }
    if (appInfoLocId) {
      deletions.push(client.delete(`/v1/appInfoLocalizations/${appInfoLocId}`));
    }
    await Promise.all(deletions);
  }

  // ---------------------------------------------------------------------------
  // ASC field update (PATCH existing localization)
  // ---------------------------------------------------------------------------

  async updateAscLocaleFields(
    app: AppRecord,
    canonicalLocale: string,
    fields: Record<string, string>
  ): Promise<void> {
    const ascAppId = app.ascAppId;
    if (!ascAppId) throw new Error("ascAppId missing");

    const client = this.resolveAscClient();
    const { versionId } = await this.resolveLatestAscVersion(client, ascAppId);
    const storeLocale = toStoreLocale(canonicalLocale, "app_store");

    // Patch version localization fields
    const versionFields: Record<string, string> = {};
    if (fields.description !== undefined) versionFields.description = fields.description;
    if (fields.keywords !== undefined) versionFields.keywords = fields.keywords;
    if (fields.promotionalText !== undefined) versionFields.promotionalText = fields.promotionalText;
    if (fields.whatsNew !== undefined) versionFields.whatsNew = fields.whatsNew;

    if (Object.keys(versionFields).length > 0) {
      const versionLocPayload = await client.get<AscLocalizationListResponse>(
        `/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations`,
        { "fields[appStoreVersionLocalizations]": ["locale"], limit: 200 }
      );
      const versionLocId = versionLocPayload.data?.find(
        (row) => row.attributes?.locale === storeLocale
      )?.id;
      if (versionLocId) {
        await client.patch(`/v1/appStoreVersionLocalizations/${versionLocId}`, {
          data: {
            id: versionLocId,
            type: "appStoreVersionLocalizations",
            attributes: versionFields,
          },
        });
      }
    }

    // Patch app info localization fields
    const appInfoFields: Record<string, string> = {};
    if (fields.appName !== undefined) appInfoFields.name = fields.appName;
    if (fields.subtitle !== undefined) appInfoFields.subtitle = fields.subtitle;

    if (Object.keys(appInfoFields).length > 0) {
      const appInfoId = await this.resolveAscAppInfoId(client, ascAppId);
      const appInfoLocPayload = await client.get<AscAppInfoLocalizationResponse>(
        `/v1/appInfos/${appInfoId}/appInfoLocalizations`,
        { "fields[appInfoLocalizations]": ["locale"], limit: 200 }
      );
      const appInfoLocId = appInfoLocPayload.data?.find(
        (row) => row.attributes?.locale === storeLocale
      )?.id;
      if (appInfoLocId) {
        await client.patch(`/v1/appInfoLocalizations/${appInfoLocId}`, {
          data: {
            id: appInfoLocId,
            type: "appInfoLocalizations",
            attributes: appInfoFields,
          },
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // GPC locale mutations — per-locale edits
  // ---------------------------------------------------------------------------

  async applyPlayStoreSingleLocale(
    app: AppRecord,
    locale: string,
    fields: Record<string, string>
  ): Promise<void> {
    const packageName = app.androidPackageName;
    if (!packageName) throw new Error("androidPackageName missing");

    const client = this.resolveGpcClient();
    const editId = await client.createEdit(packageName);

    try {
      const gpcLocale = toStoreLocale(locale, "play_store");
      await client.put(
        `/androidpublisher/v3/applications/${packageName}/edits/${editId}/listings/${gpcLocale}`,
        {
          language: gpcLocale,
          title: fields.title || "",
          shortDescription: fields.shortDescription || "",
          fullDescription: fields.fullDescription || "",
        }
      );
      await client.commitEdit(packageName, editId);
    } catch (error) {
      await client.deleteEdit(packageName, editId).catch(() => {});
      throw error;
    }
  }

  async deletePlayStoreSingleLocale(
    app: AppRecord,
    locale: string
  ): Promise<void> {
    const packageName = app.androidPackageName;
    if (!packageName) throw new Error("androidPackageName missing");

    const client = this.resolveGpcClient();
    const editId = await client.createEdit(packageName);

    try {
      const gpcLocale = toStoreLocale(locale, "play_store");
      await client.delete(
        `/androidpublisher/v3/applications/${packageName}/edits/${editId}/listings/${gpcLocale}`
      );
      await client.commitEdit(packageName, editId);
    } catch (error) {
      await client.deleteEdit(packageName, editId).catch(() => {});
      throw error;
    }
  }

  /** @deprecated Use applyPlayStoreSingleLocale / deletePlayStoreSingleLocale for per-locale resilience */
  async applyPlayStoreLocaleChanges(
    app: AppRecord,
    localesToAdd: Array<{ locale: string; fields: Record<string, string> }>,
    localesToRemove: string[]
  ): Promise<void> {
    const packageName = app.androidPackageName;
    if (!packageName) throw new Error("androidPackageName missing");

    const client = this.resolveGpcClient();
    const editId = await client.createEdit(packageName);

    try {
      for (const entry of localesToAdd) {
        const gpcLocale = toStoreLocale(entry.locale, "play_store");
        await client.put(
          `/androidpublisher/v3/applications/${packageName}/edits/${editId}/listings/${gpcLocale}`,
          {
            language: gpcLocale,
            title: entry.fields.title || "",
            shortDescription: entry.fields.shortDescription || "",
            fullDescription: entry.fields.fullDescription || "",
          }
        );
      }

      for (const canonicalLocale of localesToRemove) {
        const gpcLocale = toStoreLocale(canonicalLocale, "play_store");
        await client.delete(
          `/androidpublisher/v3/applications/${packageName}/edits/${editId}/listings/${gpcLocale}`
        );
      }

      await client.commitEdit(packageName, editId);
    } catch (error) {
      await client.deleteEdit(packageName, editId).catch(() => {});
      throw error;
    }
  }

  async updateAscIapLocalizationFields(
    app: AppRecord,
    input: {
      productId: string;
      locale: string;
      name?: string;
      description?: string;
    }
  ): Promise<void> {
    const ascAppId = app.ascAppId;
    if (!ascAppId) throw new Error("ascAppId missing");

    const productId = input.productId.trim();
    if (!productId) throw new Error("productId missing");
    const canonicalLocale = toCanonical(input.locale.trim());
    if (!canonicalLocale) throw new Error("locale missing");

    const fields: Record<string, string> = {};
    if (input.name !== undefined) fields.name = input.name;
    if (input.description !== undefined) fields.description = input.description;
    if (Object.keys(fields).length === 0) return;

    const client = this.resolveAscClient();
    const lookup = await this.getAscIapLookup(client, ascAppId);
    const entry = lookup.get(productId);
    if (!entry) {
      throw new Error(`App Store IAP bulunamadı: ${productId}`);
    }

    const existingLocalization = entry.localizationsByLocale.get(canonicalLocale);
    if (existingLocalization) {
      await client.patch(`/v1/inAppPurchaseLocalizations/${existingLocalization.id}`, {
        data: {
          id: existingLocalization.id,
          type: "inAppPurchaseLocalizations",
          attributes: fields,
        },
      });

      entry.localizationsByLocale.set(canonicalLocale, {
        ...existingLocalization,
        attributes: {
          ...(existingLocalization.attributes ?? {}),
          ...fields,
          locale: canonicalLocale,
        },
      });
      return;
    }

    const storeLocale = toStoreLocale(canonicalLocale, "app_store");
    const createBodyV2 = {
      data: {
        type: "inAppPurchaseLocalizations",
        attributes: {
          locale: storeLocale,
          ...fields,
        },
        relationships: {
          inAppPurchaseV2: {
            data: { id: entry.iapId, type: "inAppPurchasesV2" },
          },
        },
      },
    };

    const createBodyLegacy = {
      data: {
        type: "inAppPurchaseLocalizations",
        attributes: {
          locale: storeLocale,
          ...fields,
        },
        relationships: {
          inAppPurchase: {
            data: { id: entry.iapId, type: "inAppPurchases" },
          },
        },
      },
    };

    let response: { data?: { id?: string } } | null = null;
    try {
      response = await client.post<{ data?: { id?: string } }>(
        "/v1/inAppPurchaseLocalizations",
        createBodyV2
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/already exists|already.*localization|already.*used/i.test(message)) {
        const freshLookup = await this.getAscIapLookup(client, ascAppId, { forceRefresh: true });
        const freshEntry = freshLookup.get(productId);
        const freshLocalization = freshEntry?.localizationsByLocale.get(canonicalLocale);
        if (freshLocalization) {
          await client.patch(`/v1/inAppPurchaseLocalizations/${freshLocalization.id}`, {
            data: {
              id: freshLocalization.id,
              type: "inAppPurchaseLocalizations",
              attributes: fields,
            },
          });
          return;
        }
      }

      try {
        response = await client.post<{ data?: { id?: string } }>(
          "/v1/inAppPurchaseLocalizations",
          createBodyLegacy
        );
      } catch {
        throw error;
      }
    }

    const createdId = response?.data?.id?.trim();
    if (createdId) {
      entry.localizationsByLocale.set(canonicalLocale, {
        id: createdId,
        attributes: {
          locale: canonicalLocale,
          ...fields,
        },
      });
      return;
    }

    this.clearAscIapLookup(ascAppId);
  }

  async updatePlayIapLocalizationFields(
    app: AppRecord,
    input: PlayIapLocalizationUpdateInput
  ): Promise<void> {
    const packageName = app.androidPackageName;
    if (!packageName) throw new Error("androidPackageName missing");

    const productId = input.productId.trim();
    if (!productId) throw new Error("productId missing");

    const canonicalLocale = toCanonical(input.locale.trim());
    if (!canonicalLocale) throw new Error("locale missing");

    const sanitizedBenefits =
      input.benefits !== undefined
        ? input.benefits.map((entry) => entry.trim()).filter((entry) => entry.length > 0)
        : undefined;
    const hasAnyField =
      input.title !== undefined ||
      input.description !== undefined ||
      sanitizedBenefits !== undefined;
    if (!hasAnyField) return;

    const client = this.resolveGpcClient();
    const normalizedType = this.normalizePlayIapType(input.iapType);

    const applyOneTimeProduct = async (): Promise<void> => {
      const product = await this.getPlayOneTimeProduct(client, packageName, productId);
      const nextListings = this.mergePlayIapListings(product.listings, canonicalLocale, {
        title: input.title,
        description: input.description,
        benefits: sanitizedBenefits,
      });
      const targetTitle = this.getPlayIapTitleForLocale(nextListings, canonicalLocale);
      if (!targetTitle) {
        throw new Error(
          `Play IAP locale title boş: ${productId}/${canonicalLocale}. Bu locale için title da gönderin.`
        );
      }
      const regionsVersion = this.resolvePlayRegionsVersion(product);
      await this.patchPlayOneTimeProduct(
        client,
        packageName,
        productId,
        {
          packageName,
          productId,
          listings: nextListings,
        },
        regionsVersion
      );
    };

    const applySubscription = async (): Promise<void> => {
      const subscription = await this.getPlaySubscription(client, packageName, productId);
      const nextListings = this.mergePlayIapListings(subscription.listings, canonicalLocale, {
        title: input.title,
        description: input.description,
        benefits: sanitizedBenefits,
      });
      const targetTitle = this.getPlayIapTitleForLocale(nextListings, canonicalLocale);
      if (!targetTitle) {
        throw new Error(
          `Play IAP locale title boş: ${productId}/${canonicalLocale}. Bu locale için title da gönderin.`
        );
      }
      const regionsVersion = this.resolvePlayRegionsVersion(subscription);
      await this.patchPlaySubscription(
        client,
        packageName,
        productId,
        {
          packageName,
          productId,
          listings: nextListings,
        },
        regionsVersion
      );
    };

    if (normalizedType === "one_time") {
      await applyOneTimeProduct();
      return;
    }
    if (normalizedType === "subscription") {
      await applySubscription();
      return;
    }

    try {
      await applyOneTimeProduct();
    } catch (oneTimeError) {
      const message = oneTimeError instanceof Error ? oneTimeError.message : String(oneTimeError);
      if (!/404|Not Found|not found/i.test(message)) {
        throw oneTimeError;
      }
      await applySubscription();
    }
  }
}
