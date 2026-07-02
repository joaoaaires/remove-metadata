const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];
const JPEG_MAGIC = [0xff, 0xd8, 0xff];

export type ImageFormat = "jpeg" | "png" | "unknown";

function matches(head: Uint8Array, magic: number[]): boolean {
  return magic.every((byte, i) => head[i] === byte);
}

export async function detectImageFormat(file: Blob): Promise<ImageFormat> {
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (matches(head, PNG_MAGIC)) return "png";
  if (matches(head, JPEG_MAGIC)) return "jpeg";
  return "unknown";
}
