import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseMetadata } from "./parseMetadata";

function fixtureFile(name: string, type: string): File {
  const buf = readFileSync(path.join(__dirname, "..", "..", "test", "fixtures", name));
  return new File([new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)], name, { type });
}

describe("parseMetadata", () => {
  it("returns an empty list for a JPEG with no metadata", async () => {
    const fields = await parseMetadata(fixtureFile("no-metadata.jpg", "image/jpeg"));
    expect(fields).toEqual([]);
  });

  it("returns an empty list for a PNG with no metadata", async () => {
    const fields = await parseMetadata(fixtureFile("no-metadata.png", "image/png"));
    expect(fields).toEqual([]);
  });

  it("lists EXIF and GPS fields individually for a JPEG with EXIF data", async () => {
    const fields = await parseMetadata(fixtureFile("with-exif.jpg", "image/jpeg"));
    const byLabel = Object.fromEntries(fields.map((f) => [f.label, f]));

    expect(byLabel["Make"]).toMatchObject({ value: "AcmeCam", kind: "tiff" });
    expect(byLabel["Model"]).toMatchObject({ value: "Camera9000", kind: "tiff" });
    expect(byLabel["Date Time Original"]).toMatchObject({ kind: "exif" });
    expect(byLabel["GPS Latitude"]).toMatchObject({ kind: "gps" });
    expect(byLabel["GPS Latitude"].value).toContain("37");
  });

  it("does not list derived convenience coordinates as separate fields", async () => {
    const fields = await parseMetadata(fixtureFile("with-exif.jpg", "image/jpeg"));
    const labels = fields.map((f) => f.label);
    expect(labels).not.toContain("Latitude");
    expect(labels).not.toContain("Longitude");
  });

  it("notes that removing Orientation affects display rotation", async () => {
    const fields = await parseMetadata(fixtureFile("with-exif.jpg", "image/jpeg"));
    const orientation = fields.find((f) => f.label === "Orientation");
    expect(orientation?.note).toMatch(/rotation/i);
  });

  it("flags IPTC and XMP as block-level entries, not individual sub-fields", async () => {
    const fields = await parseMetadata(fixtureFile("with-all-metadata.jpg", "image/jpeg"));
    const blocks = fields.filter((f) => f.kind === "block");
    expect(blocks.map((f) => f.id).sort()).toEqual(["block:iptc", "block:xmp"]);
    expect(fields.some((f) => f.label === "Byline")).toBe(false);
    expect(fields.some((f) => f.label === "Creator")).toBe(false);
  });

  it("excludes structural PNG header fields but includes eXIf-derived and text-chunk fields", async () => {
    const fields = await parseMetadata(fixtureFile("with-metadata.png", "image/png"));
    const labels = fields.map((f) => f.label);
    expect(labels).not.toContain("Image Width");
    expect(labels).not.toContain("Bit Depth");
    expect(labels).toContain("Make");

    const author = fields.find((f) => f.kind === "text" && f.value === "Test PNG Author");
    expect(author).toBeDefined();
  });
});
