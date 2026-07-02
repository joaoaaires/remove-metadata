import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BatchToolbar } from "./BatchToolbar";
import type { QueuedImage } from "../features/metadata/types";

function makeImage(overrides: Partial<QueuedImage> = {}): QueuedImage {
  return {
    id: "1",
    file: new File(["bytes"], "a.jpg", { type: "image/jpeg" }),
    previewUrl: "blob:preview",
    status: "ready",
    fields: [],
    selectedForRemoval: new Set(),
    isStripping: false,
    ...overrides,
  };
}

describe("BatchToolbar", () => {
  beforeEach(() => {
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  it("disables both actions when the queue is empty", () => {
    render(<BatchToolbar images={[]} onRemoveAllForAllImages={vi.fn()} isBatchProcessing={false} />);
    expect(screen.getByRole("button", { name: /remover todos os metadados/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /baixar tudo/i })).toBeDisabled();
  });

  it("enables 'remove all' once there are queued images and calls the handler", async () => {
    const onRemoveAllForAllImages = vi.fn();
    render(
      <BatchToolbar images={[makeImage()]} onRemoveAllForAllImages={onRemoveAllForAllImages} isBatchProcessing={false} />,
    );
    const button = screen.getByRole("button", { name: /remover todos os metadados/i });
    expect(button).toBeEnabled();
    await userEvent.click(button);
    expect(onRemoveAllForAllImages).toHaveBeenCalledOnce();
  });

  it("disables 'remove all' while a batch operation is already in progress", () => {
    render(<BatchToolbar images={[makeImage()]} onRemoveAllForAllImages={vi.fn()} isBatchProcessing />);
    expect(screen.getByRole("button", { name: /remover todos os metadados/i })).toBeDisabled();
  });

  it("keeps 'download all' disabled until at least one image has a cleaned blob", () => {
    render(<BatchToolbar images={[makeImage()]} onRemoveAllForAllImages={vi.fn()} isBatchProcessing={false} />);
    expect(screen.getByRole("button", { name: /baixar tudo/i })).toBeDisabled();
  });

  it("downloads a zip containing every cleaned image once enabled", async () => {
    const images = [
      makeImage({ id: "1", file: new File(["a"], "a.jpg"), cleaned: { blob: new Blob(["clean-a"]), url: "blob:a" } }),
      makeImage({ id: "2", file: new File(["b"], "b.jpg"), status: "ready" }), // not cleaned yet
    ];
    render(<BatchToolbar images={images} onRemoveAllForAllImages={vi.fn()} isBatchProcessing={false} />);

    const button = screen.getByRole("button", { name: /baixar tudo/i });
    expect(button).toBeEnabled();
    await userEvent.click(button);

    await waitFor(() => expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce());
  });
});
