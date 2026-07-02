import piexif from "piexifjs";

const IFD_BY_KIND: Record<string, "0th" | "Exif" | "GPS"> = {
  tiff: "0th",
  exif: "Exif",
  gps: "GPS",
};

const IPTC_IDENTIFIER = "Photoshop 3.0\0";
const XMP_IDENTIFIER = "http://ns.adobe.com/xap/1.0/\0";

function uint8ToBinaryString(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return binary;
}

function binaryStringToUint8(binary: string): Uint8Array {
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function findTagId(ifd: "0th" | "Exif" | "GPS", name: string): number | undefined {
  const tags = piexif.TAGS[ifd] as Record<string, { name: string }>;
  for (const [id, def] of Object.entries(tags)) {
    if (def.name === name) return Number(id);
  }
  return undefined;
}

export function stripJpegFields(bytes: Uint8Array, fieldIds: Iterable<string>): Uint8Array {
  const binary = uint8ToBinaryString(bytes);

  let exifObj: ReturnType<typeof piexif.load>;
  try {
    exifObj = piexif.load(binary);
  } catch {
    return bytes;
  }

  for (const fieldId of fieldIds) {
    const separatorIndex = fieldId.indexOf(":");
    const kind = fieldId.slice(0, separatorIndex);
    const name = fieldId.slice(separatorIndex + 1);
    const ifd = IFD_BY_KIND[kind];
    if (!ifd) continue;
    const tagId = findTagId(ifd, name);
    if (tagId !== undefined && exifObj[ifd]) {
      delete exifObj[ifd][tagId];
    }
  }

  const exifBytes = piexif.dump(exifObj);
  const newBinary = piexif.insert(exifBytes, binary);
  return binaryStringToUint8(newBinary);
}

function payloadStartsWith(payload: Uint8Array, identifier: string): boolean {
  const idBytes = new TextEncoder().encode(identifier);
  if (payload.length < idBytes.length) return false;
  for (let k = 0; k < idBytes.length; k++) {
    if (payload[k] !== idBytes[k]) return false;
  }
  return true;
}

function removeJpegSegments(
  bytes: Uint8Array,
  shouldRemove: (marker: number, payload: Uint8Array) => boolean,
): Uint8Array {
  const kept: Uint8Array[] = [bytes.subarray(0, 2)]; // SOI
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) {
      kept.push(bytes.subarray(i));
      break;
    }
    const marker = bytes[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      kept.push(bytes.subarray(i, i + 2));
      i += 2;
      continue;
    }
    if (marker === 0xda) {
      kept.push(bytes.subarray(i));
      break;
    }
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    const segmentEnd = i + 2 + len;
    const payload = bytes.subarray(i + 4, segmentEnd);
    const isApp = marker >= 0xe0 && marker <= 0xef;
    if (!(isApp && shouldRemove(marker, payload))) {
      kept.push(bytes.subarray(i, segmentEnd));
    }
    i = segmentEnd;
  }

  const totalLength = kept.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of kept) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

export function stripJpegBlocks(bytes: Uint8Array, blocks: Iterable<"iptc" | "xmp">): Uint8Array {
  const blockSet = new Set(blocks);
  if (blockSet.size === 0) return bytes;

  return removeJpegSegments(bytes, (marker, payload) => {
    if (marker === 0xed && blockSet.has("iptc") && payloadStartsWith(payload, IPTC_IDENTIFIER)) {
      return true;
    }
    if (marker === 0xe1 && blockSet.has("xmp") && payloadStartsWith(payload, XMP_IDENTIFIER)) {
      return true;
    }
    return false;
  });
}

export function removeAllJpegMetadata(bytes: Uint8Array): Uint8Array {
  const binary = uint8ToBinaryString(bytes);
  let withoutExif: Uint8Array;
  try {
    withoutExif = binaryStringToUint8(piexif.remove(binary));
  } catch {
    withoutExif = bytes;
  }
  return stripJpegBlocks(withoutExif, ["iptc", "xmp"]);
}
