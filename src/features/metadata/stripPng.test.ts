import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { removeAllPngMetadata, removePngChunksMatching } from "./stripPng";
import { readPngChunks } from "./pngChunks";

function fixtureBytes(name: string): Uint8Array {
  const buf = readFileSync(path.join(__dirname, "..", "..", "test", "fixtures", name));
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

describe("removeAllPngMetadata", () => {
  it("removes all ancillary metadata chunks, keeping structural chunks", () => {
    const stripped = removeAllPngMetadata(fixtureBytes("with-metadata.png"));
    const types = readPngChunks(stripped).map((c) => c.type);
    expect(types).toEqual(["IHDR", "IDAT", "IEND"]);
  });

  it("preserves pixel data (IDAT) exactly", () => {
    const original = fixtureBytes("with-metadata.png");
    const stripped = removeAllPngMetadata(original);
    const originalIdat = readPngChunks(original).find((c) => c.type === "IDAT")!;
    const strippedIdat = readPngChunks(stripped).find((c) => c.type === "IDAT")!;
    expect(strippedIdat.data).toEqual(originalIdat.data);
  });

  it("is a no-op on a PNG with no ancillary metadata", () => {
    const original = fixtureBytes("no-metadata.png");
    const stripped = removeAllPngMetadata(original);
    expect(stripped).toEqual(original);
  });
});

describe("removePngChunksMatching", () => {
  it("removes only the specific chunk instance matched by index", () => {
    const original = fixtureBytes("with-metadata.png");
    const targetIndex = readPngChunks(original).findIndex((c) => c.type === "tEXt");

    const stripped = removePngChunksMatching(original, (_chunk, index) => index === targetIndex);
    const types = readPngChunks(stripped).map((c) => c.type);

    expect(types).toEqual(["IHDR", "tIME", "iTXt", "eXIf", "IDAT", "IEND"]);
  });
});
