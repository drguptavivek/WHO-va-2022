/**
 * Factory and registry for reusable questionnaire controls, with host-injected
 * primitives and services for dates, audio, images, and files.
 */
import React, { useEffect, useRef, useState } from "react";

import {
  AttachmentProcessingError,
  WHO_VA_ATTACHMENT_POLICY,
  isProcessedImageAttachment,
  isRetainedPdfAttachment,
  type ImageAttachmentPolicy
} from "../attachments.js";
import type { AnswerValue, InstrumentQuestion, SubmissionData, ValidationIssue } from "../types.js";
import { dateFormatPlaceholder, formatDisplayDate, parseDisplayDate } from "./date-value.js";
import { ENGLISH_UI_MESSAGES, localizeText, type WhoVaUiMessages } from "../i18n.js";
import { withWebTheme } from "./web-theme.js";

export interface WhoVaPlatformServices {
  captureAudio?: (question: InstrumentQuestion, data: SubmissionData) => Promise<AnswerValue>;
  startAudioRecording?: (
    question: InstrumentQuestion,
    data: SubmissionData
  ) => Promise<WhoVaAudioRecordingSession>;
  pickDate?: (
    question: InstrumentQuestion,
    data: SubmissionData,
    currentValue?: string
  ) => Promise<string | undefined>;
  captureImage?: (question: InstrumentQuestion, data: SubmissionData) => Promise<AnswerValue | undefined>;
  selectImage?: (question: InstrumentQuestion, data: SubmissionData) => Promise<AnswerValue | undefined>;
  processImage?: (
    selection: AnswerValue,
    policy: ImageAttachmentPolicy,
    question: InstrumentQuestion,
    data: SubmissionData
  ) => Promise<AnswerValue>;
  selectFile?: (
    question: InstrumentQuestion,
    data: SubmissionData,
    acceptedMimeTypes: string[]
  ) => Promise<AnswerValue | undefined>;
  resolveAttachmentUri?: (attachment: AnswerValue) => Promise<string | undefined>;
  releaseAttachmentUri?: (uri: string) => void;
  removeAttachment?: (attachment: AnswerValue) => Promise<void>;
}

export interface WhoVaAudioRecordingSession {
  stop(): Promise<AnswerValue>;
  cancel(): void | Promise<void>;
}

export interface WhoVaQuestionControlProps {
  question: InstrumentQuestion;
  value: AnswerValue | undefined;
  data: SubmissionData;
  locale: string;
  messages?: WhoVaUiMessages;
  issues: ValidationIssue[];
  platform?: WhoVaPlatformServices | undefined;
  onAnswer: (value: AnswerValue | undefined) => void;
  onDraftIssue?: ((questionName: string, issue: ValidationIssue | undefined) => void) | undefined;
}

export interface WhoVaQuestionControlPrimitives {
  View: React.ElementType;
  Text: React.ElementType;
  TextInput: React.ElementType;
  DateInput?: React.ElementType | undefined;
  Pressable: React.ElementType;
  Image?: React.ElementType | undefined;
  platform?: WhoVaPlatformServices | undefined;
}

export const questionControlStyles = {
  input: withWebTheme(
    {
      borderWidth: 1,
      borderColor: "#9fb4ad",
      borderRadius: 8,
      minHeight: 44,
      paddingHorizontal: 12,
      paddingVertical: 9,
      color: "#142a24",
      backgroundColor: "#ffffff"
    },
    { borderColor: "controlBorder", borderRadius: "controlRadius", color: "ink", backgroundColor: "surface" }
  ),
  narrativeInput: { minHeight: 160, textAlignVertical: "top" as const },
  inputError: withWebTheme(
    { borderColor: "#b34231", backgroundColor: "#fff8f6" },
    { borderColor: "danger", backgroundColor: "dangerSoft" }
  ),
  choice: withWebTheme(
    {
      borderWidth: 1,
      borderColor: "#9fb4ad",
      borderRadius: 8,
      padding: 12,
      marginTop: 7,
      backgroundColor: "#ffffff"
    },
    { borderColor: "controlBorder", borderRadius: "controlRadius", backgroundColor: "surface" }
  ),
  choiceSelected: withWebTheme(
    { borderColor: "#147d64", backgroundColor: "#e3f4ee" },
    { borderColor: "brand", backgroundColor: "brandSoft" }
  ),
  choiceText: withWebTheme({ color: "#213b34" }, { color: "inkSubtle" }),
  dropdownList: { marginTop: 6 },
  hint: withWebTheme({ color: "#536b64", fontSize: 13, marginBottom: 10 }, { color: "muted" }),
  actions: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8, marginTop: 8 },
  button: withWebTheme(
    {
      minHeight: 44,
      borderRadius: 8,
      paddingHorizontal: 18,
      paddingVertical: 12,
      backgroundColor: "#147d64",
      justifyContent: "center" as const
    },
    { borderRadius: "controlRadius", backgroundColor: "brand" }
  ),
  buttonSecondary: withWebTheme({ backgroundColor: "#dce6e1" }, { backgroundColor: "border" }),
  buttonDanger: withWebTheme({ backgroundColor: "#f3ded9" }, { backgroundColor: "dangerSoft" }),
  buttonDisabled: { opacity: 0.45 },
  buttonText: withWebTheme({ color: "#ffffff", fontWeight: "700" as const }, { color: "surface" }),
  buttonTextSecondary: withWebTheme({ color: "#183d33", fontWeight: "700" as const }, { color: "brandDeep" }),
  buttonTextDanger: withWebTheme({ color: "#8c3022", fontWeight: "700" as const }, { color: "dangerStrong" }),
  imageFrame: withWebTheme(
    {
      overflow: "hidden" as const,
      minHeight: 220,
      borderRadius: 8,
      backgroundColor: "#10231e",
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginTop: 8
    },
    { borderRadius: "controlRadius", backgroundColor: "imageBackground" }
  ),
  image: { width: "100%", height: 260, resizeMode: "contain" as const },
  attachmentName: withWebTheme({ color: "#213b34", marginTop: 10 }, { color: "inkSubtle" }),
  attachmentError: withWebTheme(
    { color: "#a23a2a", fontSize: 13, fontWeight: "700" as const, marginTop: 8 },
    { color: "danger" }
  )
};

function plainText(value: string | undefined): string {
  if (!value) return "";
  return value
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

function localized(text: Record<string, string | undefined>, locale: string, fallback: string): string {
  return plainText(localizeText(text, locale, fallback));
}

function questionLabel(question: InstrumentQuestion, locale: string): string {
  return localized(question.label, locale, question.name).replace(
    /^(\([^)]+\))\s*\[([^\]]+)\](.*)$/s,
    "$1 $2$3"
  );
}

function languageChoiceLabel(choice: NonNullable<InstrumentQuestion["choices"]>[number]): string {
  const english = plainText(choice.label.en) || choice.value;
  const baseLanguage = choice.value.split("-")[0] ?? choice.value;
  const local = plainText(choice.label[choice.value] ?? choice.label[baseLanguage] ?? choice.label.en);
  return `${english} (${local || english})`;
}

export function incompleteDateIssue(
  question: InstrumentQuestion,
  draft: string | undefined,
  locale: string,
  messages: WhoVaUiMessages = ENGLISH_UI_MESSAGES
): ValidationIssue | undefined {
  if (question.control !== "date" || !draft) return undefined;
  if (question.appearance === "year") {
    return /^\d{4}$/.test(draft)
      ? undefined
      : { question: question.name, code: "type", message: messages.fourDigitYear };
  }
  return parseDisplayDate(draft, locale)
    ? undefined
    : {
        question: question.name,
        code: "type",
        message: messages.invalidDate(dateFormatPlaceholder(locale), formatDisplayDate("2026-07-17", locale))
      };
}

function attachmentDetails(value: AnswerValue | undefined): {
  uri?: string;
  name?: string;
  mimeType?: string;
} {
  if (typeof value === "string") return { uri: value, name: value.split("/").at(-1) ?? value };
  if (value == null || Array.isArray(value) || typeof value !== "object") return {};
  return {
    ...(typeof value.uri === "string" ? { uri: value.uri } : {}),
    ...(typeof value.originalName === "string"
      ? { name: value.originalName }
      : typeof value.name === "string"
        ? { name: value.name }
        : {}),
    ...(typeof value.mimeType === "string" ? { mimeType: value.mimeType } : {})
  };
}

function attachmentMimeType(value: AnswerValue | undefined): string | undefined {
  if (value == null || Array.isArray(value) || typeof value !== "object") return undefined;
  return typeof value.mimeType === "string" ? value.mimeType : undefined;
}

function attachmentErrorMessage(error: unknown, messages: WhoVaUiMessages): string {
  if (!(error instanceof AttachmentProcessingError)) return messages.attachmentProcessingFailed;
  const localized = {
    "image-input-too-large": messages.imageInputTooLarge,
    "image-type-not-allowed": messages.imageTypeNotAllowed,
    "image-dimensions-invalid": messages.imageDimensionsInvalid,
    "image-dimensions-too-large": messages.imageDimensionsTooLarge,
    "image-decode-failed": messages.imageDecodeFailed,
    "image-output-invalid": messages.imageOutputInvalid,
    "image-output-too-large": messages.imageOutputTooLarge,
    "image-processing-unavailable": messages.imageProcessingUnavailable,
    "attachment-storage-failed": messages.attachmentStorageFailed,
    "pdf-input-too-large": messages.pdfInputTooLarge,
    "pdf-type-not-allowed": messages.pdfTypeNotAllowed,
    "pdf-render-failed": messages.pdfRenderFailed,
    "pdf-too-many-pages": messages.pdfTooManyPages,
    "pdf-output-too-large": messages.pdfOutputTooLarge,
    "pdf-processing-unavailable": messages.pdfProcessingUnavailable
  } satisfies Record<typeof error.code, string>;
  return localized[error.code];
}

export function createWhoVaQuestionControls(primitives: WhoVaQuestionControlPrimitives) {
  const { View, Text: PrimitiveText, TextInput, DateInput, Pressable, Image } = primitives;

  function Text({ question, value, locale, issues, onAnswer }: WhoVaQuestionControlProps) {
    const multiline = question.appearance === "multiline";
    return (
      <TextInput
        accessibilityLabel={questionLabel(question, locale)}
        testID={`question-${question.name}`}
        style={[
          questionControlStyles.input,
          multiline && questionControlStyles.narrativeInput,
          issues.length > 0 && questionControlStyles.inputError
        ]}
        aria-invalid={issues.length > 0 || undefined}
        value={value == null ? "" : String(value)}
        multiline={multiline}
        onChangeText={(text: string) => onAnswer(text || undefined)}
      />
    );
  }

  function Integer({ question, value, locale, issues, onAnswer }: WhoVaQuestionControlProps) {
    return (
      <TextInput
        accessibilityLabel={questionLabel(question, locale)}
        testID={`question-${question.name}`}
        style={[questionControlStyles.input, issues.length > 0 && questionControlStyles.inputError]}
        aria-invalid={issues.length > 0 || undefined}
        value={value == null ? "" : String(value)}
        keyboardType="number-pad"
        onChangeText={(text: string) => {
          if (text === "") onAnswer(undefined);
          else if (/^-?\d+$/.test(text)) onAnswer(Number(text));
        }}
      />
    );
  }

  function Date({
    question,
    value,
    data,
    locale,
    messages = ENGLISH_UI_MESSAGES,
    issues,
    platform,
    onAnswer,
    onDraftIssue
  }: WhoVaQuestionControlProps) {
    const [draft, setDraft] = useState<string>();
    const [busy, setBusy] = useState(false);
    const label = questionLabel(question, locale);
    const hasIssues = issues.length > 0;
    const services = { ...primitives.platform, ...platform };

    useEffect(() => () => onDraftIssue?.(question.name, undefined), [onDraftIssue, question.name]);

    const updateDraft = (next: string | undefined) => {
      setDraft(next);
      onDraftIssue?.(question.name, incompleteDateIssue(question, next, locale, messages));
    };

    if (question.appearance === "year") {
      return (
        <TextInput
          accessibilityLabel={label}
          testID={`question-${question.name}`}
          style={[questionControlStyles.input, hasIssues && questionControlStyles.inputError]}
          aria-invalid={hasIssues || undefined}
          value={draft ?? (typeof value === "string" ? value.slice(0, 4) : "")}
          keyboardType="number-pad"
          maxLength={4}
          placeholder="YYYY"
          onChangeText={(text: string) => {
            if (!/^\d*$/.test(text)) return;
            if (text === "") {
              updateDraft(undefined);
              onAnswer(undefined);
            } else if (text.length === 4) {
              onAnswer(`${text}-01-01`);
              updateDraft(undefined);
            } else {
              updateDraft(text);
              onAnswer(undefined);
            }
          }}
        />
      );
    }

    if (DateInput) {
      return (
        <DateInput
          accessibilityLabel={label}
          testID={`question-${question.name}`}
          style={[questionControlStyles.input, hasIssues && questionControlStyles.inputError]}
          aria-invalid={hasIssues || undefined}
          value={value == null ? "" : String(value)}
          onChangeText={(text: string) => onAnswer(text || undefined)}
        />
      );
    }

    if (services?.pickDate) {
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ disabled: busy }}
          testID={`question-${question.name}`}
          style={[
            questionControlStyles.input,
            hasIssues && questionControlStyles.inputError,
            busy && questionControlStyles.buttonDisabled
          ]}
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            try {
              const selected = await services.pickDate?.(
                question,
                data,
                typeof value === "string" ? value : undefined
              );
              if (selected !== undefined) onAnswer(selected);
            } finally {
              setBusy(false);
            }
          }}
        >
          <PrimitiveText
            style={value == null ? questionControlStyles.hint : questionControlStyles.choiceText}
          >
            {busy
              ? messages.openingCalendar
              : value == null
                ? messages.selectDate
                : formatDisplayDate(String(value), locale)}
          </PrimitiveText>
        </Pressable>
      );
    }

    return (
      <TextInput
        accessibilityLabel={label}
        testID={`question-${question.name}`}
        style={[questionControlStyles.input, hasIssues && questionControlStyles.inputError]}
        aria-invalid={hasIssues || undefined}
        value={draft ?? (value == null ? "" : formatDisplayDate(String(value), locale))}
        placeholder={dateFormatPlaceholder(locale)}
        onChangeText={(text: string) => {
          if (text === "") {
            updateDraft(undefined);
            onAnswer(undefined);
            return;
          }
          const parsed = parseDisplayDate(text, locale);
          if (parsed) {
            onAnswer(parsed);
            updateDraft(undefined);
          } else {
            updateDraft(text);
            onAnswer(undefined);
          }
        }}
      />
    );
  }

  function SearchableSingleChoice({ question, value, locale, issues, onAnswer }: WhoVaQuestionControlProps) {
    const selectedChoice = question.choices?.find((choice) => choice.value === value);
    const [query, setQuery] = useState("");
    const searchText = query.trim().toLocaleLowerCase(locale);
    const choices = (question.choices ?? []).filter((choice) => {
      if (!searchText) return true;
      const label = languageChoiceLabel(choice).toLocaleLowerCase(locale);
      return choice.value.toLocaleLowerCase(locale).includes(searchText) || label.includes(searchText);
    });
    return (
      <>
        <TextInput
          accessibilityLabel={questionLabel(question, locale)}
          accessibilityRole="combobox"
          testID={`question-${question.name}`}
          style={[questionControlStyles.input, issues.length > 0 && questionControlStyles.inputError]}
          aria-invalid={issues.length > 0 || undefined}
          value={query || (selectedChoice ? languageChoiceLabel(selectedChoice) : "")}
          placeholder="Search language"
          onChangeText={(text: string) => setQuery(text)}
        />
        <View style={questionControlStyles.dropdownList}>
          {choices.map((choice) => {
            const selected = value === choice.value;
            return (
              <Pressable
                key={choice.value}
                accessibilityRole="option"
                accessibilityState={{ selected }}
                testID={`question-${question.name}-choice-${choice.value}`}
                style={[questionControlStyles.choice, selected && questionControlStyles.choiceSelected]}
                onPress={() => {
                  onAnswer(choice.value);
                  setQuery("");
                }}
              >
                <PrimitiveText style={questionControlStyles.choiceText}>
                  {languageChoiceLabel(choice)}
                </PrimitiveText>
              </Pressable>
            );
          })}
        </View>
      </>
    );
  }

  function SingleChoice(props: WhoVaQuestionControlProps) {
    const { question, value, locale, onAnswer } = props;
    if (question.name === "language") return <SearchableSingleChoice {...props} />;
    return (question.choices ?? []).map((choice) => {
      const selected = value === choice.value;
      return (
        <Pressable
          key={choice.value}
          accessibilityRole="radio"
          accessibilityState={{ selected }}
          testID={`question-${question.name}-choice-${choice.value}`}
          style={[questionControlStyles.choice, selected && questionControlStyles.choiceSelected]}
          onPress={() => onAnswer(choice.value)}
        >
          <PrimitiveText style={questionControlStyles.choiceText}>
            {localized(choice.label, locale, choice.value)}
          </PrimitiveText>
        </Pressable>
      );
    });
  }

  function MultipleChoice({ question, value, locale, onAnswer }: WhoVaQuestionControlProps) {
    const selectedValues = Array.isArray(value) ? value : [];
    return (question.choices ?? []).map((choice) => {
      const selected = selectedValues.includes(choice.value);
      return (
        <Pressable
          key={choice.value}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selected }}
          testID={`question-${question.name}-choice-${choice.value}`}
          style={[questionControlStyles.choice, selected && questionControlStyles.choiceSelected]}
          onPress={() =>
            onAnswer(
              selected
                ? selectedValues.filter((item) => item !== choice.value)
                : [...selectedValues, choice.value]
            )
          }
        >
          <PrimitiveText style={questionControlStyles.choiceText}>
            {localized(choice.label, locale, choice.value)}
          </PrimitiveText>
        </Pressable>
      );
    });
  }

  function Confirm({ question, value, messages = ENGLISH_UI_MESSAGES, onAnswer }: WhoVaQuestionControlProps) {
    return (
      <Pressable
        accessibilityRole="button"
        testID={`question-${question.name}`}
        style={[questionControlStyles.button, value === true && questionControlStyles.choiceSelected]}
        onPress={() => onAnswer(true)}
      >
        <PrimitiveText style={questionControlStyles.buttonText}>
          {value === true ? messages.confirmed : messages.confirm}
        </PrimitiveText>
      </Pressable>
    );
  }

  function Audio({
    question,
    value,
    data,
    platform,
    messages = ENGLISH_UI_MESSAGES,
    onAnswer
  }: WhoVaQuestionControlProps) {
    const [phase, setPhase] = useState<"idle" | "starting" | "recording" | "stopping">("idle");
    const [recordingError, setRecordingError] = useState<string>();
    const session = useRef<WhoVaAudioRecordingSession | undefined>(undefined);
    const services = { ...primitives.platform, ...platform };
    const disabled =
      phase === "starting" ||
      phase === "stopping" ||
      (phase === "idle" && !services.startAudioRecording && !services.captureAudio);

    useEffect(
      () => () => {
        if (session.current) void session.current.cancel();
      },
      []
    );

    const label =
      phase === "starting"
        ? messages.startingMicrophone
        : phase === "recording"
          ? messages.stopAndSaveRecording
          : phase === "stopping"
            ? messages.savingRecording
            : value
              ? messages.replaceAudio
              : messages.recordAudio;

    return (
      <View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled, busy: phase === "starting" || phase === "stopping" }}
          testID={`question-${question.name}`}
          style={[questionControlStyles.button, disabled && questionControlStyles.buttonDisabled]}
          disabled={disabled}
          onPress={async () => {
            setRecordingError(undefined);
            try {
              if (phase === "recording" && session.current) {
                setPhase("stopping");
                const recorded = await session.current.stop();
                session.current = undefined;
                if (value !== undefined) await services.removeAttachment?.(value);
                onAnswer(recorded);
                setPhase("idle");
                return;
              }
              if (services.startAudioRecording) {
                setPhase("starting");
                session.current = await services.startAudioRecording(question, data);
                setPhase("recording");
                return;
              }
              if (!services.captureAudio) return;
              setPhase("starting");
              const recorded = await services.captureAudio(question, data);
              if (value !== undefined) await services.removeAttachment?.(value);
              onAnswer(recorded);
              setPhase("idle");
            } catch (error) {
              session.current = undefined;
              setPhase("idle");
              setRecordingError(
                typeof DOMException !== "undefined" &&
                  error instanceof DOMException &&
                  error.name === "NotAllowedError"
                  ? messages.microphonePermissionDenied
                  : messages.audioRecordingFailed
              );
            }
          }}
        >
          <PrimitiveText style={questionControlStyles.buttonText}>{label}</PrimitiveText>
        </Pressable>
        {recordingError ? (
          <PrimitiveText accessibilityRole="alert" style={questionControlStyles.attachmentError}>
            {recordingError}
          </PrimitiveText>
        ) : null}
      </View>
    );
  }

  function ImagePicker({
    question,
    value,
    data,
    platform,
    messages = ENGLISH_UI_MESSAGES,
    onAnswer
  }: WhoVaQuestionControlProps) {
    const attachment = attachmentDetails(value);
    const [busy, setBusy] = useState<"camera" | "library">();
    const [rotation, setRotation] = useState(0);
    const [zoom, setZoom] = useState(1);
    const [visible, setVisible] = useState(true);
    const [previewUri, setPreviewUri] = useState<string | undefined>(() => attachment.uri);
    const [processingError, setProcessingError] = useState<string>();
    const services = { ...primitives.platform, ...platform };
    const resolveAttachmentUri = services.resolveAttachmentUri;
    const releaseAttachmentUri = services.releaseAttachmentUri;

    useEffect(() => {
      let active = true;
      let resolvedUri: string | undefined;
      const attachmentValue = value;
      if (!attachment.uri) {
        setPreviewUri(undefined);
        return () => {
          active = false;
        };
      }
      if (
        !resolveAttachmentUri ||
        attachmentValue === undefined ||
        typeof attachmentValue === "string" ||
        !attachment.uri.startsWith("who-va-attachment:")
      ) {
        setPreviewUri(attachment.uri);
        return () => {
          active = false;
        };
      }
      setPreviewUri(undefined);
      void resolveAttachmentUri(attachmentValue)
        .then((uri) => {
          resolvedUri = uri;
          if (active) setPreviewUri(uri);
        })
        .catch(() => {
          if (active) setProcessingError(messages.savedImageLoadFailed);
        });
      return () => {
        active = false;
        if (resolvedUri) releaseAttachmentUri?.(resolvedUri);
      };
    }, [attachment.uri, messages.savedImageLoadFailed, releaseAttachmentUri, resolveAttachmentUri, value]);

    const choose = async (source: "camera" | "library") => {
      const picker = source === "camera" ? services?.captureImage : services?.selectImage;
      if (!picker) return;
      setBusy(source);
      setProcessingError(undefined);
      try {
        const candidate = await picker(question, data);
        let selected = candidate;
        if (candidate !== undefined && !isProcessedImageAttachment(candidate)) {
          if (!services.processImage) throw new AttachmentProcessingError("image-processing-unavailable");
          selected = await services.processImage(candidate, WHO_VA_ATTACHMENT_POLICY.image, question, data);
        }
        if (selected !== undefined) {
          if (!isProcessedImageAttachment(selected))
            throw new AttachmentProcessingError("image-output-invalid");
          if (value !== undefined) await services.removeAttachment?.(value);
          onAnswer(selected);
          setRotation(0);
          setZoom(1);
          setVisible(true);
        }
      } catch (error) {
        setProcessingError(attachmentErrorMessage(error, messages));
      } finally {
        setBusy(undefined);
      }
    };

    return (
      <>
        {previewUri && visible && Image ? (
          <View style={questionControlStyles.imageFrame}>
            <Image
              accessibilityLabel={attachment.name ?? messages.selectedImage}
              testID={`question-${question.name}-preview`}
              source={{ uri: previewUri }}
              style={[
                questionControlStyles.image,
                { transform: [{ rotate: `${rotation}deg` }, { scale: zoom }] }
              ]}
            />
          </View>
        ) : null}
        {attachment.name ? (
          <PrimitiveText style={questionControlStyles.attachmentName}>{attachment.name}</PrimitiveText>
        ) : null}
        {processingError ? (
          <PrimitiveText accessibilityRole="alert" style={questionControlStyles.attachmentError}>
            {processingError}
          </PrimitiveText>
        ) : null}
        <View style={questionControlStyles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={!services?.captureImage || busy != null}
            style={[
              questionControlStyles.button,
              (!services?.captureImage || busy != null) && questionControlStyles.buttonDisabled
            ]}
            onPress={() => void choose("camera")}
          >
            <PrimitiveText style={questionControlStyles.buttonText}>
              {busy === "camera" ? messages.openingCamera : messages.camera}
            </PrimitiveText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={!services?.selectImage || busy != null}
            style={[
              questionControlStyles.button,
              questionControlStyles.buttonSecondary,
              (!services?.selectImage || busy != null) && questionControlStyles.buttonDisabled
            ]}
            onPress={() => void choose("library")}
          >
            <PrimitiveText style={questionControlStyles.buttonTextSecondary}>
              {busy === "library"
                ? messages.openingImages
                : attachment.uri
                  ? messages.replaceImage
                  : messages.chooseImage}
            </PrimitiveText>
          </Pressable>
          {attachment.uri ? (
            <>
              <Pressable
                accessibilityRole="button"
                style={[questionControlStyles.button, questionControlStyles.buttonSecondary]}
                onPress={() => setVisible((current) => !current)}
              >
                <PrimitiveText style={questionControlStyles.buttonTextSecondary}>
                  {visible ? messages.hideImage : messages.viewImage}
                </PrimitiveText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={[questionControlStyles.button, questionControlStyles.buttonSecondary]}
                onPress={() => setRotation((current) => (current + 90) % 360)}
              >
                <PrimitiveText style={questionControlStyles.buttonTextSecondary}>
                  {messages.rotate}
                </PrimitiveText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={[questionControlStyles.button, questionControlStyles.buttonSecondary]}
                onPress={() => setZoom((current) => Math.min(3, current + 0.25))}
              >
                <PrimitiveText style={questionControlStyles.buttonTextSecondary}>
                  {messages.zoomIn}
                </PrimitiveText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={[questionControlStyles.button, questionControlStyles.buttonSecondary]}
                onPress={() => setZoom((current) => Math.max(0.5, current - 0.25))}
              >
                <PrimitiveText style={questionControlStyles.buttonTextSecondary}>
                  {messages.zoomOut}
                </PrimitiveText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={[questionControlStyles.button, questionControlStyles.buttonDanger]}
                onPress={() => {
                  if (value !== undefined) void services.removeAttachment?.(value);
                  onAnswer(undefined);
                }}
              >
                <PrimitiveText style={questionControlStyles.buttonTextDanger}>
                  {messages.removeImage}
                </PrimitiveText>
              </Pressable>
            </>
          ) : null}
        </View>
      </>
    );
  }

  function FilePicker({
    question,
    value,
    data,
    platform,
    messages = ENGLISH_UI_MESSAGES,
    onAnswer
  }: WhoVaQuestionControlProps) {
    const [busy, setBusy] = useState(false);
    const [processingError, setProcessingError] = useState<string>();
    const attachment = attachmentDetails(value);
    const services = { ...primitives.platform, ...platform };
    const acceptsImages = question.appearance === "image-or-pdf";
    const acceptedMimeTypes = acceptsImages
      ? [
          ...WHO_VA_ATTACHMENT_POLICY.image.acceptedMimeTypes,
          ...WHO_VA_ATTACHMENT_POLICY.pdf.acceptedMimeTypes
        ]
      : [...WHO_VA_ATTACHMENT_POLICY.pdf.acceptedMimeTypes];
    const attachmentLabel = acceptsImages ? messages.attachment : messages.pdf;
    return (
      <>
        {attachment.name ? (
          <PrimitiveText style={questionControlStyles.attachmentName}>{attachment.name}</PrimitiveText>
        ) : null}
        <View style={questionControlStyles.actions}>
          <Pressable
            accessibilityRole="button"
            testID={`question-${question.name}`}
            disabled={!services?.selectFile || busy}
            style={[
              questionControlStyles.button,
              (!services?.selectFile || busy) && questionControlStyles.buttonDisabled
            ]}
            onPress={async () => {
              if (!services?.selectFile) return;
              setBusy(true);
              setProcessingError(undefined);
              try {
                const candidate = await services.selectFile(question, data, acceptedMimeTypes);
                let selected = candidate;
                if (
                  candidate !== undefined &&
                  !isRetainedPdfAttachment(candidate) &&
                  !(acceptsImages && isProcessedImageAttachment(candidate))
                ) {
                  if (
                    acceptsImages &&
                    WHO_VA_ATTACHMENT_POLICY.image.acceptedMimeTypes.includes(
                      attachmentMimeType(candidate) as "image/jpeg" | "image/png"
                    )
                  ) {
                    if (!services.processImage)
                      throw new AttachmentProcessingError("image-processing-unavailable");
                    selected = await services.processImage(
                      candidate,
                      WHO_VA_ATTACHMENT_POLICY.image,
                      question,
                      data
                    );
                  } else {
                    throw new AttachmentProcessingError("pdf-processing-unavailable");
                  }
                }
                if (selected !== undefined) {
                  if (
                    !isRetainedPdfAttachment(selected) &&
                    !(acceptsImages && isProcessedImageAttachment(selected))
                  ) {
                    throw new AttachmentProcessingError(
                      acceptsImages ? "image-output-invalid" : "pdf-render-failed"
                    );
                  }
                  if (value !== undefined) await services.removeAttachment?.(value);
                  onAnswer(selected);
                }
              } catch (error) {
                setProcessingError(attachmentErrorMessage(error, messages));
              } finally {
                setBusy(false);
              }
            }}
          >
            <PrimitiveText style={questionControlStyles.buttonText}>
              {busy
                ? messages.openingFiles
                : attachment.uri
                  ? messages.replaceAttachment(attachmentLabel)
                  : messages.chooseAttachment(attachmentLabel)}
            </PrimitiveText>
          </Pressable>
          {processingError ? (
            <PrimitiveText accessibilityRole="alert" style={questionControlStyles.attachmentError}>
              {processingError}
            </PrimitiveText>
          ) : null}
          {attachment.uri ? (
            <Pressable
              accessibilityRole="button"
              style={[questionControlStyles.button, questionControlStyles.buttonDanger]}
              onPress={() => {
                if (value !== undefined) void services.removeAttachment?.(value);
                onAnswer(undefined);
              }}
            >
              <PrimitiveText style={questionControlStyles.buttonTextDanger}>
                {messages.removeAttachment(attachmentLabel)}
              </PrimitiveText>
            </Pressable>
          ) : null}
        </View>
      </>
    );
  }

  function Note(_props: WhoVaQuestionControlProps) {
    return null;
  }
  function Empty(_props: WhoVaQuestionControlProps) {
    return null;
  }

  function Control(props: WhoVaQuestionControlProps) {
    switch (props.question.control) {
      case "text":
        return <Text {...props} />;
      case "integer":
        return <Integer {...props} />;
      case "date":
        return <Date {...props} />;
      case "singleChoice":
        return <SingleChoice {...props} />;
      case "multipleChoice":
        return <MultipleChoice {...props} />;
      case "confirm":
        return <Confirm {...props} />;
      case "audio":
        return <Audio {...props} />;
      case "image":
        return <ImagePicker {...props} />;
      case "file":
        return <FilePicker {...props} />;
      case "note":
        return <Note {...props} />;
      case "calculated":
      case "system":
        return <Empty {...props} />;
    }
  }

  return {
    Control,
    Text,
    Integer,
    Date,
    SingleChoice,
    MultipleChoice,
    Confirm,
    Audio,
    Image: ImagePicker,
    File: FilePicker,
    Note,
    Calculated: Empty,
    System: Empty
  };
}

export type WhoVaQuestionControls = ReturnType<typeof createWhoVaQuestionControls>;
