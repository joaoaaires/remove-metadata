// Dev-only script: (re)generates the binary test fixtures under src/test/fixtures/.
// Run with: node scripts/generate-fixtures.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import zlib from "node:zlib";
import piexif from "piexifjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "..", "src", "test", "fixtures");
mkdirSync(fixturesDir, { recursive: true });

// A minimal valid 1x1 pixel JPEG (baseline, no metadata segments).
const TINY_JPEG_BASE64 =
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=";

/** Strip all APPn (0xE0-0xEF) segments from a JPEG buffer, keeping SOI/DQT/SOF/DHT/SOS/scan/EOI intact. */
function stripAppSegments(buf) {
  const out = [buf[0], buf[1]]; // SOI
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) {
      // Scan data / EOI tail - copy the rest verbatim.
      out.push(...buf.subarray(i));
      break;
    }
    const marker = buf[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      out.push(buf[i], buf[i + 1]);
      i += 2;
      continue;
    }
    if (marker === 0xda) {
      // Start of scan: copy everything remaining verbatim (scan data has no length prefix).
      out.push(...buf.subarray(i));
      break;
    }
    const len = buf.readUInt16BE(i + 2);
    const isApp = marker >= 0xe0 && marker <= 0xef;
    if (!isApp) {
      out.push(...buf.subarray(i, i + 2 + len));
    }
    i += 2 + len;
  }
  return Buffer.from(out);
}

function buildJpegSegment(markerByte, payload) {
  const len = payload.length + 2;
  const header = Buffer.from([0xff, markerByte, (len >> 8) & 0xff, len & 0xff]);
  return Buffer.concat([header, payload]);
}

/** Insert raw APPn segments right after SOI, before any other segment. */
function insertSegmentsAfterSoi(buf, segments) {
  return Buffer.concat([buf.subarray(0, 2), ...segments, buf.subarray(2)]);
}

function buildIptcApp13(fields) {
  // fields: array of { dataset: number, value: string }
  const datasetBuffers = fields.map(({ dataset, value }) => {
    const valueBuf = Buffer.from(value, "utf8");
    const header = Buffer.from([0x1c, 0x02, dataset, (valueBuf.length >> 8) & 0xff, valueBuf.length & 0xff]);
    return Buffer.concat([header, valueBuf]);
  });
  const iptcData = Buffer.concat(datasetBuffers);
  const nameField = Buffer.from([0x00, 0x00]); // empty pascal string, padded to even
  const sizeField = Buffer.alloc(4);
  sizeField.writeUInt32BE(iptcData.length, 0);
  const paddedIptcData = iptcData.length % 2 === 0 ? iptcData : Buffer.concat([iptcData, Buffer.from([0x00])]);
  const resourceBlock = Buffer.concat([
    Buffer.from("8BIM", "ascii"),
    Buffer.from([0x04, 0x04]), // resource ID for IPTC-NAA
    nameField,
    sizeField,
    paddedIptcData,
  ]);
  const payload = Buffer.concat([Buffer.from("Photoshop 3.0\0", "ascii"), resourceBlock]);
  return buildJpegSegment(0xed, payload);
}

function buildXmpApp1(xml) {
  const payload = Buffer.concat([
    Buffer.from("http://ns.adobe.com/xap/1.0/\0", "ascii"),
    Buffer.from(xml, "utf8"),
  ]);
  return buildJpegSegment(0xe1, payload);
}

const XMP_XML = `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator><rdf:Seq><rdf:li>Test XMP Author</rdf:li></rdf:Seq></dc:creator></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;

const cleanBase = stripAppSegments(Buffer.from(TINY_JPEG_BASE64, "base64"));
writeFileSync(path.join(fixturesDir, "no-metadata.jpg"), cleanBase);

const exifObj = {
  "0th": {
    [piexif.ImageIFD.Make]: "AcmeCam",
    [piexif.ImageIFD.Model]: "Camera9000",
    [piexif.ImageIFD.Orientation]: 1,
  },
  Exif: {
    [piexif.ExifIFD.DateTimeOriginal]: "2024:01:01 12:00:00",
  },
  GPS: {
    [piexif.GPSIFD.GPSLatitudeRef]: "N",
    [piexif.GPSIFD.GPSLatitude]: [
      [37, 1],
      [46, 1],
      [0, 1],
    ],
    [piexif.GPSIFD.GPSLongitudeRef]: "W",
    [piexif.GPSIFD.GPSLongitude]: [
      [122, 1],
      [25, 1],
      [0, 1],
    ],
  },
};
const exifBytes = piexif.dump(exifObj);
const withExifBinary = piexif.insert(exifBytes, cleanBase.toString("binary"));
const withExifBuffer = Buffer.from(withExifBinary, "binary");
writeFileSync(path.join(fixturesDir, "with-exif.jpg"), withExifBuffer);

const iptcSegment = buildIptcApp13([{ dataset: 80, value: "Test Author" }]);
const xmpSegment = buildXmpApp1(XMP_XML);
const withAllMetadataBuffer = insertSegmentsAfterSoi(withExifBuffer, [iptcSegment, xmpSegment]);
writeFileSync(path.join(fixturesDir, "with-all-metadata.jpg"), withAllMetadataBuffer);

// --- PNG fixtures ---

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crc = zlib.crc32(Buffer.concat([typeBuf, data]));
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc >>> 0, 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function buildPng(ancillaryChunks) {
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(1, 0); // width
  ihdrData.writeUInt32BE(1, 4); // height
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type: RGB
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = pngChunk("IHDR", ihdrData);

  const rawScanline = Buffer.from([0x00, 0xff, 0x00, 0x00]); // filter byte + 1 red pixel
  const idat = pngChunk("IDAT", zlib.deflateSync(rawScanline));
  const iend = pngChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([PNG_SIGNATURE, ihdr, ...ancillaryChunks, idat, iend]);
}

writeFileSync(path.join(fixturesDir, "no-metadata.png"), buildPng([]));

const tExtChunk = pngChunk("tEXt", Buffer.from("Author\0Test PNG Author", "latin1"));
const tImeChunk = pngChunk("tIME", Buffer.from([0x07, 0xe8, 0x01, 0x01, 0x0c, 0x00, 0x00])); // 2024-01-01 12:00:00
const iTXtData = Buffer.concat([
  Buffer.from("Description\0", "ascii"),
  Buffer.from([0x00, 0x00]), // compression flag + method
  Buffer.from("\0", "ascii"), // empty language tag
  Buffer.from("\0", "ascii"), // empty translated keyword
  Buffer.from("A test PNG image", "utf8"),
]);
const iTXtChunk = pngChunk("iTXt", iTXtData);
const pngExifTiff = Buffer.from(exifBytes, "binary").subarray(6); // strip "Exif\0\0" prefix used in JPEG APP1
const eXIfChunk = pngChunk("eXIf", pngExifTiff);

writeFileSync(
  path.join(fixturesDir, "with-metadata.png"),
  buildPng([tExtChunk, tImeChunk, iTXtChunk, eXIfChunk]),
);

console.log("Fixtures written to", fixturesDir);
