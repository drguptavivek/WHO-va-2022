import type React from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native-web";

import { createWhoVaForm } from "./ui/create-who-va-form.js";
import { createLocalStorageDraftStore } from "./draft.js";
import { createWhoVaQuestionControls, type WhoVaPlatformServices } from "./ui/question-controls.js";
import type { AnswerValue } from "./types.js";
import {
  createIndexedDbWebAttachmentStore,
  processWebImageAttachment,
  processWebPdfAttachment,
  resolveWebAttachmentUri
} from "./web-attachments.js";

export * from "./index.js";
export type { WhoVaFormProps, WhoVaPlatformServices } from "./ui/create-who-va-form.js";

interface WebDateInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "style"> {
  accessibilityLabel?: string;
  onChangeText: (value: string) => void;
  style?: unknown;
  testID?: string;
}

function WebDateInput({ accessibilityLabel, onChangeText, style, testID, ...props }: WebDateInputProps) {
  const flattenedStyle = (Array.isArray(style) ? style.flat(Infinity) : [style])
    .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
    .reduce<Record<string, unknown>>((result, entry) => Object.assign(result, entry), {});
  return (
    <input
      {...props}
      type="date"
      aria-label={accessibilityLabel}
      data-testid={testID}
      style={flattenedStyle as React.CSSProperties}
      onChange={(event) => onChangeText(event.currentTarget.value)}
    />
  );
}

function scrollToWebQuestion(questionNode: unknown) {
  if (typeof HTMLElement === "undefined" || !(questionNode instanceof HTMLElement)) return;
  questionNode.scrollIntoView?.({ behavior: "smooth", block: "start" });
  questionNode.querySelector<HTMLElement>(
    'input, textarea, select, button, [role="radio"], [role="checkbox"], [role="button"]'
  )?.focus({ preventScroll: true });
}

function selectWebFile(accept: string, capture = false): Promise<File | undefined> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    if (capture) input.setAttribute("capture", "environment");
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(undefined);
        return;
      }
      resolve(file);
    }, { once: true });
    input.addEventListener("cancel", () => resolve(undefined), { once: true });
    input.click();
  });
}

const webAttachmentStore = createIndexedDbWebAttachmentStore();

async function selectAndProcessWebImage(capture = false): Promise<AnswerValue | undefined> {
  const file = await selectWebFile("image/jpeg,image/png", capture);
  return file ? processWebImageAttachment(file, { store: webAttachmentStore }) : undefined;
}

async function selectAndProcessWebPdf(): Promise<AnswerValue | undefined> {
  const file = await selectWebFile("application/pdf");
  return file ? processWebPdfAttachment(file, { store: webAttachmentStore }) : undefined;
}

const webAttachmentPlatform: WhoVaPlatformServices = {
  captureImage: async () => selectAndProcessWebImage(true),
  selectImage: async () => selectAndProcessWebImage(),
  selectFile: async (_question, _data, acceptedMimeTypes) => {
    if (!acceptedMimeTypes.includes("application/pdf")) return undefined;
    return selectAndProcessWebPdf();
  },
  resolveAttachmentUri: async (attachment) => {
    if (attachment == null || Array.isArray(attachment) || typeof attachment !== "object" || typeof attachment.id !== "string") return undefined;
    return resolveWebAttachmentUri({ id: attachment.id }, webAttachmentStore);
  },
  releaseAttachmentUri: (uri) => {
    if (uri.startsWith("blob:")) URL.revokeObjectURL(uri);
  },
  removeAttachment: async (attachment) => {
    if (attachment != null && !Array.isArray(attachment) && typeof attachment === "object" && typeof attachment.id === "string") {
      const pages = Array.isArray(attachment.pages) ? attachment.pages : [];
      const pageIds = pages.flatMap((page) => (
        page != null && typeof page === "object" && "id" in page && typeof page.id === "string" ? [page.id] : []
      ));
      await Promise.all(pageIds.length > 0
        ? pageIds.map((id) => webAttachmentStore.remove(id))
        : [webAttachmentStore.remove(attachment.id)]);
    }
  }
};

export {
  createBrowserImageTranscoder,
  createIndexedDbWebAttachmentStore,
  createPdfJsRasterizer,
  processWebImageAttachment,
  processWebPdfAttachment,
  resolveWebAttachmentUri
} from "./web-attachments.js";

export const WhoVaForm = createWhoVaForm({
  View,
  Text,
  TextInput,
  DateInput: WebDateInput,
  Pressable,
  ScrollView,
  Image,
  platform: webAttachmentPlatform,
  draftStore: createLocalStorageDraftStore(),
  scrollToQuestion: scrollToWebQuestion
});

export const WhoVaQuestionControls = createWhoVaQuestionControls({
  View,
  Text,
  TextInput,
  DateInput: WebDateInput,
  Pressable,
  Image,
  platform: webAttachmentPlatform
});
export type { WhoVaQuestionControlProps } from "./ui/question-controls.js";
