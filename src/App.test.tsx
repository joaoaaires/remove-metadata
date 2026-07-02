import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import path from "node:path";
import App from "./App";

function fixtureFile(name: string, type: string): File {
  const buf = readFileSync(path.join(__dirname, "test", "fixtures", name));
  const buffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  return new File([buffer], name, { type });
}

describe("App", () => {
  it("renders the app title and an upload control", () => {
    render(<App />);
    expect(screen.getByText(/metadata/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/escolher imagens/i)).toBeInTheDocument();
  });

  it("shows parsed metadata after uploading an image", async () => {
    render(<App />);
    const input = screen.getByLabelText(/escolher imagens/i);
    await userEvent.upload(input, fixtureFile("with-exif.jpg", "image/jpeg"));

    await waitFor(() => expect(screen.getByText("AcmeCam")).toBeInTheDocument());
  });

  it("lets the user remove all metadata and then enables downloading the cleaned image", async () => {
    render(<App />);
    const input = screen.getByLabelText(/escolher imagens/i);
    await userEvent.upload(input, fixtureFile("with-exif.jpg", "image/jpeg"));
    await waitFor(() => expect(screen.getByText("AcmeCam")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /remover tudo/i }));

    await waitFor(() => expect(screen.getByText(/nenhum metadado encontrado/i)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /^baixar$/i })).toBeEnabled();
  });

  it("shows the raw EXIF fallback (not 'no metadata found') for a JPEG exifr can't decode, and can remove it", async () => {
    render(<App />);
    const input = screen.getByLabelText(/escolher imagens/i);
    await userEvent.upload(input, fixtureFile("undecodable-exif.jpg", "image/jpeg"));

    await waitFor(() => expect(screen.getByText(/dados exif/i)).toBeInTheDocument());
    expect(screen.queryByText(/nenhum metadado encontrado/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /remover tudo/i }));

    await waitFor(() => expect(screen.getByText(/nenhum metadado encontrado/i)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /^baixar$/i })).toBeEnabled();
  });

  it("shows the raw EXIF fallback for a PNG exifr can't decode, and can remove it", async () => {
    render(<App />);
    const input = screen.getByLabelText(/escolher imagens/i);
    await userEvent.upload(input, fixtureFile("undecodable-exif.png", "image/png"));

    await waitFor(() => expect(screen.getByText(/dados exif/i)).toBeInTheDocument());
    expect(screen.queryByText(/nenhum metadado encontrado/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /remover tudo/i }));

    await waitFor(() => expect(screen.getByText(/nenhum metadado encontrado/i)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /^baixar$/i })).toBeEnabled();
  });
});
