import { ImageCard } from "./ImageCard";
import type { QueuedImage } from "../features/metadata/types";

type ImageQueueListProps = {
  images: QueuedImage[];
  onToggleField: (imageId: string, fieldId: string) => void;
  onRemoveSelected: (imageId: string) => void;
  onRemoveAll: (imageId: string) => void;
  onRemoveImage: (imageId: string) => void;
};

export function ImageQueueList({
  images,
  onToggleField,
  onRemoveSelected,
  onRemoveAll,
  onRemoveImage,
}: ImageQueueListProps) {
  if (images.length === 0) return null;

  return (
    <div className="space-y-4">
      {images.map((image) => (
        <ImageCard
          key={image.id}
          image={image}
          onToggleField={onToggleField}
          onRemoveSelected={onRemoveSelected}
          onRemoveAll={onRemoveAll}
          onRemoveImage={onRemoveImage}
        />
      ))}
    </div>
  );
}
