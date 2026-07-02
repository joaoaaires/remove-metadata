import { useCallback, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { RetroPanel } from "./retro/RetroPanel";
import { RetroButton } from "./retro/RetroButton";

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png"]);

type UploadDropzoneProps = {
  onFilesAccepted: (files: File[]) => void;
};

export function UploadDropzone({ onFilesAccepted }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rejections, setRejections] = useState<string[]>([]);

  const processFiles = useCallback(
    (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      const accepted: File[] = [];
      const rejected: string[] = [];
      for (const file of files) {
        if (ACCEPTED_TYPES.has(file.type)) accepted.push(file);
        else rejected.push(`${file.name}: tipo de arquivo não suportado`);
      }
      setRejections(rejected);
      if (accepted.length > 0) onFilesAccepted(accepted);
    },
    [onFilesAccepted],
  );

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) processFiles(event.target.files);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    processFiles(event.dataTransfer.files);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  return (
    <RetroPanel title="Enviar imagens">
      <div
        data-testid="upload-dropzone"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="flex flex-col items-center gap-3 border-2 border-dashed border-retro-shadow p-6 text-center"
      >
        <p className="text-sm">Arraste imagens JPEG ou PNG aqui, ou:</p>
        <RetroButton type="button" onClick={() => inputRef.current?.click()}>
          Escolher imagens
        </RetroButton>
        <label className="sr-only" htmlFor="file-upload-input">
          Escolher imagens
        </label>
        <input
          id="file-upload-input"
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png"
          multiple
          className="sr-only"
          onChange={handleInputChange}
        />
      </div>
      {rejections.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-red-700" role="alert">
          {rejections.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
    </RetroPanel>
  );
}
