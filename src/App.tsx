import { RetroPanel } from "./components/retro/RetroPanel";
import { UploadDropzone } from "./components/UploadDropzone";
import { ImageQueueList } from "./components/ImageQueueList";
import { BatchToolbar } from "./components/BatchToolbar";
import { useImageQueue } from "./features/metadata/useImageQueue";

function App() {
  const {
    images,
    isBatchProcessing,
    addFiles,
    toggleFieldSelection,
    removeSelectedFields,
    removeAllFields,
    removeAllFieldsForAllImages,
    removeImage,
    clearCleanedImages,
  } = useImageQueue();

  return (
    <div className="min-h-screen p-4 sm:p-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <RetroPanel title="metadata-scrubber.exe">
          <p className="text-sm">
            Envie imagens JPEG ou PNG para inspecionar e remover metadados — tudo no seu navegador.
          </p>
        </RetroPanel>

        <UploadDropzone onFilesAccepted={addFiles} />

        {images.length > 0 && (
          <>
            <BatchToolbar
              images={images}
              onRemoveAllForAllImages={removeAllFieldsForAllImages}
              onClearCleanedImages={clearCleanedImages}
              isBatchProcessing={isBatchProcessing}
            />
            <ImageQueueList
              images={images}
              onToggleField={toggleFieldSelection}
              onRemoveSelected={removeSelectedFields}
              onRemoveAll={removeAllFields}
              onRemoveImage={removeImage}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default App;
