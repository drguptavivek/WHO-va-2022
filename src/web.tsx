import type React from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native-web";

import { createWhoVaForm } from "./ui/create-who-va-form.js";
import { createLocalStorageDraftStore } from "./draft.js";

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
  questionNode.scrollIntoView?.({ behavior: "smooth", block: "center" });
  questionNode.querySelector<HTMLElement>(
    'input, textarea, select, button, [role="radio"], [role="checkbox"], [role="button"]'
  )?.focus({ preventScroll: true });
}

export const WhoVaForm = createWhoVaForm({
  View,
  Text,
  TextInput,
  DateInput: WebDateInput,
  Pressable,
  ScrollView,
  draftStore: createLocalStorageDraftStore(),
  scrollToQuestion: scrollToWebQuestion
});
