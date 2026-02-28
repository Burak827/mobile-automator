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
