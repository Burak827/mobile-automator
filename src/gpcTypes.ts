export type GpcListing = {
  language?: string;
  title?: string;
  shortDescription?: string;
  fullDescription?: string;
};

export type GpcListingsListResponse = {
  kind?: string;
  listings?: GpcListing[];
};

export type GpcEdit = {
  id?: string;
  expiryTimeSeconds?: string;
};

export type GpcImage = {
  id?: string;
  url?: string;
  sha1?: string;
  sha256?: string;
};

export type GpcImagesListResponse = {
  images?: GpcImage[];
};
