import {
  AttachmentProcessingError,
  WHO_VA_ATTACHMENT_POLICY,
  processImageAttachment,
  processPdfAttachment,
  type ImageAttachmentPolicy,
  type ImageTranscoder,
  type PdfRasterizer
} from "./attachments.js";

const WEB_ATTACHMENT_DATABASE = "who-va-2022-attachments";
const WEB_ATTACHMENT_OBJECT_STORE = "binary";

export interface WebImageFile {
  name: string;
  size: number;
  type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface WebAttachmentBinaryStore {
  save(id: string, blob: Blob): Promise<void>;
  load(id: string): Promise<Blob | undefined>;
  remove(id: string): Promise<void>;
}

export interface WebStoredAttachmentReference {
  [key: string]: unknown;
  id: string;
  uri: string;
  name: string;
  originalName: string;
  mimeType: "image/jpeg";
  size: number;
  width: number;
  height: number;
  processed: true;
}

export interface WebStoredPdfPageReference {
  id: string;
  uri: string;
  name: string;
  mimeType: "image/jpeg";
  size: number;
  width: number;
  height: number;
}

export interface WebStoredPdfReference {
  [key: string]: unknown;
  id: string;
  uri: string;
  name: string;
  originalName: string;
  mimeType: "application/vnd.who-va.pdf-pages+json";
  pageCount: number;
  size: number;
  originalRetained: false;
  processed: true;
  pages: WebStoredPdfPageReference[];
}

export interface ProcessWebImageAttachmentOptions {
  store: WebAttachmentBinaryStore;
  transcoder?: ImageTranscoder;
  policy?: ImageAttachmentPolicy;
  createId?: () => string;
}

export interface ProcessWebPdfAttachmentOptions {
  store: WebAttachmentBinaryStore;
  rasterizer?: PdfRasterizer;
  createId?: () => string;
}

function openAttachmentDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(WEB_ATTACHMENT_DATABASE, 1);
    request.addEventListener("upgradeneeded", () => {
      if (!request.result.objectStoreNames.contains(WEB_ATTACHMENT_OBJECT_STORE)) {
        request.result.createObjectStore(WEB_ATTACHMENT_OBJECT_STORE);
      }
    });
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error ?? new Error("Unable to open attachment storage")), { once: true });
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve(), { once: true });
    transaction.addEventListener("abort", () => reject(transaction.error ?? new Error("Attachment storage transaction was aborted")), { once: true });
    transaction.addEventListener("error", () => reject(transaction.error ?? new Error("Attachment storage transaction failed")), { once: true });
  });
}

export function createIndexedDbWebAttachmentStore(factory: IDBFactory | undefined = globalThis.indexedDB): WebAttachmentBinaryStore {
  let database: Promise<IDBDatabase> | undefined;
  const getDatabase = () => {
    if (!factory) return Promise.reject(new Error("IndexedDB is unavailable"));
    database ??= openAttachmentDatabase(factory);
    return database;
  };
  return {
    async save(id, blob) {
      const transaction = (await getDatabase()).transaction(WEB_ATTACHMENT_OBJECT_STORE, "readwrite");
      transaction.objectStore(WEB_ATTACHMENT_OBJECT_STORE).put(blob, id);
      await transactionComplete(transaction);
    },
    async load(id) {
      const transaction = (await getDatabase()).transaction(WEB_ATTACHMENT_OBJECT_STORE, "readonly");
      const request = transaction.objectStore(WEB_ATTACHMENT_OBJECT_STORE).get(id);
      return await new Promise<Blob | undefined>((resolve, reject) => {
        request.addEventListener("success", () => resolve(request.result instanceof Blob ? request.result : undefined), { once: true });
        request.addEventListener("error", () => reject(request.error ?? new Error("Unable to load attachment")), { once: true });
      });
    },
    async remove(id) {
      const transaction = (await getDatabase()).transaction(WEB_ATTACHMENT_OBJECT_STORE, "readwrite");
      transaction.objectStore(WEB_ATTACHMENT_OBJECT_STORE).delete(id);
      await transactionComplete(transaction);
    }
  };
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("The browser could not encode the image")),
      "image/jpeg",
      quality
    );
  });
}

function copiedArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export function createBrowserImageTranscoder(): ImageTranscoder {
  return {
    async encodeJpeg(image, options) {
      if (typeof globalThis.createImageBitmap !== "function" || typeof document === "undefined") {
        throw new AttachmentProcessingError("image-decode-failed");
      }
      const source = new Blob([copiedArrayBuffer(image.bytes)], { type: image.mimeType });
      const bitmap = await globalThis.createImageBitmap(source, { imageOrientation: "from-image" });
      try {
        const canvas = document.createElement("canvas");
        canvas.width = options.width;
        canvas.height = options.height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas rendering is unavailable");
        context.fillStyle = options.background;
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        return new Uint8Array(await (await canvasToJpeg(canvas, options.quality)).arrayBuffer());
      } finally {
        bitmap.close();
      }
    }
  };
}

export function createPdfJsRasterizer(): PdfRasterizer {
  return {
    async rasterizePdf(selection, options) {
      if (typeof document === "undefined") throw new AttachmentProcessingError("pdf-render-failed");
      const { getDocument } = await import("pdfjs-dist/webpack.mjs");
      const loadingTask = getDocument({
        data: copiedArrayBuffer(selection.bytes),
        stopAtErrors: true,
        enableXfa: false,
        maxImageSize: WHO_VA_ATTACHMENT_POLICY.image.maxPixels
      });
      let pdf: Awaited<typeof loadingTask.promise> | undefined;
      try {
        pdf = await loadingTask.promise;
        if (pdf.numPages > options.maxPages) throw new AttachmentProcessingError("pdf-too-many-pages");
        const pages = [];
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber);
          try {
            const initialViewport = page.getViewport({ scale: 1 });
            const desiredLongestEdge = Math.min(
              options.maxPageWidthOrHeight,
              Math.max(initialViewport.width, initialViewport.height) * 2.5
            );
            const scale = desiredLongestEdge / Math.max(initialViewport.width, initialViewport.height);
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.floor(viewport.width));
            canvas.height = Math.max(1, Math.floor(viewport.height));
            const context = canvas.getContext("2d");
            if (!context) throw new Error("Canvas rendering is unavailable");
            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, canvas.width, canvas.height);
            await page.render({ canvas, canvasContext: context, viewport, background: "#ffffff" }).promise;

            let blob: Blob | undefined;
            for (const quality of options.jpegQualities) {
              blob = await canvasToJpeg(canvas, quality);
              if (blob.size <= WHO_VA_ATTACHMENT_POLICY.image.maxOutputBytes) break;
            }
            if (!blob || blob.size > WHO_VA_ATTACHMENT_POLICY.image.maxOutputBytes) {
              throw new AttachmentProcessingError("pdf-output-too-large");
            }
            pages.push({
              bytes: new Uint8Array(await blob.arrayBuffer()),
              width: canvas.width,
              height: canvas.height
            });
          } finally {
            page.cleanup();
          }
        }
        return pages;
      } finally {
        await pdf?.cleanup();
        await loadingTask.destroy();
      }
    }
  };
}

export async function processWebImageAttachment(
  file: WebImageFile,
  options: ProcessWebImageAttachmentOptions
): Promise<WebStoredAttachmentReference> {
  const policy = options.policy ?? WHO_VA_ATTACHMENT_POLICY.image;
  if (file.size > policy.maxInputBytes) throw new AttachmentProcessingError("image-input-too-large");
  const processed = await processImageAttachment({
    name: file.name,
    bytes: new Uint8Array(await file.arrayBuffer())
  }, options.transcoder ?? createBrowserImageTranscoder(), {
    policy,
    ...(options.createId ? { createId: options.createId } : {})
  });
  try {
    await options.store.save(processed.id, new Blob([copiedArrayBuffer(processed.bytes)], { type: processed.mimeType }));
  } catch (error) {
    throw new AttachmentProcessingError("attachment-storage-failed", error);
  }
  return {
    id: processed.id,
    uri: `who-va-attachment:${processed.id}`,
    name: processed.name,
    originalName: processed.originalName,
    mimeType: processed.mimeType,
    size: processed.size,
    width: processed.width,
    height: processed.height,
    processed: true
  };
}

export async function processWebPdfAttachment(
  file: WebImageFile,
  options: ProcessWebPdfAttachmentOptions
): Promise<WebStoredPdfReference> {
  const policy = WHO_VA_ATTACHMENT_POLICY.pdf;
  if (file.size > policy.maxInputBytes) throw new AttachmentProcessingError("pdf-input-too-large");
  const processed = await processPdfAttachment({
    name: file.name,
    bytes: new Uint8Array(await file.arrayBuffer())
  }, options.rasterizer ?? createPdfJsRasterizer(), {
    policy,
    ...(options.createId ? { createId: options.createId } : {})
  });

  const savedIds: string[] = [];
  try {
    for (const page of processed.pages) {
      await options.store.save(page.id, new Blob([copiedArrayBuffer(page.bytes)], { type: page.mimeType }));
      savedIds.push(page.id);
    }
  } catch (error) {
    await Promise.allSettled(savedIds.map((id) => options.store.remove(id)));
    throw new AttachmentProcessingError("attachment-storage-failed", error);
  }

  return {
    id: processed.id,
    uri: `who-va-pdf-pages:${processed.id}`,
    name: processed.name,
    originalName: processed.originalName,
    mimeType: processed.mimeType,
    pageCount: processed.pageCount,
    size: processed.size,
    originalRetained: false,
    processed: true,
    pages: processed.pages.map((page) => ({
      id: page.id,
      uri: `who-va-attachment:${page.id}`,
      name: page.name,
      mimeType: page.mimeType,
      size: page.size,
      width: page.width,
      height: page.height
    }))
  };
}

export async function resolveWebAttachmentUri(
  reference: { id: string },
  store: WebAttachmentBinaryStore,
  createObjectURL: (blob: Blob) => string = URL.createObjectURL
): Promise<string | undefined> {
  const blob = await store.load(reference.id);
  return blob ? createObjectURL(blob) : undefined;
}
