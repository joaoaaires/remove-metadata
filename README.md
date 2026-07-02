# metadata-scrubber

A browser-only tool for inspecting and stripping hidden metadata (EXIF, GPS, IPTC, XMP, PNG text chunks) from JPEG and PNG images before you share them.

Upload one or more images, review the metadata fields attached to each, and remove selected fields or all of them — individually or across the whole batch. Everything runs client-side: images are never uploaded to a server.

## Tech stack

- React 19 + TypeScript
- Vite
- Tailwind CSS v4 (retro-styled UI)
- [`exifr`](https://github.com/MikeKovarik/exifr) for parsing EXIF/GPS/IPTC/XMP metadata
- [`piexifjs`](https://github.com/hMatoba/piexifjs) and custom PNG-chunk handling for stripping metadata
- [`jszip`](https://github.com/Stuk/jszip) for batch/zip downloads
- Vitest + Testing Library for tests

## Scripts

- `yarn dev` — start the Vite dev server
- `yarn build` — type-check (`tsc -b`) and build for production
- `yarn lint` — run ESLint
- `yarn test` — run the test suite once
- `yarn test:watch` — run tests in watch mode

## Project structure

- `src/components` — UI components (upload dropzone, image queue, batch toolbar, metadata field list) and the `retro/` themed building blocks
- `src/features/metadata` — core logic: parsing metadata, stripping EXIF/PNG chunks, image format detection, download/zip generation, and the `useImageQueue` hook
- `src/test/fixtures` — sample JPEG/PNG images used by the test suite (with/without metadata, C2PA, undecodable EXIF, etc.)
