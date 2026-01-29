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
};
