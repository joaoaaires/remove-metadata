const PNG_SIGNATURE_LENGTH = 8;

export type PngChunk = {
  type: string;
  data: Uint8Array;
  raw: Uint8Array;
};

export function readPngChunks(bytes: Uint8Array): PngChunk[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks: PngChunk[] = [];
  let offset = PNG_SIGNATURE_LENGTH;

  while (offset < bytes.length) {
    const dataLength = view.getUint32(offset);
    const type = new TextDecoder("ascii").decode(bytes.subarray(offset + 4, offset + 8));
    const chunkLength = 4 + 4 + dataLength + 4; // length + type + data + crc
    const raw = bytes.subarray(offset, offset + chunkLength);
    const data = bytes.subarray(offset + 8, offset + 8 + dataLength);
    chunks.push({ type, data, raw });
    offset += chunkLength;
  }

  return chunks;
}

export function writePngChunks(chunks: PngChunk[]): Uint8Array {
  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const totalLength = signature.length + chunks.reduce((sum, c) => sum + c.raw.length, 0);
  const out = new Uint8Array(totalLength);
  out.set(signature, 0);
  let offset = signature.length;
  for (const chunk of chunks) {
    out.set(chunk.raw, offset);
    offset += chunk.raw.length;
  }
  return out;
}
