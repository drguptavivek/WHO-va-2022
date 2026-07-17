import React, { useEffect, useState } from "react";

import type {
  AnswerValue,
  InstrumentDefinition,
  InstrumentQuestion,
  SessionSnapshot,
  SubmissionData,
  SubmissionValidationResult,
  ValidationIssue,
  WhoVaSession
} from "../types.js";
import { createWhoVaSession } from "../engine/session.js";
import { whoVa2022Instrument } from "../instrument.js";
import { dateFormatPlaceholder, formatDisplayDate, parseDisplayDate } from "./date-value.js";

export interface WhoVaPlatformServices {
  captureAudio?: (question: InstrumentQuestion, data: SubmissionData) => Promise<AnswerValue>;
  pickDate?: (
    question: InstrumentQuestion,
    data: SubmissionData,
    currentValue?: string
  ) => Promise<string | undefined>;
}

export interface WhoVaFormProps {
  instrument?: InstrumentDefinition;
  session?: WhoVaSession;
  initialData?: SubmissionData;
  locale?: string;
  showSourceGuidance?: boolean;
  platform?: WhoVaPlatformServices;
  onReady?: (session: WhoVaSession) => void;
  onChange?: (data: SubmissionData, snapshot: SessionSnapshot) => void;
  onValidation?: (issues: ValidationIssue[]) => void;
  onComplete?: (result: SubmissionValidationResult) => void;
}

export interface WhoVaPrimitiveSet {
  View: React.ElementType;
  Text: React.ElementType;
  TextInput: React.ElementType;
  DateInput?: React.ElementType;
  Pressable: React.ElementType;
  ScrollView: React.ElementType;
}

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
  return plainText(text[locale] ?? text.en ?? fallback);
}

function interviewerQuestionLabel(value: string): string {
  return value.replace(/^(\([^)]+\))\s*\[([^\]]+)\](.*)$/s, "$1 $2$3");
}

function incompleteDateIssue(question: InstrumentQuestion, draft: string | undefined, locale: string): ValidationIssue | undefined {
  if (question.control !== "date" || !draft) return undefined;
  if (question.appearance === "year") {
    return /^\d{4}$/.test(draft)
      ? undefined
      : { question: question.name, code: "type", message: "Enter a four-digit year, for example 2026" };
  }
  return parseDisplayDate(draft, locale)
    ? undefined
    : {
        question: question.name,
        code: "type",
        message: `Enter the date as ${dateFormatPlaceholder(locale)}, for example ${formatDisplayDate("2026-07-17", locale)}`
      };
}

const styles = {
  root: { flex: 1, backgroundColor: "#f6f8f7" },
  content: { padding: 20, maxWidth: 760, width: "100%", alignSelf: "center" as const },
  progress: { color: "#47625b", marginBottom: 6, fontSize: 13 },
  sectionTitle: { color: "#12372d", fontSize: 24, fontWeight: "700" as const, marginBottom: 18 },
  question: { backgroundColor: "#ffffff", borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#dce6e1" },
  questionError: { borderColor: "#d66552" },
  label: { color: "#142a24", fontSize: 16, fontWeight: "600" as const, marginBottom: 8 },
  required: { color: "#a23a2a" },
  hint: { color: "#536b64", fontSize: 13, marginBottom: 10 },
  guidance: { color: "#315e73", fontSize: 13, marginBottom: 10 },
  input: { borderWidth: 1, borderColor: "#9fb4ad", borderRadius: 8, minHeight: 44, paddingHorizontal: 12, paddingVertical: 9, color: "#142a24", backgroundColor: "#ffffff" },
  inputError: { borderColor: "#b34231", backgroundColor: "#fff8f6" },
  choice: { borderWidth: 1, borderColor: "#9fb4ad", borderRadius: 8, padding: 12, marginTop: 7, backgroundColor: "#ffffff" },
  choiceSelected: { borderColor: "#147d64", backgroundColor: "#e3f4ee" },
  choiceText: { color: "#213b34" },
  note: { backgroundColor: "#edf5f2", borderLeftWidth: 4, borderLeftColor: "#147d64" },
  error: { color: "#a23a2a", marginTop: 8, fontSize: 13 },
  navigation: { flexDirection: "row" as const, justifyContent: "space-between" as const, gap: 12, marginTop: 12, marginBottom: 24 },
  button: { minHeight: 44, borderRadius: 8, paddingHorizontal: 18, paddingVertical: 12, backgroundColor: "#147d64", justifyContent: "center" as const },
  buttonSecondary: { backgroundColor: "#dce6e1" },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: "#ffffff", fontWeight: "700" as const },
  buttonTextSecondary: { color: "#183d33", fontWeight: "700" as const }
};

export function createWhoVaForm(primitives: WhoVaPrimitiveSet): React.ComponentType<WhoVaFormProps> {
  const { View, Text, TextInput, DateInput, Pressable, ScrollView } = primitives;

  function Form(props: WhoVaFormProps) {
    const locale = props.locale ?? "en";
    const [session] = useState(() => props.session ?? createWhoVaSession(
      props.instrument ?? whoVa2022Instrument,
      props.initialData ? { initialData: props.initialData } : {}
    ));
    const [snapshot, setSnapshot] = useState(() => session.getSnapshot());
    const [busyQuestion, setBusyQuestion] = useState<string>();
    const [dateDrafts, setDateDrafts] = useState<Record<string, string>>({});

    useEffect(() => {
      props.onReady?.(session);
      return session.subscribe((next) => {
        setSnapshot(next);
        props.onChange?.(next.data, next);
      });
    }, [session, props.onReady, props.onChange]);

    const answer = (question: InstrumentQuestion, value: AnswerValue | undefined) => {
      session.setAnswer(question.name, value);
    };

    const renderQuestion = (question: InstrumentQuestion) => {
      const value = snapshot.data[question.name];
      const dateDraft = dateDrafts[question.name];
      const dateDraftIssue = incompleteDateIssue(question, dateDraft, locale);
      const sessionIssues = snapshot.issues.filter((issue) => issue.question === question.name && !(dateDraftIssue && issue.code === "required"));
      const issues = dateDraftIssue ? [...sessionIssues, dateDraftIssue] : sessionIssues;
      const label = interviewerQuestionLabel(localized(question.label, locale, question.name));
      const hint = localized(question.hint, locale, "");
      const guidance = localized(question.guidance, locale, "");
      const hasIssues = issues.length > 0;

      let control: React.ReactNode = null;
      if (question.control === "note") {
        control = null;
      } else if (question.control === "date" && question.appearance === "year") {
        control = (
          <TextInput
            accessibilityLabel={label}
            testID={`question-${question.name}`}
            style={[styles.input, hasIssues && styles.inputError]}
            aria-invalid={hasIssues || undefined}
            value={dateDraft ?? (typeof value === "string" ? value.slice(0, 4) : "")}
            keyboardType="number-pad"
            maxLength={4}
            placeholder="YYYY"
            onChangeText={(text: string) => {
              if (!/^\d*$/.test(text)) return;
              if (text === "") {
                setDateDrafts((drafts) => {
                  const next = { ...drafts };
                  delete next[question.name];
                  return next;
                });
                answer(question, undefined);
              } else if (text.length === 4) {
                answer(question, `${text}-01-01`);
                setDateDrafts((drafts) => {
                  const next = { ...drafts };
                  delete next[question.name];
                  return next;
                });
              } else {
                setDateDrafts((drafts) => ({ ...drafts, [question.name]: text }));
                answer(question, undefined);
              }
            }}
          />
        );
      } else if (question.control === "date" && DateInput) {
        control = (
          <DateInput
            accessibilityLabel={label}
            testID={`question-${question.name}`}
            style={[styles.input, hasIssues && styles.inputError]}
            aria-invalid={hasIssues || undefined}
            value={value == null ? "" : String(value)}
            onChangeText={(text: string) => answer(question, text || undefined)}
          />
        );
      } else if (question.control === "date" && props.platform?.pickDate) {
        control = (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ disabled: busyQuestion === question.name }}
            testID={`question-${question.name}`}
            style={[styles.input, hasIssues && styles.inputError, busyQuestion === question.name && styles.buttonDisabled]}
            disabled={busyQuestion === question.name}
            onPress={async () => {
              if (!props.platform?.pickDate) return;
              setBusyQuestion(question.name);
              try {
                const selected = await props.platform.pickDate(
                  question,
                  snapshot.data,
                  typeof value === "string" ? value : undefined
                );
                if (selected !== undefined) answer(question, selected);
              } finally {
                setBusyQuestion(undefined);
              }
            }}
          >
            <Text style={value == null ? styles.hint : styles.choiceText}>
              {busyQuestion === question.name ? "Opening calendar…" : value == null ? "Select date" : formatDisplayDate(String(value), locale)}
            </Text>
          </Pressable>
        );
      } else if (question.control === "text" || question.control === "date" || question.control === "integer") {
        control = (
          <TextInput
            accessibilityLabel={label}
            testID={`question-${question.name}`}
            style={[styles.input, hasIssues && styles.inputError]}
            aria-invalid={hasIssues || undefined}
            value={question.control === "date"
              ? dateDraft ?? (value == null ? "" : formatDisplayDate(String(value), locale))
              : value == null ? "" : String(value)}
            multiline={question.control === "text" && question.appearance === "multiline"}
            keyboardType={question.control === "integer" ? "number-pad" : "default"}
            placeholder={question.control === "date" ? dateFormatPlaceholder(locale) : undefined}
            onChangeText={(text: string) => {
              if (question.control === "integer") {
                if (text === "") answer(question, undefined);
                else if (/^-?\d+$/.test(text)) answer(question, Number(text));
              } else if (question.control === "date") {
                if (text === "") {
                  setDateDrafts((drafts) => {
                    const next = { ...drafts };
                    delete next[question.name];
                    return next;
                  });
                  answer(question, undefined);
                } else {
                  setDateDrafts((drafts) => ({ ...drafts, [question.name]: text }));
                  const parsed = parseDisplayDate(text, locale);
                  if (parsed) {
                    answer(question, parsed);
                    setDateDrafts((drafts) => {
                      const next = { ...drafts };
                      delete next[question.name];
                      return next;
                    });
                  } else answer(question, undefined);
                }
              } else answer(question, text || undefined);
            }}
          />
        );
      } else if (question.control === "singleChoice") {
        control = (question.choices ?? []).map((choice) => {
          const selected = value === choice.value;
          return (
            <Pressable
              key={choice.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              testID={`question-${question.name}-choice-${choice.value}`}
              style={[styles.choice, selected && styles.choiceSelected]}
              onPress={() => answer(question, choice.value)}
            >
              <Text style={styles.choiceText}>{localized(choice.label, locale, choice.value)}</Text>
            </Pressable>
          );
        });
      } else if (question.control === "multipleChoice") {
        const selectedValues = Array.isArray(value) ? value : [];
        control = (question.choices ?? []).map((choice) => {
          const selected = selectedValues.includes(choice.value);
          return (
            <Pressable
              key={choice.value}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              testID={`question-${question.name}-choice-${choice.value}`}
              style={[styles.choice, selected && styles.choiceSelected]}
              onPress={() => answer(question, selected ? selectedValues.filter((item) => item !== choice.value) : [...selectedValues, choice.value])}
            >
              <Text style={styles.choiceText}>{localized(choice.label, locale, choice.value)}</Text>
            </Pressable>
          );
        });
      } else if (question.control === "confirm") {
        control = (
          <Pressable style={[styles.button, value === true && styles.choiceSelected]} onPress={() => answer(question, true)}>
            <Text style={styles.buttonText}>{value === true ? "Confirmed" : "Confirm"}</Text>
          </Pressable>
        );
      } else if (question.control === "audio") {
        control = (
          <Pressable
            style={[styles.button, (!props.platform?.captureAudio || busyQuestion === question.name) && styles.buttonDisabled]}
            disabled={!props.platform?.captureAudio || busyQuestion === question.name}
            onPress={async () => {
              if (!props.platform?.captureAudio) return;
              setBusyQuestion(question.name);
              try { answer(question, await props.platform.captureAudio(question, snapshot.data)); }
              finally { setBusyQuestion(undefined); }
            }}
          >
            <Text style={styles.buttonText}>{busyQuestion === question.name ? "Recording…" : value ? "Replace audio" : "Record audio"}</Text>
          </Pressable>
        );
      }

      return (
        <View key={question.name} style={[styles.question, question.control === "note" && styles.note, hasIssues && styles.questionError]} testID={`question-card-${question.name}`}>
          <Text style={styles.label}>{label}{question.required && question.control !== "note" ? <Text style={styles.required}> *</Text> : null}</Text>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
          {props.showSourceGuidance && guidance ? <Text style={styles.guidance}>{guidance}</Text> : null}
          {control}
          {issues.map((issue) => (
            <Text
              key={`${issue.code}-${issue.message}`}
              style={styles.error}
              accessibilityLiveRegion="polite"
              role="alert"
            >
              {issue.message}
            </Text>
          ))}
        </View>
      );
    };

    const advance = () => {
      const incompleteDates = Object.entries(dateDrafts).flatMap(([name, draft]) => {
        const question = snapshot.questions.find((item) => item.name === name);
        if (!question) return [];
        const issue = incompleteDateIssue(question, draft, locale);
        return issue ? [issue] : [];
      });
      if (incompleteDates.length) {
        props.onValidation?.(incompleteDates);
        return;
      }
      const result = session.next();
      if (result.issues.length) props.onValidation?.(result.issues);
      if (result.completed) props.onComplete?.(session.validate());
    };

    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.progress}>Section {snapshot.currentSectionIndex + 1} of {snapshot.visibleSectionCount}</Text>
        <Text style={styles.sectionTitle}>{localized(snapshot.currentSection.label, locale, snapshot.currentSection.name)}</Text>
        {snapshot.questions.map(renderQuestion)}
        <View style={styles.navigation}>
          <Pressable
            accessibilityRole="button"
            disabled={!snapshot.canGoBack}
            style={[styles.button, styles.buttonSecondary, !snapshot.canGoBack && styles.buttonDisabled]}
            onPress={() => session.previous()}
          >
            <Text style={styles.buttonTextSecondary}>Back</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={styles.button} onPress={advance}>
            <Text style={styles.buttonText}>{snapshot.canGoForward ? "Next" : "Complete"}</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  Form.displayName = "WhoVaForm";
  return Form;
}
