import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { readPngChunks, writePngChunks } from "./pngChunks";

function fixture(name: string): Uint8Array {
  const buf = readFileSync(path.join(__dirname, "..", "..", "test", "fixtures", name));
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

describe("readPngChunks", () => {
  it("lists structural chunks for a PNG with no ancillary metadata", () => {
    const chunks = readPngChunks(fixture("no-metadata.png"));
    expect(chunks.map((c) => c.type)).toEqual(["IHDR", "IDAT", "IEND"]);
  });

  it("lists ancillary metadata chunks in file order for a PNG that has them", () => {
    const chunks = readPngChunks(fixture("with-metadata.png"));
    expect(chunks.map((c) => c.type)).toEqual([
      "IHDR",
      "tEXt",
      "tIME",
      "iTXt",
      "eXIf",
      "IDAT",
      "IEND",
    ]);
  });

  it("exposes each chunk's payload separate from its length/type/crc framing", () => {
    const chunks = readPngChunks(fixture("with-metadata.png"));
    const tExt = chunks.find((c) => c.type === "tEXt")!;
    const text = new TextDecoder("latin1").decode(tExt.data);
    expect(text).toBe("Author\0Test PNG Author");
  });
});

describe("writePngChunks", () => {
  it("round-trips to a byte-identical file when no chunks are removed", () => {
    const original = fixture("with-metadata.png");
    const chunks = readPngChunks(original);
    const rebuilt = writePngChunks(chunks);
    expect(rebuilt).toEqual(original);
  });

  it("omits filtered-out chunk types while preserving the rest", () => {
    const chunks = readPngChunks(fixture("with-metadata.png"));
    const filtered = chunks.filter((c) => c.type !== "tEXt");
    const rebuilt = writePngChunks(filtered);
    const reparsed = readPngChunks(rebuilt);
    expect(reparsed.map((c) => c.type)).toEqual(["IHDR", "tIME", "iTXt", "eXIf", "IDAT", "IEND"]);
  });
});
