import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UploadDropzone } from "./UploadDropzone";

function makeFile(name: string, type: string): File {
  return new File(["fake-bytes"], name, { type });
}

describe("UploadDropzone", () => {
  it("renders a labeled file input accepting multiple files", () => {
    render(<UploadDropzone onFilesAccepted={vi.fn()} />);
    const input = screen.getByLabelText(/escolher imagens/i) as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.multiple).toBe(true);
  });

  it("accepts multiple JPEG/PNG files selected via the file picker", async () => {
    const onFilesAccepted = vi.fn();
    render(<UploadDropzone onFilesAccepted={onFilesAccepted} />);
    const input = screen.getByLabelText(/escolher imagens/i);

    const files = [makeFile("a.jpg", "image/jpeg"), makeFile("b.png", "image/png")];
    await userEvent.upload(input, files);

    expect(onFilesAccepted).toHaveBeenCalledWith(files);
  });

  it("rejects unsupported file types with a visible message, still accepting the valid ones", () => {
    // Dropped files (unlike a native file-picker selection) aren't pre-filtered by the
    // input's `accept` attribute, so the app's own validation is what's under test here.
    const onFilesAccepted = vi.fn();
    render(<UploadDropzone onFilesAccepted={onFilesAccepted} />);
    const dropzone = screen.getByTestId("upload-dropzone");

    const jpeg = makeFile("a.jpg", "image/jpeg");
    const pdf = makeFile("doc.pdf", "application/pdf");
    fireEvent.drop(dropzone, { dataTransfer: { files: [jpeg, pdf] } });

    expect(onFilesAccepted).toHaveBeenCalledWith([jpeg]);
    expect(screen.getByRole("alert")).toHaveTextContent(/doc\.pdf/i);
  });

  it("accepts files dropped onto the dropzone", () => {
    const onFilesAccepted = vi.fn();
    render(<UploadDropzone onFilesAccepted={onFilesAccepted} />);
    const dropzone = screen.getByTestId("upload-dropzone");
    const file = makeFile("a.jpg", "image/jpeg");

    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });

    expect(onFilesAccepted).toHaveBeenCalledWith([file]);
  });
});
