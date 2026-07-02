import { RetroPanel } from "./retro/RetroPanel";
import { RetroButton } from "./retro/RetroButton";
import { MetadataFieldList } from "./MetadataFieldList";
import { triggerDownload } from "../features/metadata/download";
import type { QueuedImage } from "../features/metadata/types";

type ImageCardProps = {
  image: QueuedImage;
  onToggleField: (imageId: string, fieldId: string) => void;
  onRemoveSelected: (imageId: string) => void;
  onRemoveAll: (imageId: string) => void;
};

export function ImageCard({ image, onToggleField, onRemoveSelected, onRemoveAll }: ImageCardProps) {
  const actionsDisabled = image.isStripping || image.status !== "ready";

  return (
    <RetroPanel title={image.file.name}>
      <div className="flex gap-4">
        <img
          src={image.previewUrl}
          alt={image.file.name}
          className="h-16 w-16 shrink-0 border-2 border-t-retro-shadow border-l-retro-shadow border-b-retro-highlight border-r-retro-highlight object-cover"
        />
        <div className="min-w-0 flex-1 space-y-3">
          {image.status === "parsing" && <p className="text-sm italic">Lendo metadados…</p>}

          {image.status === "error" && (
            <p className="text-sm text-red-700" role="alert">
              {image.errorMessage}
            </p>
          )}

          {image.status === "ready" && (
            <>
              <MetadataFieldList
                fields={image.fields}
                selected={image.selectedForRemoval}
                onToggle={(fieldId) => onToggleField(image.id, fieldId)}
              />
              <div className="flex flex-wrap gap-2">
                <RetroButton
                  type="button"
                  disabled={actionsDisabled || image.selectedForRemoval.size === 0}
                  onClick={() => onRemoveSelected(image.id)}
                >
                  Remover selecionados
                </RetroButton>
                <RetroButton type="button" disabled={actionsDisabled} onClick={() => onRemoveAll(image.id)}>
                  Remover tudo
                </RetroButton>
                <RetroButton
                  type="button"
                  disabled={!image.cleaned}
                  onClick={() => image.cleaned && triggerDownload(image.cleaned.url, image.file.name)}
                >
                  Baixar
                </RetroButton>
              </div>
            </>
          )}
        </div>
      </div>
    </RetroPanel>
  );
}
