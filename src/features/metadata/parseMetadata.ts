import exifr from "exifr";
import { readPngChunks } from "./pngChunks";
import { detectImageFormat } from "./imageFormat";
import type { MetadataField, MetadataFieldKind } from "./types";

const EXCLUDED_GPS_KEYS = new Set(["latitude", "longitude"]);
const PNG_TEXT_CHUNK_TYPES = new Set(["tEXt", "iTXt", "zTXt"]);

function humanizeKey(key: string): string {
  return key
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim();
}

function formatValue(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

async function readTiffExifGpsFields(file: Blob): Promise<MetadataField[]> {
  const segmented = await exifr.parse(file, {
    mergeOutput: false,
    tiff: true,
    exif: true,
    gps: true,
    ihdr: false,
    iptc: false,
    xmp: false,
  });
  if (!segmented) return [];

  const fields: MetadataField[] = [];
  const segments: Array<[MetadataFieldKind, Record<string, unknown> | undefined]> = [
    ["tiff", segmented.ifd0],
    ["exif", segmented.exif],
    ["gps", segmented.gps],
  ];

  for (const [kind, group] of segments) {
    if (!group) continue;
    for (const [key, value] of Object.entries(group)) {
      if (kind === "gps" && EXCLUDED_GPS_KEYS.has(key)) continue;
      fields.push({
        id: `${kind}:${key}`,
        label: humanizeKey(key),
        value: formatValue(value),
        kind,
        note: key === "Orientation" ? "Affects display rotation in some apps" : undefined,
      });
    }
  }
  return fields;
}

async function readBlockPresenceFields(file: Blob): Promise<MetadataField[]> {
  const fields: MetadataField[] = [];

  const iptc = await exifr.parse(file, {
    mergeOutput: false,
    tiff: false,
    exif: false,
    gps: false,
    xmp: false,
    iptc: true,
  });
  if (iptc?.iptc && Object.keys(iptc.iptc).length > 0) {
    fields.push({ id: "block:iptc", label: "IPTC data", value: "Present", kind: "block" });
  }

  const xmp = await exifr.parse(file, {
    mergeOutput: false,
    tiff: false,
    exif: false,
    gps: false,
    iptc: false,
    xmp: true,
  });
  if (xmp && Object.keys(xmp).length > 0) {
    fields.push({ id: "block:xmp", label: "XMP data", value: "Present", kind: "block" });
  }

  return fields;
}

function decodePngTextValue(type: string, data: Uint8Array): { keyword: string; value: string } | null {
  if (type === "tEXt") {
    const text = new TextDecoder("latin1").decode(data);
    const separatorIndex = text.indexOf("\0");
    if (separatorIndex === -1) return null;
    return { keyword: text.slice(0, separatorIndex), value: text.slice(separatorIndex + 1) };
  }
  if (type === "iTXt") {
    const keywordEnd = data.indexOf(0);
    if (keywordEnd === -1) return null;
    const keyword = new TextDecoder("latin1").decode(data.subarray(0, keywordEnd));
    const compressionFlag = data[keywordEnd + 1];
    if (compressionFlag !== 0) return { keyword, value: "(compressed text — not decoded)" };
    let cursor = keywordEnd + 3; // skip keyword\0 + compression flag + compression method
    const langEnd = data.indexOf(0, cursor);
    cursor = langEnd + 1;
    const translatedEnd = data.indexOf(0, cursor);
    cursor = translatedEnd + 1;
    const value = new TextDecoder("utf-8").decode(data.subarray(cursor));
    return { keyword, value };
  }
  if (type === "zTXt") {
    const keywordEnd = data.indexOf(0);
    const keyword = keywordEnd === -1 ? "Text" : new TextDecoder("latin1").decode(data.subarray(0, keywordEnd));
    return { keyword, value: "(compressed text — not decoded)" };
  }
  return null;
}

async function readPngTextFields(file: Blob): Promise<MetadataField[]> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const chunks = readPngChunks(bytes);

  const fields: MetadataField[] = [];
  chunks.forEach((chunk, index) => {
    if (!PNG_TEXT_CHUNK_TYPES.has(chunk.type)) return;
    const decoded = decodePngTextValue(chunk.type, chunk.data);
    if (!decoded) return;
    // id encodes the chunk's index in the full readPngChunks() list, so stripPng
    // can remove this exact chunk instance without re-deriving the same filter.
    fields.push({
      id: `text:${index}`,
      label: humanizeKey(decoded.keyword),
      value: decoded.value,
      kind: "text",
    });
  });
  return fields;
}

export async function parseMetadata(file: Blob): Promise<MetadataField[]> {
  const format = await detectImageFormat(file);

  const tiffExifGps = await readTiffExifGpsFields(file);
  if (format === "png") {
    const textFields = await readPngTextFields(file);
    return [...tiffExifGps, ...textFields];
  }

  const blockFields = await readBlockPresenceFields(file);
  return [...tiffExifGps, ...blockFields];
}
