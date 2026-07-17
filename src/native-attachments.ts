/**
 * React Native attachment adapter that applies the shared image policy through
 * host-provided file, image-encoding, and persistence operations.
 */
import {
  AttachmentProcessingError,
  WHO_VA_ATTACHMENT_POLICY,
  processImageAttachment,
  type ImageAttachmentPolicy,
  type ImageEncodingOptions,
  type ProcessImageAttachmentOptions
} from "./attachments.js";

export interface NativeAttachmentSelection {
  uri: string;
  name: string;
}

export interface NativeAttachmentFileAdapter {
  getSize(uri: string): Promise<number>;
  read(uri: string): Promise<Uint8Array>;
  encodeJpeg(uri: string, options: ImageEncodingOptions): Promise<string>;
  persist(temporaryUri: string, name: string): Promise<string>;
  remove(uri: string): Promise<void>;
}

export interface NativeProcessedImageReference {
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

export interface ProcessNativeImageAttachmentOptions {
  policy?: ImageAttachmentPolicy;
  createId?: ProcessImageAttachmentOptions["createId"];
}

export async function processNativeImageAttachment(
  selection: NativeAttachmentSelection,
  adapter: NativeAttachmentFileAdapter,
  options: ProcessNativeImageAttachmentOptions = {}
): Promise<NativeProcessedImageReference> {
  const policy = options.policy ?? WHO_VA_ATTACHMENT_POLICY.image;
  if (await adapter.getSize(selection.uri) > policy.maxInputBytes) {
    throw new AttachmentProcessingError("image-input-too-large");
  }

  let temporaryUri: string | undefined;
  try {
    const processed = await processImageAttachment({
      name: selection.name,
      bytes: await adapter.read(selection.uri)
    }, {
      async encodeJpeg(_image, encodingOptions) {
        if (temporaryUri) await adapter.remove(temporaryUri).catch(() => undefined);
        temporaryUri = await adapter.encodeJpeg(selection.uri, encodingOptions);
        return adapter.read(temporaryUri);
      }
    }, {
      policy,
      ...(options.createId ? { createId: options.createId } : {})
    });
    if (!temporaryUri) throw new AttachmentProcessingError("image-output-invalid");

    let durableUri: string;
    try {
      durableUri = await adapter.persist(temporaryUri, processed.name);
    } catch (error) {
      throw new AttachmentProcessingError("attachment-storage-failed", error);
    }
    return {
      id: processed.id,
      uri: durableUri,
      name: processed.name,
      originalName: processed.originalName,
      mimeType: processed.mimeType,
      size: processed.size,
      width: processed.width,
      height: processed.height,
      processed: true
    };
  } finally {
    if (temporaryUri) await adapter.remove(temporaryUri).catch(() => undefined);
  }
}
