import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { detectImageFormat } from "./imageFormat";

function fixtureFile(name: string): File {
  const buf = readFileSync(path.join(__dirname, "..", "..", "test", "fixtures", name));
  return new File([new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)], name);
}

describe("detectImageFormat", () => {
  it("detects JPEG files by magic bytes", async () => {
    expect(await detectImageFormat(fixtureFile("with-exif.jpg"))).toBe("jpeg");
  });

  it("detects PNG files by magic bytes", async () => {
    expect(await detectImageFormat(fixtureFile("with-metadata.png"))).toBe("png");
  });

  it("returns unknown for unrecognized bytes", async () => {
    const file = new File([new Uint8Array([0x00, 0x01, 0x02, 0x03])], "mystery.bin");
    expect(await detectImageFormat(file)).toBe("unknown");
  });
});
