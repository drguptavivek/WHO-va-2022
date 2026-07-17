import type React from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native-web";

import { createWhoVaForm } from "./ui/create-who-va-form.js";
import { createLocalStorageDraftStore } from "./draft.js";
import { createWhoVaQuestionControls, type WhoVaPlatformServices } from "./ui/question-controls.js";
import type { AnswerValue } from "./types.js";

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

function selectWebAttachment(accept: string, capture = false): Promise<AnswerValue | undefined> {
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
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve({
        uri: String(reader.result),
        name: file.name,
        mimeType: file.type || accept,
        size: file.size
      }));
      reader.addEventListener("error", () => resolve(undefined));
      reader.readAsDataURL(file);
    }, { once: true });
    input.addEventListener("cancel", () => resolve(undefined), { once: true });
    input.click();
  });
}

const webAttachmentPlatform: WhoVaPlatformServices = {
  captureImage: async () => selectWebAttachment("image/*", true),
  selectImage: async () => selectWebAttachment("image/*"),
  selectFile: async (_question, _data, acceptedMimeTypes) => selectWebAttachment(acceptedMimeTypes.join(","))
};

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
