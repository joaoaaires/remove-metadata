import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImageQueueList } from "./ImageQueueList";
import type { QueuedImage } from "../features/metadata/types";

function makeImage(id: string, name: string): QueuedImage {
  return {
    id,
    file: new File(["bytes"], name, { type: "image/jpeg" }),
    previewUrl: "blob:preview",
    status: "ready",
    fields: [],
    selectedForRemoval: new Set(),
    isStripping: false,
  };
}

describe("ImageQueueList", () => {
  it("renders nothing when the queue is empty", () => {
    const { container } = render(
      <ImageQueueList
        images={[]}
        onToggleField={vi.fn()}
        onRemoveSelected={vi.fn()}
        onRemoveAll={vi.fn()}
        onRemoveImage={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders one card per queued image", () => {
    const images = [makeImage("1", "a.jpg"), makeImage("2", "b.jpg")];
    render(
      <ImageQueueList
        images={images}
        onToggleField={vi.fn()}
        onRemoveSelected={vi.fn()}
        onRemoveAll={vi.fn()}
        onRemoveImage={vi.fn()}
      />,
    );
    expect(screen.getByText("a.jpg")).toBeInTheDocument();
    expect(screen.getByText("b.jpg")).toBeInTheDocument();
  });

  it("passes onRemoveImage through to each card", async () => {
    const onRemoveImage = vi.fn();
    const images = [makeImage("1", "a.jpg"), makeImage("2", "b.jpg")];
    render(
      <ImageQueueList
        images={images}
        onToggleField={vi.fn()}
        onRemoveSelected={vi.fn()}
        onRemoveAll={vi.fn()}
        onRemoveImage={onRemoveImage}
      />,
    );
    const buttons = screen.getAllByRole("button", { name: /remover da lista/i });
    expect(buttons).toHaveLength(2);
    await userEvent.click(buttons[1]);
    expect(onRemoveImage).toHaveBeenCalledWith("2");
  });
});
