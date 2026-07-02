import { readPngChunks, writePngChunks, type PngChunk } from "./pngChunks";

const REMOVABLE_CHUNK_TYPES = new Set(["tEXt", "zTXt", "iTXt", "eXIf", "tIME"]);

export function removePngChunksMatching(
  bytes: Uint8Array,
  predicate: (chunk: PngChunk, index: number) => boolean,
): Uint8Array {
  const chunks = readPngChunks(bytes);
  const kept = chunks.filter((chunk, index) => !predicate(chunk, index));
  return writePngChunks(kept);
}

export function removeAllPngMetadata(bytes: Uint8Array): Uint8Array {
  return removePngChunksMatching(bytes, (chunk) => REMOVABLE_CHUNK_TYPES.has(chunk.type));
}
