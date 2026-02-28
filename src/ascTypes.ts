export type AscResource<TAttributes> = {
  id: string;
  type: string;
  attributes?: TAttributes;
};

export type AscListResponse<TAttributes> = {
  data: Array<AscResource<TAttributes>>;
};

export type AscSingleResponse<TAttributes> = {
  data: AscResource<TAttributes>;
};

export type AppStoreVersionAttributes = {
  versionString?: string;
  appVersionState?: string;
  platform?: string;
  createdDate?: string;
};

export type AppStoreVersionLocalizationAttributes = {
  locale?: string;
  description?: string;
  promotionalText?: string;
  whatsNew?: string;
  keywords?: string;
};

export type AppScreenshotSetAttributes = {
  screenshotDisplayType?: string;
};

export type AppScreenshotAttributes = {
  fileSize?: number;
  fileName?: string;
  imageAsset?: {
    templateUrl?: string;
    width?: number;
    height?: number;
  };
};

export type AscIncludedResponse<TAttributes, TIncluded = unknown> = {
  data: Array<AscResource<TAttributes>>;
  included?: Array<AscResource<TIncluded>>;
};
