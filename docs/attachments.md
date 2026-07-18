# Attachment processing

Attachment selection is fail-closed. A file chooser's extension and reported MIME type are only hints; neither enters a draft as evidence that the file is safe.

## Shared policy

`WHO_VA_ATTACHMENT_POLICY` is the single runtime policy used by web and native adapters.

| Attachment | Input                                                                         | Processing                                                                                                                                                                     | Stored output                                                               |
| ---------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Image      | JPEG or PNG, at most 10 MB, at most 16 megapixels and 8,192 px on either edge | Verify signature and dimensions, decode, correct browser orientation, resize to a 2,048 px longest edge, add a white background, and retry JPEG encoding at decreasing quality | One UUID-named JPEG of at most 2 MB                                         |
| PDF        | Valid PDF signature, at most 5 MB and 10 pages                                | Parse every page, render it with active forms/XFA disabled, and JPEG-encode each page at a 1,600 px longest edge                                                               | An atomic page-image manifest of at most 10 MB; the PDF itself is discarded |

SVG, GIF, HEIC, WebP, renamed executables, renamed PDFs, malformed images, zero-sized images, and files outside the policy are rejected. They can be added later only with an explicit decoder, canonical output format, and tests.

## Web lifecycle

`@drguptavivek/who-2022-va/web` provides the complete browser implementation:

1. The picker accepts only JPEG/PNG for images and PDF for documents.
2. `processWebImageAttachment()` inspects the real bytes before browser decoding.
3. Canvas creates a new JPEG rather than preserving the selected file structure, metadata, or filename.
4. `processWebPdfAttachment()` uses PDF.js in its worker and commits page JPEGs only after every page renders successfully.
5. Generated binary files are stored in IndexedDB by `createIndexedDbWebAttachmentStore()`.
6. The answer and local-storage draft contain only `who-va-attachment:` or `who-va-pdf-pages:` UUID references and metadata.
7. Preview URLs are temporary `blob:` URLs and are revoked when no longer used.

If IndexedDB, decoding, rendering, or storage fails, the control shows a realtime error and does not set an answer.

## Expo and React Native lifecycle

The native entry point exports `processNativeImageAttachment()`. It applies the shared byte, signature, dimension, resizing, output-size, UUID, and processed-marker contract while the host supplies device operations:

```ts
import { processNativeImageAttachment } from "@drguptavivek/who-2022-va/native";

const platform = {
  selectImage: async () => {
    const asset = await pickFromImageLibrary();
    return { uri: asset.uri, name: asset.fileName ?? "selected-image" };
  },
  processImage: async (selection) =>
    processNativeImageAttachment(selection, {
      getSize: appFiles.getSize,
      read: appFiles.readBytes,
      encodeJpeg: async (uri, options) => {
        // Use expo-image-manipulator here. Return its temporary JPEG URI.
        return manipulateToJpeg(uri, options);
      },
      persist: appFiles.copyIntoEncryptedAttachmentStore,
      remove: appFiles.removeTemporaryFile
    })
};
```

`encodeJpeg` is the Expo seam for `expo-image-manipulator`; `persist` must move or copy the verified result from cache into application-controlled durable storage. The reusable image control rejects an unprocessed picker URI if `processImage` is absent.

There is no portable PDF rasteriser in Expo Go. A native host may implement `platform.processPdf` with a vetted native renderer and return the same processed page-manifest shape. Without that adapter, native PDF selection fails closed and the original PDF is not saved. Server-side conversion remains a valid alternative when online operation is acceptable.

## Server boundary

Frontend canonicalisation protects drafts and gives immediate feedback, but is not a server security boundary. On synchronization, the receiving service must repeat size and content validation, scan uploads, generate its own storage keys, store files outside an executable webroot, and serve them with authoritative MIME types and `X-Content-Type-Options: nosniff`.
