import { useCallback, useEffect, useRef, useState } from "react";
import { parseMetadata } from "./parseMetadata";
import { stripMetadata, stripAllMetadata } from "./stripMetadata";
import type { QueuedImage } from "./types";

function makeId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function errorMessageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

export function useImageQueue() {
  const [images, setImages] = useState<QueuedImage[]>([]);
  const imagesRef = useRef<QueuedImage[]>(images);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  const updateImage = useCallback((id: string, patch: Partial<QueuedImage>) => {
    setImages((prev) => prev.map((img) => (img.id === id ? { ...img, ...patch } : img)));
  }, []);

  const addFiles = useCallback(
    async (files: File[]) => {
      const newImages: QueuedImage[] = files.map((file) => ({
        id: makeId(),
        file,
        previewUrl: URL.createObjectURL(file),
        status: "parsing",
        fields: [],
        selectedForRemoval: new Set<string>(),
        isStripping: false,
      }));
      setImages((prev) => [...prev, ...newImages]);

      await Promise.all(
        newImages.map((img) =>
          parseMetadata(img.file)
            .then((fields) => updateImage(img.id, { status: "ready", fields }))
            .catch((error: unknown) =>
              updateImage(img.id, { status: "error", errorMessage: errorMessageOf(error) }),
            ),
        ),
      );
    },
    [updateImage],
  );

  const toggleFieldSelection = useCallback((imageId: string, fieldId: string) => {
    setImages((prev) =>
      prev.map((img) => {
        if (img.id !== imageId) return img;
        const next = new Set(img.selectedForRemoval);
        if (next.has(fieldId)) next.delete(fieldId);
        else next.add(fieldId);
        return { ...img, selectedForRemoval: next };
      }),
    );
  }, []);

  const applyCleanedResult = useCallback(
    async (imageId: string, fileName: string, blob: Blob) => {
      const cleanedFile = new File([blob], fileName, { type: blob.type });
      const url = URL.createObjectURL(blob);
      const fields = await parseMetadata(cleanedFile);
      updateImage(imageId, {
        file: cleanedFile,
        cleaned: { blob, url },
        fields,
        selectedForRemoval: new Set(),
        isStripping: false,
        status: "ready",
      });
    },
    [updateImage],
  );

  const removeSelectedFields = useCallback(
    async (imageId: string) => {
      const target = imagesRef.current.find((img) => img.id === imageId);
      if (!target) return;
      updateImage(imageId, { isStripping: true });
      try {
        const blob = await stripMetadata(target.file, target.selectedForRemoval);
        await applyCleanedResult(imageId, target.file.name, blob);
      } catch (error) {
        updateImage(imageId, { isStripping: false, status: "error", errorMessage: errorMessageOf(error) });
      }
    },
    [updateImage, applyCleanedResult],
  );

  const removeAllFields = useCallback(
    async (imageId: string) => {
      const target = imagesRef.current.find((img) => img.id === imageId);
      if (!target) return;
      updateImage(imageId, { isStripping: true });
      try {
        const blob = await stripAllMetadata(target.file);
        await applyCleanedResult(imageId, target.file.name, blob);
      } catch (error) {
        updateImage(imageId, { isStripping: false, status: "error", errorMessage: errorMessageOf(error) });
      }
    },
    [updateImage, applyCleanedResult],
  );

  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  const removeAllFieldsForAllImages = useCallback(async () => {
    setIsBatchProcessing(true);
    try {
      for (const img of imagesRef.current) {
        await removeAllFields(img.id);
      }
    } finally {
      setIsBatchProcessing(false);
    }
  }, [removeAllFields]);

  const revokeImageUrls = useCallback((image: QueuedImage) => {
    URL.revokeObjectURL(image.previewUrl);
    if (image.cleaned) URL.revokeObjectURL(image.cleaned.url);
  }, []);

  const removeImage = useCallback(
    (imageId: string) => {
      const target = imagesRef.current.find((img) => img.id === imageId);
      if (!target) return;
      revokeImageUrls(target);
      setImages((prev) => prev.filter((img) => img.id !== imageId));
    },
    [revokeImageUrls],
  );

  const clearCleanedImages = useCallback(() => {
    for (const img of imagesRef.current) {
      if (img.cleaned) revokeImageUrls(img);
    }
    setImages((prev) => prev.filter((img) => !img.cleaned));
  }, [revokeImageUrls]);

  return {
    images,
    isBatchProcessing,
    addFiles,
    toggleFieldSelection,
    removeSelectedFields,
    removeAllFields,
    removeAllFieldsForAllImages,
    removeImage,
    clearCleanedImages,
  };
}
