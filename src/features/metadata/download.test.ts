import { describe, it, expect, vi } from "vitest";
import JSZip from "jszip";
import { triggerDownload, buildZipBlob } from "./download";

describe("triggerDownload", () => {
  it("clicks a temporary anchor with the given href and filename, then removes it", () => {
    let capturedHref = "";
    let capturedDownload = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      capturedHref = this.href;
      capturedDownload = this.download;
    });

    triggerDownload("blob:abc123", "photo.jpg");

    expect(capturedHref).toBe("blob:abc123");
    expect(capturedDownload).toBe("photo.jpg");
    expect(document.querySelector("a[download='photo.jpg']")).toBeNull();

    vi.restoreAllMocks();
  });
});

describe("buildZipBlob", () => {
  it("packages every given file into a zip under its own name", async () => {
    const files = [
      { name: "a.jpg", blob: new Blob(["hello"]) },
      { name: "b.png", blob: new Blob(["world"]) },
    ];

    const zipBlob = await buildZipBlob(files);
    const zip = await JSZip.loadAsync(zipBlob);

    expect(Object.keys(zip.files).sort()).toEqual(["a.jpg", "b.png"]);
    expect(await zip.file("a.jpg")!.async("string")).toBe("hello");
    expect(await zip.file("b.png")!.async("string")).toBe("world");
  });
});
