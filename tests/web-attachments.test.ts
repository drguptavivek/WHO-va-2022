// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import { WHO_VA_ATTACHMENT_POLICY, type ImageTranscoder } from "../src/attachments.js";
import {
  processWebImageAttachment,
  processWebPdfAttachment,
  resolveWebAttachmentUri,
  type WebAttachmentBinaryStore,
  type WebImageFile
} from "../src/web-attachments.js";
import type { PdfRasterizer } from "../src/attachments.js";

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(32);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
}

function jpeg(width: number, height: number): Uint8Array {
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,
    0xff, 0xc0, 0x00, 0x0b, 0x08,
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    0x01, 0x01, 0x11, 0x00,
    0xff, 0xd9
  ]);
}

function arrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function memoryStore(): WebAttachmentBinaryStore & { saved: Map<string, Blob> } {
  const saved = new Map<string, Blob>();
  return {
    saved,
    async save(id, blob) { saved.set(id, blob); },
    async load(id) { return saved.get(id); },
    async remove(id) { saved.delete(id); }
  };
}

describe("web attachment processing", () => {
  it("stores only the generated JPEG and returns a durable draft reference", async () => {
    const original = png(3000, 2000);
    const file: WebImageFile = {
      name: "certificate.png",
      size: original.byteLength,
      type: "image/png",
      async arrayBuffer() { return arrayBuffer(original); }
    };
    const output = jpeg(2048, 1365);
    const transcoder: ImageTranscoder = { encodeJpeg: vi.fn().mockResolvedValue(output) };
    const store = memoryStore();

    const reference = await processWebImageAttachment(file, {
      store,
      transcoder,
      createId: () => "71abc7b2-262f-4d95-8993-4117ff764c3a"
    });

    expect(reference).toEqual({
      id: "71abc7b2-262f-4d95-8993-4117ff764c3a",
      uri: "who-va-attachment:71abc7b2-262f-4d95-8993-4117ff764c3a",
      name: "71abc7b2-262f-4d95-8993-4117ff764c3a.jpg",
      originalName: "certificate.png",
      mimeType: "image/jpeg",
      size: output.byteLength,
      width: 2048,
      height: 1365,
      processed: true
    });
    expect(store.saved.get(reference.id)?.type).toBe("image/jpeg");
    expect(new Uint8Array(await store.saved.get(reference.id)!.arrayBuffer())).toEqual(output);
  });

  it("resolves a stored attachment to a temporary preview URL", async () => {
    const store = memoryStore();
    await store.save("stored-image", new Blob([arrayBuffer(jpeg(100, 100))], { type: "image/jpeg" }));
    const createObjectURL = vi.fn(() => "blob:preview-url");

    await expect(resolveWebAttachmentUri({ id: "stored-image" }, store, createObjectURL))
      .resolves.toBe("blob:preview-url");
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
  });

  it("rejects an oversized selection before reading it into memory", async () => {
    const arrayBuffer = vi.fn();
    const file: WebImageFile = {
      name: "huge.jpg",
      size: WHO_VA_ATTACHMENT_POLICY.image.maxInputBytes + 1,
      type: "image/jpeg",
      arrayBuffer
    };

    await expect(processWebImageAttachment(file, {
      store: memoryStore(),
      transcoder: { encodeJpeg: vi.fn() }
    })).rejects.toMatchObject({ code: "image-input-too-large" });
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it("atomically stores converted PDF page images and never stores the original PDF", async () => {
    const original = new Uint8Array(64);
    original.set(new TextEncoder().encode("%PDF-1.7\n"));
    const file: WebImageFile = {
      name: "interview-notes.pdf",
      size: original.byteLength,
      type: "application/pdf",
      async arrayBuffer() { return arrayBuffer(original); }
    };
    const firstPage = jpeg(1448, 2048);
    const secondPage = jpeg(1448, 2048);
    const rasterizer: PdfRasterizer = {
      rasterizePdf: vi.fn().mockResolvedValue([
        { bytes: firstPage, width: 1448, height: 2048 },
        { bytes: secondPage, width: 1448, height: 2048 }
      ])
    };
    const store = memoryStore();

    const reference = await processWebPdfAttachment(file, {
      store,
      rasterizer,
      createId: () => "ad13fefc-9d37-47d7-94df-ec6c894e65dd"
    });

    expect(reference).toMatchObject({
      id: "ad13fefc-9d37-47d7-94df-ec6c894e65dd",
      uri: "who-va-pdf-pages:ad13fefc-9d37-47d7-94df-ec6c894e65dd",
      originalName: "interview-notes.pdf",
      pageCount: 2,
      originalRetained: false,
      processed: true
    });
    expect(store.saved.size).toBe(2);
    expect(Array.from(store.saved.values()).every((blob) => blob.type === "image/jpeg")).toBe(true);
    expect(Array.from(store.saved.values()).some((blob) => blob.type === "application/pdf")).toBe(false);
  });
});
