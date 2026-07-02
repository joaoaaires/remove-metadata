import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RetroPanel } from "./RetroPanel";

describe("RetroPanel", () => {
  it("renders its children", () => {
    render(
      <RetroPanel>
        <p>Panel content</p>
      </RetroPanel>,
    );
    expect(screen.getByText("Panel content")).toBeInTheDocument();
  });

  it("renders a title bar when a title is given", () => {
    render(<RetroPanel title="My Window">Body</RetroPanel>);
    expect(screen.getByText("My Window")).toBeInTheDocument();
  });

  it("renders no title bar text when no title is given", () => {
    render(<RetroPanel>Body</RetroPanel>);
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});
