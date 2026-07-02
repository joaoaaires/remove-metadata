import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RetroButton } from "./RetroButton";

describe("RetroButton", () => {
  it("renders its label", () => {
    render(<RetroButton>Upload</RetroButton>);
    expect(screen.getByRole("button", { name: "Upload" })).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    render(<RetroButton onClick={onClick}>Go</RetroButton>);
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not call onClick when disabled", async () => {
    const onClick = vi.fn();
    render(
      <RetroButton onClick={onClick} disabled>
        Go
      </RetroButton>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
