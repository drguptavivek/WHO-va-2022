import React from "react";
import {
  Image as WebImage,
  Pressable as WebPressable,
  ScrollView as WebScrollView,
  Text as WebText,
  TextInput as WebTextInput,
  View as WebView
} from "react-native-web";

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

const webThemeValues: Record<string, string> = {
  "#f6f8f7": "var(--who-2022-web-color-canvas, #f5f7fa)",
  "#ffffff": "var(--who-2022-web-color-surface, #ffffff)",
  "#142a24": "var(--who-2022-web-color-ink, #1f2937)",
  "#213b34": "var(--who-2022-web-color-ink-subtle, #374151)",
  "#47625b": "var(--who-2022-web-color-muted, #667085)",
  "#536b64": "var(--who-2022-web-color-muted, #667085)",
  "#12372d": "var(--who-2022-web-color-brand-deep, #1e3a5f)",
  "#183d33": "var(--who-2022-web-color-brand-deep, #1e3a5f)",
  "#147d64": "var(--who-2022-web-color-brand, #2563eb)",
  "#edf5f2": "var(--who-2022-web-color-brand-soft, #eff6ff)",
  "#e3f4ee": "var(--who-2022-web-color-brand-soft, #eff6ff)",
  "#dce6e1": "var(--who-2022-web-color-border, #e2e8f0)",
  "#9fb4ad": "var(--who-2022-web-color-control-border, #b8c2d1)",
  "#315e73": "var(--who-2022-web-color-guidance, #475569)",
  "#a23a2a": "var(--who-2022-web-color-danger, #b42318)",
  "#b34231": "var(--who-2022-web-color-danger, #b42318)",
  "#d66552": "var(--who-2022-web-color-danger-border, #d92d20)",
  "#8c3022": "var(--who-2022-web-color-danger-strong, #912018)",
  "#fff8f6": "var(--who-2022-web-color-danger-soft, #fff1f0)",
  "#f3ded9": "var(--who-2022-web-color-danger-soft, #fff1f0)",
  "#10231e": "var(--who-2022-web-color-image-background, #111827)"
};

function webThemeStyle(style: unknown): unknown {
  if (Array.isArray(style)) return style.map(webThemeStyle);
  if (style == null || typeof style !== "object") return style;
  const themedStyle = Object.fromEntries(Object.entries(style).map(([property, value]) => [
    property,
    property === "maxWidth" && value === 760
      ? "var(--who-2022-web-form-max-width, 48rem)"
      : property === "borderRadius" && value === 8
        ? "var(--who-2022-web-radius-control, 8px)"
        : property === "borderRadius" && value === 12
          ? "var(--who-2022-web-radius-card, 12px)"
          : typeof value === "string" ? webThemeValues[value.toLowerCase()] ?? value : value
  ]));
  if ((style as Record<string, unknown>).padding === 20) {
    delete themedStyle.padding;
    const sharedFallback = "var(--who-2022-web-form-padding, clamp(1rem, 2.5vw, 1.5rem))";
    themedStyle.paddingBlock = `var(--who-2022-web-form-padding-block, ${sharedFallback})`;
    themedStyle.paddingInline = `var(--who-2022-web-form-padding-inline, ${sharedFallback})`;
  }
  return themedStyle;
}

function themedPrimitive(Component: React.ElementType, displayName: string): React.ElementType {
  const ThemedPrimitive = React.forwardRef<unknown, Record<string, unknown>>(({ style, contentContainerStyle, ...props }, ref) => (
    <Component
      {...props}
      ref={ref}
      style={webThemeStyle(style)}
      contentContainerStyle={webThemeStyle(contentContainerStyle)}
    />
  ));
  ThemedPrimitive.displayName = displayName;
  return ThemedPrimitive;
}

const View = themedPrimitive(WebView, "WhoVaWebView");
const Text = themedPrimitive(WebText, "WhoVaWebText");
const TextInput = themedPrimitive(WebTextInput, "WhoVaWebTextInput");
const Pressable = themedPrimitive(WebPressable, "WhoVaWebPressable");
const ScrollView = themedPrimitive(WebScrollView, "WhoVaWebScrollView");
const Image = themedPrimitive(WebImage, "WhoVaWebImage");

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
