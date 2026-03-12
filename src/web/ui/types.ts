export type StoreId = "app_store" | "play_store";

export type LocaleCatalogEntry = {
  locale: string;
  iosSupported: boolean;
  androidSupported: boolean;
};

export type AppRecord = {
  id: number;
  canonicalName: string;
  sourceLocale: string;
  androidPackageName?: string;
  ascAppId?: string;
  createdAt: string;
  updatedAt: string;
};

export type AppListItem = AppRecord & {
  appStoreLocaleCount: number;
  playStoreLocaleCount: number;
};

export type AppConfigForm = {
  canonicalName: string;
  sourceLocale: string;
  ascAppId: string;
  androidPackageName: string;
};

export type AppConfigField = keyof AppConfigForm;

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

export type MetaPayload = {
  storeRules: Record<StoreId, StoreRuleSet>;
  localeCatalog: LocaleCatalogEntry[];
  guidance?: {
    publishVsSave?: string;
    references?: string[];
  };
};

export type ScreenshotImage = {
  url: string;
  width?: number;
  height?: number;
};

export type ScreenshotGroup = {
  displayType: string;
  images: ScreenshotImage[];
};

export type AppStoreLocaleDetail = {
  store: "app_store";
  locale: string;
  appId: string;
  versionId: string;
  versionString?: string;
  fetchedAt: string;
  versionLocalization?: {
    lengths?: Record<string, number>;
    description?: string;
    promotionalText?: string;
    whatsNew?: string;
    keywords?: string;
    supportUrl?: string;
    marketingUrl?: string;
  };
  screenshots?: ScreenshotGroup[];
  appInfo?: {
    name?: string;
    subtitle?: string;
    privacyPolicyUrl?: string;
  };
};

export type PlayStoreLocaleDetail = {
  store: "play_store";
  locale: string;
  packageName: string;
  editId: string;
  fetchedAt: string;
  listing?: {
    lengths?: Record<string, number>;
    title?: string;
    shortDescription?: string;
    fullDescription?: string;
  };
  screenshots?: ScreenshotGroup[];
};

export type StoreLocaleDetail = AppStoreLocaleDetail | PlayStoreLocaleDetail;

export type StoreLocaleDetailsListPayload = {
  appId: number;
  store: StoreId | "both";
  count: number;
  entries: Array<{
    appId: number;
    store: StoreId;
    locale: string;
    syncedAt: string;
    detail?: StoreLocaleDetail;
  }>;
};

export type StoreLocalesPayload = {
  appId: number;
  appStoreLocales: string[];
  playStoreLocales: string[];
};

export type AppStoreIapDetail = {
  productId: string;
  referenceName?: string;
  inAppPurchaseType?: string;
  state?: string;
  familySharable?: boolean;
  localizations?: Array<{
    locale: string;
    name?: string;
    description?: string;
    state?: string;
  }>;
};

export type PlayStoreIapDetail = {
  productId: string;
  status?: string;
  purchaseType?: string;
  defaultLanguage?: string;
  listings?: Array<{
    locale: string;
    title?: string;
    description?: string;
    benefits?: string[];
  }>;
};

export type StoreIapEntry = {
  appId: number;
  store: StoreId;
  productId: string;
  syncedAt: string;
  detail?: AppStoreIapDetail | PlayStoreIapDetail;
};

export type IapListPayload = {
  appId: number;
  appStoreIaps: StoreIapEntry[];
  playStoreIaps: StoreIapEntry[];
  counts?: {
    appStore: number;
    playStore: number;
  };
};

export type ScreenshotPalettePayload = {
  accent: string;
  bgDark: string;
  bgInk: string;
  cream: string;
  muted: string;
  phoneColor: string;
};

export type ScreenshotSlotPaletteMapPayload = Partial<Record<number, ScreenshotPalettePayload>>;
export type ScreenshotSlotTitleMapPayload = Partial<Record<number, string>>;
export type ScreenshotSlotTitleExtraLineColorsMapPayload = Partial<Record<number, string[]>>;
export type ScreenshotSlotTitleLineGapMapPayload = Partial<Record<number, number>>;
export type ScreenshotTitleTypographyPayload = {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
};
export type ScreenshotSlotTitleTypographyMapPayload =
  Partial<Record<number, ScreenshotTitleTypographyPayload>>;

export type ScreenshotHeroPhonePosePayload = {
  rotateX: number;
  rotateY: number;
  rotateZ: number;
};

export type ScreenshotHeroPhoneShapePayload = {
  widthMm: number;
  lengthMm: number;
  thicknessMm: number;
  edgeSmoothnessMm: number;
  islandWidthMm: number;
  islandLengthMm: number;
  islandRadiusMm: number;
};

export type ScreenshotHeroPhoneLocationPayload = {
  x: number;
  y: number;
  z: number;
};

export type ScreenshotHeroLightPositionPayload = {
  x: number;
  y: number;
  z: number;
};

export type ScreenshotHeroLightSettingsPayload = {
  azimuthDeg: number;
  elevationDeg: number;
  distance: number;
  intensity: number;
  color: string;
};

export type ScreenshotHeroCameraSettingsPayload = {
  perspectiveFov: number;
  orthographicFrustumHeight: number;
};

export type ScreenshotSlot1SbePayload = {
  lineWidth: number;
  lineColor: string;
  opacity: number;
  scale: number;
  angleDeg: number;
  copyCount: number;
  positionX: number;
  positionY: number;
  originX: number;
  originY: number;
  originZ: number;
};

export type ScreenshotSlotSbeMapPayload = Partial<Record<number, ScreenshotSlot1SbePayload>>;

export type ScreenshotRendererPayload = {
  template: string;
  engine: string;
  runtime?: string;
  canvasSize: { width: number; height: number };
  note?: string;
};

export type ScreenshotGenerateResponse = {
  appId: number;
  store: import('../screenshotTemplates/screenshotStores').ScreenshotStore;
  locale: string;
  slot: number;
  title: string;
  palette?: ScreenshotPalettePayload;
  heroPhonePose?: ScreenshotHeroPhonePosePayload | null;
  heroPhoneShape?: ScreenshotHeroPhoneShapePayload | null;
  heroPhoneLocation?: ScreenshotHeroPhoneLocationPayload | null;
  heroKeyLightPosition?: ScreenshotHeroLightPositionPayload | null;
  heroKeyLightSettings?: ScreenshotHeroLightSettingsPayload | null;
  slotSbeSettings?: ScreenshotSlotSbeMapPayload;
  heroCameraMode?: import('../screenshotTemplates/proceduralDeviceConfig').ProceduralCameraMode | null;
  heroCameraSettings?: ScreenshotHeroCameraSettingsPayload | null;
  stagedInputPath: string;
  outputPath: string;
  message: string;
  renderer?: ScreenshotRendererPayload;
};

export type ScreenshotPresetPayload = {
  store: import('../screenshotTemplates/screenshotStores').ScreenshotStore;
  label: string;
  palette: ScreenshotPalettePayload;
  slotPalettes?: ScreenshotSlotPaletteMapPayload;
  slotTitles?: ScreenshotSlotTitleMapPayload;
  slotTitleExtraLineColors?: ScreenshotSlotTitleExtraLineColorsMapPayload;
  slotTitleLineGaps?: ScreenshotSlotTitleLineGapMapPayload;
  slotTitleTypography?: ScreenshotSlotTitleTypographyMapPayload;
  heroPhonePose: ScreenshotHeroPhonePosePayload | null;
  heroPhoneShape: ScreenshotHeroPhoneShapePayload | null;
  heroPhoneLocation: ScreenshotHeroPhoneLocationPayload | null;
  heroKeyLightPosition: ScreenshotHeroLightPositionPayload | null;
  heroKeyLightSettings: ScreenshotHeroLightSettingsPayload | null;
  slotSbeSettings?: ScreenshotSlotSbeMapPayload;
  heroCameraMode: import('../screenshotTemplates/proceduralDeviceConfig').ProceduralCameraMode | null;
  heroCameraSettings: ScreenshotHeroCameraSettingsPayload | null;
  updatedAt: string;
};

export type ScreenshotPresetListResponse = {
  appId: number;
  presets: ScreenshotPresetPayload[];
};

export type ScreenshotPresetResponse = {
  appId: number;
  preset: ScreenshotPresetPayload;
};

export type StoreLocaleDetailPayload = {
  appId: number;
  store: StoreId;
  locale: string;
  syncedAt: string;
  detail?: StoreLocaleDetail;
};

export type StoreFieldChangePayload = {
  store: StoreId;
  locale: string;
  field: string;
  originalValue: string;
  nextValue: string;
};

export type PendingStoreFieldChange = {
  kind: "field";
  key: string;
  store: StoreId;
  locale: string;
  field: string;
  oldValue: string;
  newValue: string;
};

export type PendingStoreLocaleChange = {
  kind: "locale";
  key: string;
  store: StoreId;
  locale: string;
  action: "add" | "remove";
};

export type PendingStoreIapFieldChange = {
  kind: "iap_field";
  key: string;
  store: StoreId;
  productId: string;
  iapType?: string;
  locale: string;
  field: string;
  oldValue: string;
  newValue: string;
};

export type PendingStoreChange =
  | PendingStoreFieldChange
  | PendingStoreLocaleChange
  | PendingStoreIapFieldChange;

export type PendingStoreChangeMap = Record<string, PendingStoreChange>;
export type PendingValueMap = Record<string, string>;

export type StorePanelState<TDetail extends StoreLocaleDetail | null> = {
  locales: string[];
  selectedLocale: string;
  detail: TDetail;
  isLoading: boolean;
  visible: boolean;
};

export type AppStorePanelState = StorePanelState<AppStoreLocaleDetail | null>;
export type PlayStorePanelState = StorePanelState<PlayStoreLocaleDetail | null>;

export type SyncResponse = {
  errors?: Array<{ store: StoreId; message: string }>;
  appStore?: {
    synced?: boolean;
    iapCount?: number;
    iapSynced?: boolean;
    iapError?: string;
  };
  playStore?: {
    synced?: boolean;
    iapCount?: number;
    iapSynced?: boolean;
    iapError?: string;
  };
};
