import { detectImageFormat } from "./imageFormat";
import { stripJpegFields, stripJpegBlocks, removeAllJpegMetadata } from "./stripJpeg";
import { removePngChunksMatching, removeAllPngMetadata } from "./stripPng";

const TIFF_LIKE_PREFIXES = ["tiff:", "exif:", "gps:"];

function toBlob(bytes: Uint8Array, type: string): Blob {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Blob([buffer], { type });
}

async function stripJpeg(file: File, selectedFieldIds: ReadonlySet<string>): Promise<Blob> {
  const bytes = new Uint8Array(await file.arrayBuffer());

  const fieldIds = [...selectedFieldIds].filter((id) => TIFF_LIKE_PREFIXES.some((p) => id.startsWith(p)));
  const blocks = [...selectedFieldIds]
    .filter((id) => id.startsWith("block:"))
    .map((id) => id.slice("block:".length)) as Array<"iptc" | "xmp" | "exif-raw" | "c2pa">;

  const withoutFields = stripJpegFields(bytes, fieldIds);
  const withoutBlocks = stripJpegBlocks(withoutFields, blocks);
  return toBlob(withoutBlocks, file.type || "image/jpeg");
}

async function stripPng(file: File, selectedFieldIds: ReadonlySet<string>): Promise<Blob> {
  const bytes = new Uint8Array(await file.arrayBuffer());

  const removeExif = [...selectedFieldIds].some(
    (id) => TIFF_LIKE_PREFIXES.some((p) => id.startsWith(p)) || id === "block:exif-raw",
  );
  const removeC2pa = selectedFieldIds.has("block:c2pa");
  const textIndexes = new Set(
    [...selectedFieldIds]
      .filter((id) => id.startsWith("text:"))
      .map((id) => Number(id.slice("text:".length))),
  );

  const stripped = removePngChunksMatching(
    bytes,
    (chunk, index) =>
      (removeExif && chunk.type === "eXIf") || (removeC2pa && chunk.type === "caBX") || textIndexes.has(index),
  );
  return toBlob(stripped, file.type || "image/png");
}

export async function stripMetadata(file: File, selectedFieldIds: ReadonlySet<string>): Promise<Blob> {
  const format = await detectImageFormat(file);
  if (format === "png") return stripPng(file, selectedFieldIds);
  return stripJpeg(file, selectedFieldIds);
}

export async function stripAllMetadata(file: File): Promise<Blob> {
  const format = await detectImageFormat(file);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (format === "png") return toBlob(removeAllPngMetadata(bytes), file.type || "image/png");
  return toBlob(removeAllJpegMetadata(bytes), file.type || "image/jpeg");
}
