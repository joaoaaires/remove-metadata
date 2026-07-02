import { RetroButton } from "./retro/RetroButton";
import { buildZipBlob, triggerDownload } from "../features/metadata/download";
import type { QueuedImage } from "../features/metadata/types";

type BatchToolbarProps = {
  images: QueuedImage[];
  onRemoveAllForAllImages: () => void;
  onClearCleanedImages: () => void;
  isBatchProcessing: boolean;
};

export function BatchToolbar({ images, onRemoveAllForAllImages, onClearCleanedImages, isBatchProcessing }: BatchToolbarProps) {
  const cleanedImages = images.filter((img) => img.cleaned);

  const handleDownloadAll = async () => {
    const zipBlob = await buildZipBlob(
      cleanedImages.map((img) => ({ name: img.file.name, blob: img.cleaned!.blob })),
    );
    const url = URL.createObjectURL(zipBlob);
    triggerDownload(url, "imagens-sem-metadados.zip");
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <RetroButton type="button" disabled={images.length === 0 || isBatchProcessing} onClick={onRemoveAllForAllImages}>
        Remover todos os metadados de todas as imagens
      </RetroButton>
      <RetroButton type="button" disabled={cleanedImages.length === 0} onClick={handleDownloadAll}>
        Baixar tudo (.zip)
      </RetroButton>
      <RetroButton type="button" disabled={cleanedImages.length === 0} onClick={onClearCleanedImages}>
        Limpar histórico
      </RetroButton>
    </div>
  );
}
