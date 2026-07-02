import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { stripMetadata, stripAllMetadata } from "./stripMetadata";
import { parseMetadata } from "./parseMetadata";
import { readPngChunks } from "./pngChunks";

function fixtureFile(name: string, type: string): File {
  const buf = readFileSync(path.join(__dirname, "..", "..", "test", "fixtures", name));
  const buffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  return new File([buffer], name, { type });
}

describe("stripMetadata (JPEG)", () => {
  it("removes only the selected fields, keeping the rest", async () => {
    const file = fixtureFile("with-exif.jpg", "image/jpeg");
    const cleaned = await stripMetadata(file, new Set(["tiff:Make"]));
    const fields = await parseMetadata(cleaned);
    const labels = fields.map((f) => f.label);
    expect(labels).not.toContain("Make");
    expect(labels).toContain("Model");
  });

  it("removes IPTC/XMP blocks when their block ids are selected", async () => {
    const file = fixtureFile("with-all-metadata.jpg", "image/jpeg");
    const cleaned = await stripMetadata(file, new Set(["block:iptc", "block:xmp"]));
    const fields = await parseMetadata(cleaned);
    expect(fields.some((f) => f.kind === "block")).toBe(false);
    expect(fields.some((f) => f.label === "Make")).toBe(true);
  });
});

describe("stripMetadata (PNG)", () => {
  it("removes the whole eXIf chunk when any EXIF/GPS/TIFF field is selected", async () => {
    const file = fixtureFile("with-metadata.png", "image/png");
    const cleaned = await stripMetadata(file, new Set(["tiff:Make"]));
    const bytes = new Uint8Array(await cleaned.arrayBuffer());
    const types = readPngChunks(bytes).map((c) => c.type);
    expect(types).not.toContain("eXIf");
    expect(types).toContain("tEXt");
  });

  it("removes only the selected text chunk instance", async () => {
    const file = fixtureFile("with-metadata.png", "image/png");
    const original = await parseMetadata(file);
    const authorField = original.find((f) => f.kind === "text" && f.value === "Test PNG Author")!;

    const cleaned = await stripMetadata(file, new Set([authorField.id]));
    const bytes = new Uint8Array(await cleaned.arrayBuffer());
    const types = readPngChunks(bytes).map((c) => c.type);
    expect(types).toContain("iTXt");
    expect(types).toContain("eXIf");
    expect(types).not.toContain("tEXt");
  });
});

describe("stripAllMetadata", () => {
  it("removes everything from a JPEG", async () => {
    const cleaned = await stripAllMetadata(fixtureFile("with-all-metadata.jpg", "image/jpeg"));
    const fields = await parseMetadata(cleaned);
    expect(fields).toEqual([]);
  });

  it("removes everything from a PNG", async () => {
    const cleaned = await stripAllMetadata(fixtureFile("with-metadata.png", "image/png"));
    const fields = await parseMetadata(cleaned);
    expect(fields).toEqual([]);
  });
});
