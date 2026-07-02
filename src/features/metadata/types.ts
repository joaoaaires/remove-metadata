export type MetadataFieldKind = "exif" | "gps" | "tiff" | "text" | "block";

export type MetadataField = {
  id: string;
  label: string;
  value: string;
  kind: MetadataFieldKind;
  note?: string;
};

export type ImageStatus = "parsing" | "ready" | "error";

export type QueuedImage = {
  id: string;
  file: File;
  previewUrl: string;
  status: ImageStatus;
  errorMessage?: string;
  fields: MetadataField[];
  selectedForRemoval: Set<string>;
  isStripping: boolean;
  cleaned?: { blob: Blob; url: string };
};
