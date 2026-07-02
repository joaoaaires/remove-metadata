import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MetadataFieldList } from "./MetadataFieldList";
import type { MetadataField } from "../features/metadata/types";

const fields: MetadataField[] = [
  { id: "tiff:Make", label: "Make", value: "AcmeCam", kind: "tiff" },
  { id: "gps:GPSLatitude", label: "GPS Latitude", value: "37, 46, 0", kind: "gps" },
  {
    id: "tiff:Orientation",
    label: "Orientation",
    value: "Horizontal (normal)",
    kind: "tiff",
    note: "Affects display rotation in some apps",
  },
  { id: "block:iptc", label: "IPTC data", value: "Present", kind: "block" },
  { id: "text:1", label: "Author", value: "Test PNG Author", kind: "text" },
];

describe("MetadataFieldList", () => {
  it("shows a no-metadata message when the field list is empty", () => {
    render(<MetadataFieldList fields={[]} selected={new Set()} onToggle={vi.fn()} />);
    expect(screen.getByText(/nenhum metadado encontrado/i)).toBeInTheDocument();
  });

  it("lists each field with its label and value", () => {
    render(<MetadataFieldList fields={fields} selected={new Set()} onToggle={vi.fn()} />);
    expect(screen.getByText("Make")).toBeInTheDocument();
    expect(screen.getByText("AcmeCam")).toBeInTheDocument();
    expect(screen.getByText("GPS Latitude")).toBeInTheDocument();
  });

  it("shows the field note when present", () => {
    render(<MetadataFieldList fields={fields} selected={new Set()} onToggle={vi.fn()} />);
    expect(screen.getByText(/affects display rotation/i)).toBeInTheDocument();
  });

  it("reflects the selected set via checkbox checked state", () => {
    render(<MetadataFieldList fields={fields} selected={new Set(["tiff:Make"])} onToggle={vi.fn()} />);
    expect(screen.getByRole("checkbox", { name: /make/i })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /gps latitude/i })).not.toBeChecked();
  });

  it("calls onToggle with the field id when its checkbox is clicked", async () => {
    const onToggle = vi.fn();
    render(<MetadataFieldList fields={fields} selected={new Set()} onToggle={onToggle} />);
    await userEvent.click(screen.getByRole("checkbox", { name: /make/i }));
    expect(onToggle).toHaveBeenCalledWith("tiff:Make");
  });

  it("groups EXIF/GPS fields separately from IPTC/XMP block entries", () => {
    render(<MetadataFieldList fields={fields} selected={new Set()} onToggle={vi.fn()} />);
    const exifSection = screen.getByTestId("metadata-section-exif");
    const blockSection = screen.getByTestId("metadata-section-block");
    expect(within(exifSection).getByText("Make")).toBeInTheDocument();
    expect(within(blockSection).getByText("IPTC data")).toBeInTheDocument();
    expect(within(exifSection).queryByText("IPTC data")).not.toBeInTheDocument();
  });
});
