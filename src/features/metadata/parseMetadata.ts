import exifr from "exifr";
import { readPngChunks } from "./pngChunks";
import { detectImageFormat, type ImageFormat } from "./imageFormat";
import type { MetadataField, MetadataFieldKind } from "./types";

const EXCLUDED_GPS_KEYS = new Set(["latitude", "longitude"]);
const PNG_TEXT_CHUNK_TYPES = new Set(["tEXt", "iTXt", "zTXt"]);
const JPEG_EXIF_APP1_IDENTIFIER = "Exif\0\0";
const JPEG_JUMBF_APP11_IDENTIFIER = "JP";

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
  let segmented: Awaited<ReturnType<typeof exifr.parse>>;
  try {
    segmented = await exifr.parse(file, {
      mergeOutput: false,
      tiff: true,
      exif: true,
      gps: true,
      ihdr: false,
      iptc: false,
      xmp: false,
    });
  } catch {
    segmented = undefined;
  }
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

function payloadStartsWithIdentifier(payload: Uint8Array, identifier: string): boolean {
  const idBytes = new TextEncoder().encode(identifier);
  if (payload.length < idBytes.length) return false;
  for (let k = 0; k < idBytes.length; k++) {
    if (payload[k] !== idBytes[k]) return false;
  }
  return true;
}

/**
 * A TIFF/IFD is only worth surfacing if its 0th IFD actually declares at least one entry.
 * `piexif` round-trips (e.g. a no-op field removal) can leave behind a structurally valid but
 * entirely empty EXIF segment — that's not "hidden data", so it must not trip the fallback.
 */
function tiffIfd0HasEntries(tiff: Uint8Array): boolean {
  if (tiff.length < 8) return false;
  const isLittleEndian = tiff[0] === 0x49 && tiff[1] === 0x49; // "II"
  const isBigEndian = tiff[0] === 0x4d && tiff[1] === 0x4d; // "MM"
  if (!isLittleEndian && !isBigEndian) return false;
  const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  if (view.getUint16(2, isLittleEndian) !== 42) return false;
  const ifd0Offset = view.getUint32(4, isLittleEndian);
  if (ifd0Offset + 2 > tiff.length) return false;
  return view.getUint16(ifd0Offset, isLittleEndian) > 0;
}

/** Detects a JPEG APP1 "Exif" segment by walking markers, independent of whether the IFD inside it can be decoded. */
function hasRawJpegExifSegment(bytes: Uint8Array): boolean {
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) break;
    const marker = bytes[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    if (marker === 0xda) break;
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (marker === 0xe1) {
      const payload = bytes.subarray(i + 4, i + 2 + len);
      if (
        payloadStartsWithIdentifier(payload, JPEG_EXIF_APP1_IDENTIFIER) &&
        tiffIfd0HasEntries(payload.subarray(JPEG_EXIF_APP1_IDENTIFIER.length))
      ) {
        return true;
      }
    }
    i += 2 + len;
  }
  return false;
}

function hasRawPngExifChunk(bytes: Uint8Array): boolean {
  return readPngChunks(bytes).some((chunk) => chunk.type === "eXIf" && tiffIfd0HasEntries(chunk.data));
}

/**
 * C2PA "Content Credentials" (AI provenance) manifests are stored as JUMBF (ISO 19566-5) boxes,
 * a container format unrelated to EXIF/IPTC/XMP — exifr and the PNG text-chunk reader never see
 * them. JPEG carries JUMBF across one or more APP11 segments, each starting with the "JP" common
 * identifier; PNG carries it in a single ancillary "caBX" chunk. We only detect presence here,
 * not decode the manifest into individual fields.
 */
function hasRawJpegC2paSegment(bytes: Uint8Array): boolean {
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) break;
    const marker = bytes[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    if (marker === 0xda) break;
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (marker === 0xeb) {
      const payload = bytes.subarray(i + 4, i + 2 + len);
      if (payloadStartsWithIdentifier(payload, JPEG_JUMBF_APP11_IDENTIFIER)) return true;
    }
    i += 2 + len;
  }
  return false;
}

function hasRawPngC2paChunk(bytes: Uint8Array): boolean {
  return readPngChunks(bytes).some((chunk) => chunk.type === "caBX");
}

async function readC2paPresenceField(file: Blob, format: ImageFormat): Promise<MetadataField[]> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const hasC2pa = format === "png" ? hasRawPngC2paChunk(bytes) : hasRawJpegC2paSegment(bytes);
  if (!hasC2pa) return [];
  return [
    {
      id: "block:c2pa",
      label: "Dados C2PA / Content Credentials (proveniência de IA)",
      value: "Present",
      kind: "block",
    },
  ];
}

/**
 * Fallback for EXIF data that exists in the file but couldn't be resolved into individual
 * fields by exifr (e.g. an unusual IFD layout) — only used when the structured decode found nothing.
 */
async function readRawExifFallbackField(file: Blob, format: ImageFormat): Promise<MetadataField[]> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const hasRawExif = format === "png" ? hasRawPngExifChunk(bytes) : hasRawJpegExifSegment(bytes);
  if (!hasRawExif) return [];
  return [
    {
      id: "block:exif-raw",
      label: "Dados EXIF (detectados, não foi possível listar campos individuais)",
      value: "Present",
      kind: "block",
    },
  ];
}

export async function parseMetadata(file: Blob): Promise<MetadataField[]> {
  const format = await detectImageFormat(file);

  const tiffExifGps = await readTiffExifGpsFields(file);
  const rawExifFallback = tiffExifGps.length === 0 ? await readRawExifFallbackField(file, format) : [];
  const c2pa = await readC2paPresenceField(file, format);

  if (format === "png") {
    const textFields = await readPngTextFields(file);
    return [...tiffExifGps, ...rawExifFallback, ...c2pa, ...textFields];
  }

  const blockFields = await readBlockPresenceFields(file);
  return [...tiffExifGps, ...rawExifFallback, ...c2pa, ...blockFields];
}
