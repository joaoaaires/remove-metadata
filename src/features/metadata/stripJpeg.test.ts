import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { stripJpegFields, stripJpegBlocks, removeAllJpegMetadata } from "./stripJpeg";
import { parseMetadata } from "./parseMetadata";

function fixtureBytes(name: string): Uint8Array {
  const buf = readFileSync(path.join(__dirname, "..", "..", "test", "fixtures", name));
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

function toFile(bytes: Uint8Array, name = "out.jpg"): File {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new File([buffer], name, { type: "image/jpeg" });
}

/** Everything from the SOS (Start Of Scan) marker to EOF: the actual pixel/entropy-coded data. */
function scanDataOf(bytes: Uint8Array): Uint8Array {
  let i = 2;
  while (i < bytes.length) {
    const marker = bytes[i + 1];
    if (marker === 0xda) return bytes.subarray(i);
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    i += 2 + len;
  }
  throw new Error("no SOS marker found");
}

describe("stripJpegFields", () => {
  it("removes only the selected EXIF/GPS/TIFF tags, leaving the rest intact", async () => {
    const original = fixtureBytes("with-exif.jpg");
    const stripped = stripJpegFields(original, ["tiff:Make", "exif:DateTimeOriginal"]);

    const fields = await parseMetadata(toFile(stripped));
    const labels = fields.map((f) => f.label);
    expect(labels).not.toContain("Make");
    expect(labels).not.toContain("Date Time Original");
    expect(labels).toContain("Model");
    expect(labels).toContain("Orientation");
    expect(labels).toContain("GPS Latitude");
  });

  it("preserves scan/pixel data exactly", () => {
    const original = fixtureBytes("with-exif.jpg");
    const stripped = stripJpegFields(original, ["tiff:Make"]);
    expect(scanDataOf(stripped)).toEqual(scanDataOf(original));
  });

  it("is a no-op when given a JPEG with no EXIF and nothing to remove", async () => {
    const original = fixtureBytes("no-metadata.jpg");
    const stripped = stripJpegFields(original, []);
    const fields = await parseMetadata(toFile(stripped));
    expect(fields).toEqual([]);
  });
});

describe("stripJpegBlocks", () => {
  it("removes only the requested block while leaving the other block and EXIF/GPS intact", async () => {
    const original = fixtureBytes("with-all-metadata.jpg");
    const stripped = stripJpegBlocks(original, ["iptc"]);

    const fields = await parseMetadata(toFile(stripped));
    const ids = fields.map((f) => f.id);
    expect(ids).not.toContain("block:iptc");
    expect(ids).toContain("block:xmp");
    expect(fields.some((f) => f.label === "Make")).toBe(true);
  });
});

describe("removeAllJpegMetadata", () => {
  it("removes EXIF, GPS, IPTC, and XMP entirely", async () => {
    const original = fixtureBytes("with-all-metadata.jpg");
    const stripped = removeAllJpegMetadata(original);
    const fields = await parseMetadata(toFile(stripped));
    expect(fields).toEqual([]);
  });

  it("preserves scan/pixel data exactly", () => {
    const original = fixtureBytes("with-all-metadata.jpg");
    const stripped = removeAllJpegMetadata(original);
    expect(scanDataOf(stripped)).toEqual(scanDataOf(original));
  });

  it("does not throw on a JPEG that already has no metadata", async () => {
    const original = fixtureBytes("no-metadata.jpg");
    const stripped = removeAllJpegMetadata(original);
    const fields = await parseMetadata(toFile(stripped));
    expect(fields).toEqual([]);
  });
});
