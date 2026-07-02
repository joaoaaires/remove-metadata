import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImageCard } from "./ImageCard";
import type { QueuedImage } from "../features/metadata/types";

function makeImage(overrides: Partial<QueuedImage> = {}): QueuedImage {
  return {
    id: "img-1",
    file: new File(["bytes"], "vacation.jpg", { type: "image/jpeg" }),
    previewUrl: "blob:preview-url",
    status: "ready",
    fields: [{ id: "tiff:Make", label: "Make", value: "AcmeCam", kind: "tiff" }],
    selectedForRemoval: new Set(),
    isStripping: false,
    ...overrides,
  };
}

describe("ImageCard", () => {
  beforeEach(() => {
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  it("renders the file name and a thumbnail", () => {
    render(
      <ImageCard
        image={makeImage()}
        onToggleField={vi.fn()}
        onRemoveSelected={vi.fn()}
        onRemoveAll={vi.fn()}
        onRemoveImage={vi.fn()}
      />,
    );
    expect(screen.getByText("vacation.jpg")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /vacation\.jpg/i })).toHaveAttribute("src", "blob:preview-url");
  });

  it("shows a loading message while parsing", () => {
    render(
      <ImageCard
        image={makeImage({ status: "parsing", fields: [] })}
        onToggleField={vi.fn()}
        onRemoveSelected={vi.fn()}
        onRemoveAll={vi.fn()}
        onRemoveImage={vi.fn()}
      />,
    );
    expect(screen.getByText(/lendo metadados/i)).toBeInTheDocument();
  });

  it("shows the error message when parsing failed", () => {
    render(
      <ImageCard
        image={makeImage({ status: "error", errorMessage: "Unknown file format", fields: [] })}
        onToggleField={vi.fn()}
        onRemoveSelected={vi.fn()}
        onRemoveAll={vi.fn()}
        onRemoveImage={vi.fn()}
      />,
    );
    expect(screen.getByText(/unknown file format/i)).toBeInTheDocument();
  });

  it("calls onToggleField when a metadata field checkbox is clicked", async () => {
    const onToggleField = vi.fn();
    render(
      <ImageCard
        image={makeImage()}
        onToggleField={onToggleField}
        onRemoveSelected={vi.fn()}
        onRemoveAll={vi.fn()}
        onRemoveImage={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("checkbox", { name: /make/i }));
    expect(onToggleField).toHaveBeenCalledWith("img-1", "tiff:Make");
  });

  it("disables 'remove selected' until at least one field is selected", async () => {
    const onRemoveSelected = vi.fn();
    render(
      <ImageCard
        image={makeImage()}
        onToggleField={vi.fn()}
        onRemoveSelected={onRemoveSelected}
        onRemoveAll={vi.fn()}
        onRemoveImage={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /remover selecionados/i })).toBeDisabled();
  });

  it("enables and triggers 'remove selected' once fields are selected", async () => {
    const onRemoveSelected = vi.fn();
    render(
      <ImageCard
        image={makeImage({ selectedForRemoval: new Set(["tiff:Make"]) })}
        onToggleField={vi.fn()}
        onRemoveSelected={onRemoveSelected}
        onRemoveAll={vi.fn()}
        onRemoveImage={vi.fn()}
      />,
    );
    const button = screen.getByRole("button", { name: /remover selecionados/i });
    expect(button).toBeEnabled();
    await userEvent.click(button);
    expect(onRemoveSelected).toHaveBeenCalledWith("img-1");
  });

  it("triggers 'remove all' when clicked", async () => {
    const onRemoveAll = vi.fn();
    render(
      <ImageCard
        image={makeImage()}
        onToggleField={vi.fn()}
        onRemoveSelected={vi.fn()}
        onRemoveAll={onRemoveAll}
        onRemoveImage={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /remover tudo/i }));
    expect(onRemoveAll).toHaveBeenCalledWith("img-1");
  });

  it("disables the download button until a cleaned blob is available", () => {
    render(
      <ImageCard
        image={makeImage()}
        onToggleField={vi.fn()}
        onRemoveSelected={vi.fn()}
        onRemoveAll={vi.fn()}
        onRemoveImage={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /baixar/i })).toBeDisabled();
  });

  it("downloads the cleaned file preserving its original name once available", async () => {
    const cleanedUrl = "blob:cleaned-url";
    render(
      <ImageCard
        image={makeImage({ cleaned: { blob: new Blob(["x"]), url: cleanedUrl } })}
        onToggleField={vi.fn()}
        onRemoveSelected={vi.fn()}
        onRemoveAll={vi.fn()}
        onRemoveImage={vi.fn()}
      />,
    );
    const button = screen.getByRole("button", { name: /baixar/i });
    expect(button).toBeEnabled();
    await userEvent.click(button);
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
  });

  it("disables all actions while a strip operation is in progress", () => {
    render(
      <ImageCard
        image={makeImage({ isStripping: true, selectedForRemoval: new Set(["tiff:Make"]) })}
        onToggleField={vi.fn()}
        onRemoveSelected={vi.fn()}
        onRemoveAll={vi.fn()}
        onRemoveImage={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /remover selecionados/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /remover tudo/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /remover da lista/i })).toBeDisabled();
  });

  it("enables and triggers 'remove from list' when not stripping", async () => {
    const onRemoveImage = vi.fn();
    render(
      <ImageCard
        image={makeImage()}
        onToggleField={vi.fn()}
        onRemoveSelected={vi.fn()}
        onRemoveAll={vi.fn()}
        onRemoveImage={onRemoveImage}
      />,
    );
    const button = screen.getByRole("button", { name: /remover da lista/i });
    expect(button).toBeEnabled();
    await userEvent.click(button);
    expect(onRemoveImage).toHaveBeenCalledWith("img-1");
  });

  it("allows removing an errored image from the list", async () => {
    const onRemoveImage = vi.fn();
    render(
      <ImageCard
        image={makeImage({ status: "error", errorMessage: "Unknown file format", fields: [] })}
        onToggleField={vi.fn()}
        onRemoveSelected={vi.fn()}
        onRemoveAll={vi.fn()}
        onRemoveImage={onRemoveImage}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /remover da lista/i }));
    expect(onRemoveImage).toHaveBeenCalledWith("img-1");
  });
});
