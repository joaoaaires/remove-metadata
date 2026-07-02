import { describe, it, expect, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { useImageQueue } from "./useImageQueue";

function fixtureFile(name: string, type: string): File {
  const buf = readFileSync(path.join(__dirname, "..", "..", "test", "fixtures", name));
  const buffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  return new File([buffer], name, { type });
}

describe("useImageQueue", () => {
  it("queues added files and transitions them to ready with parsed fields", async () => {
    const { result } = renderHook(() => useImageQueue());
    const file = fixtureFile("with-exif.jpg", "image/jpeg");

    await act(async () => {
      await result.current.addFiles([file]);
    });

    expect(result.current.images).toHaveLength(1);
    const image = result.current.images[0];
    expect(image.status).toBe("ready");
    expect(image.fields.some((f) => f.label === "Make")).toBe(true);
  });

  it("sets status to error when a file's metadata cannot be parsed", async () => {
    const { result } = renderHook(() => useImageQueue());
    const badFile = new File([new Uint8Array([1, 2, 3, 4, 5])], "bad.jpg", { type: "image/jpeg" });

    await act(async () => {
      await result.current.addFiles([badFile]);
    });

    expect(result.current.images[0].status).toBe("error");
    expect(result.current.images[0].errorMessage).toBeTruthy();
  });

  it("toggles a field id in and out of selectedForRemoval", async () => {
    const { result } = renderHook(() => useImageQueue());
    const file = fixtureFile("with-exif.jpg", "image/jpeg");
    await act(async () => {
      await result.current.addFiles([file]);
    });
    const imageId = result.current.images[0].id;

    act(() => result.current.toggleFieldSelection(imageId, "tiff:Make"));
    expect(result.current.images[0].selectedForRemoval.has("tiff:Make")).toBe(true);

    act(() => result.current.toggleFieldSelection(imageId, "tiff:Make"));
    expect(result.current.images[0].selectedForRemoval.has("tiff:Make")).toBe(false);
  });

  it("removeSelectedFields strips only the selected fields and refreshes the list", async () => {
    const { result } = renderHook(() => useImageQueue());
    const file = fixtureFile("with-exif.jpg", "image/jpeg");
    await act(async () => {
      await result.current.addFiles([file]);
    });
    const imageId = result.current.images[0].id;
    act(() => result.current.toggleFieldSelection(imageId, "tiff:Make"));

    await act(async () => {
      await result.current.removeSelectedFields(imageId);
    });

    const image = result.current.images[0];
    const labels = image.fields.map((f) => f.label);
    expect(labels).not.toContain("Make");
    expect(labels).toContain("Model");
    expect(image.cleaned).toBeDefined();
    expect(image.selectedForRemoval.size).toBe(0);
  });

  it("removeAllFields clears every field for one image", async () => {
    const { result } = renderHook(() => useImageQueue());
    const file = fixtureFile("with-all-metadata.jpg", "image/jpeg");
    await act(async () => {
      await result.current.addFiles([file]);
    });
    const imageId = result.current.images[0].id;

    await act(async () => {
      await result.current.removeAllFields(imageId);
    });

    expect(result.current.images[0].fields).toEqual([]);
    expect(result.current.images[0].cleaned).toBeDefined();
  });

  it("removeAllFieldsForAllImages clears metadata across the whole batch", async () => {
    const { result } = renderHook(() => useImageQueue());
    const files = [fixtureFile("with-exif.jpg", "image/jpeg"), fixtureFile("with-all-metadata.jpg", "image/jpeg")];
    await act(async () => {
      await result.current.addFiles(files);
    });

    await act(async () => {
      await result.current.removeAllFieldsForAllImages();
    });

    for (const image of result.current.images) {
      expect(image.fields).toEqual([]);
    }
  });

  it("waits for parsing to settle before running removeAllFieldsForAllImages in practice", async () => {
    const { result } = renderHook(() => useImageQueue());
    const file = fixtureFile("with-exif.jpg", "image/jpeg");
    act(() => {
      void result.current.addFiles([file]);
    });
    await waitFor(() => expect(result.current.images[0]?.status).toBe("ready"));
    expect(result.current.images[0].fields.length).toBeGreaterThan(0);
  });

  it("marks isBatchProcessing true while a batch removal runs, then false once it settles", async () => {
    const { result } = renderHook(() => useImageQueue());
    const files = [fixtureFile("with-exif.jpg", "image/jpeg"), fixtureFile("with-all-metadata.jpg", "image/jpeg")];
    await act(async () => {
      await result.current.addFiles(files);
    });
    expect(result.current.isBatchProcessing).toBe(false);

    let runPromise!: Promise<void>;
    act(() => {
      runPromise = result.current.removeAllFieldsForAllImages();
    });
    expect(result.current.isBatchProcessing).toBe(true);

    await act(async () => {
      await runPromise;
    });
    expect(result.current.isBatchProcessing).toBe(false);
  });

  it("removeImage revokes the preview and cleaned URLs and drops the image from state", async () => {
    const { result } = renderHook(() => useImageQueue());
    const file = fixtureFile("with-all-metadata.jpg", "image/jpeg");
    await act(async () => {
      await result.current.addFiles([file]);
    });
    const imageId = result.current.images[0].id;
    await act(async () => {
      await result.current.removeAllFields(imageId);
    });
    const { previewUrl, cleaned } = result.current.images[0];

    const revokeSpy = vi.spyOn(URL, "revokeObjectURL");
    act(() => result.current.removeImage(imageId));

    expect(result.current.images).toHaveLength(0);
    expect(revokeSpy).toHaveBeenCalledWith(previewUrl);
    expect(revokeSpy).toHaveBeenCalledWith(cleaned!.url);
    revokeSpy.mockRestore();
  });

  it("clearCleanedImages removes only cleaned images and revokes their URLs", async () => {
    const { result } = renderHook(() => useImageQueue());
    const files = [fixtureFile("with-exif.jpg", "image/jpeg"), fixtureFile("with-all-metadata.jpg", "image/jpeg")];
    await act(async () => {
      await result.current.addFiles(files);
    });
    const [pendingId, cleanedId] = result.current.images.map((img) => img.id);
    await act(async () => {
      await result.current.removeAllFields(cleanedId);
    });
    const cleanedImage = result.current.images.find((img) => img.id === cleanedId)!;

    const revokeSpy = vi.spyOn(URL, "revokeObjectURL");
    act(() => result.current.clearCleanedImages());

    expect(result.current.images).toHaveLength(1);
    expect(result.current.images[0].id).toBe(pendingId);
    expect(revokeSpy).toHaveBeenCalledWith(cleanedImage.previewUrl);
    expect(revokeSpy).toHaveBeenCalledWith(cleanedImage.cleaned!.url);
    revokeSpy.mockRestore();
  });

  it("clearCleanedImages is a no-op when there are no cleaned images", async () => {
    const { result } = renderHook(() => useImageQueue());
    const file = fixtureFile("with-exif.jpg", "image/jpeg");
    await act(async () => {
      await result.current.addFiles([file]);
    });

    act(() => result.current.clearCleanedImages());

    expect(result.current.images).toHaveLength(1);
  });
});
