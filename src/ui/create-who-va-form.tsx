/**
 * Factory for the shared questionnaire form, coordinating session state,
 * validation, navigation, draft persistence, and platform question controls.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";

import type {
  AnswerValue,
  InstrumentDefinition,
  InstrumentQuestion,
  SessionSnapshot,
  SubmissionData,
  SubmissionValidationResult,
  ValidationIssue,
  WhoVaDraft,
  WhoVaDraftStore,
  WhoVaSession
} from "../types.js";
import { createDraftId } from "../draft.js";
import { createWhoVaSession } from "../engine/session.js";
import { isQuestionRelevant } from "../engine/validation.js";
import { whoVa2022Instrument } from "../instrument.js";
import { localeFromLanguageName, localizeText, resolveUiMessages, type WhoVaUiTranslations } from "../i18n.js";
import {
  createWhoVaQuestionControls,
  questionControlStyles,
  type WhoVaPlatformServices
} from "./question-controls.js";

export type { WhoVaPlatformServices } from "./question-controls.js";

export interface WhoVaFormProps {
  instrument?: InstrumentDefinition;
  session?: WhoVaSession;
  initialData?: SubmissionData;
  locale?: string;
  uiTranslations?: WhoVaUiTranslations;
  showSourceGuidance?: boolean;
  platform?: WhoVaPlatformServices;
  draftId?: string;
  draftStore?: WhoVaDraftStore;
  onReady?: (session: WhoVaSession) => void;
  onChange?: (data: SubmissionData, snapshot: SessionSnapshot) => void;
  onValidation?: (issues: ValidationIssue[]) => void;
  onDraftSaved?: (draft: WhoVaDraft) => void;
  onDraftError?: (error: Error) => void;
  onComplete?: (result: SubmissionValidationResult) => void;
}

export interface WhoVaPrimitiveSet {
  View: React.ElementType;
  Text: React.ElementType;
  TextInput: React.ElementType;
  DateInput?: React.ElementType;
  Pressable: React.ElementType;
  ScrollView: React.ElementType;
  Image?: React.ElementType;
  platform?: WhoVaPlatformServices;
  draftStore?: WhoVaDraftStore;
  navigation?: WhoVaNavigationAdapter;
  scrollToQuestion?: (questionNode: unknown, scrollViewNode: unknown, y: number) => void;
}

type FormView = "form" | "preview";

export interface WhoVaNavigationState {
  instrumentId: string;
  draftId: string;
  currentSection: string;
  view: FormView;
  data: SubmissionData;
}

export interface WhoVaNavigationAdapter {
  read(): WhoVaNavigationState | undefined;
  replace(state: WhoVaNavigationState): void;
  push(state: WhoVaNavigationState): void;
  back(): void;
  subscribe(listener: (state: WhoVaNavigationState | undefined) => void): () => void;
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
  return plainText(localizeText(text, locale, fallback));
}

function interpolateSubmissionReferences(value: string, data: SubmissionData): string {
  return value.replace(/\$\{([^}]+)\}/g, (_match, name: string) => {
    const answer = data[name];
    if (answer == null) return "";
    return Array.isArray(answer) ? answer.join(" ") : String(answer);
  });
}

function interviewerQuestionLabel(value: string): string {
  return value.replace(/^(\([^)]+\))\s*\[([^\]]+)\](.*)$/s, "$1 $2$3");
}

function hasAnswer(value: AnswerValue | undefined): value is AnswerValue {
  return value != null && value !== "" && (!Array.isArray(value) || value.length > 0);
}

function previewAnswer(question: InstrumentQuestion, value: AnswerValue, locale: string): string {
  const choiceLabel = (choiceValue: string) => {
    const choice = question.choices?.find((candidate) => candidate.value === choiceValue);
    return choice ? localized(choice.label, locale, choiceValue) : choiceValue;
  };
  if (Array.isArray(value)) return value.map(choiceLabel).join(", ");
  if (typeof value === "string") return choiceLabel(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (value == null) return "Recorded";
  for (const property of ["name", "originalName", "fileName", "uri"] as const) {
    const candidate = value[property];
    if (typeof candidate === "string" && candidate) return candidate;
  }
  return "Recorded";
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
  note: { backgroundColor: "#edf5f2", borderLeftWidth: 4, borderLeftColor: "#147d64" },
  error: { color: "#a23a2a", marginTop: 8, fontSize: 13 },
  navigation: { flexDirection: "row" as const, flexWrap: "wrap" as const, justifyContent: "space-between" as const, gap: 12, marginTop: 12, marginBottom: 12 },
  draftStatus: { color: "#536b64", fontSize: 12, marginTop: 4, marginBottom: 24 },
  previewIntro: { color: "#536b64", fontSize: 14, marginBottom: 18 },
  previewAnswer: { color: "#142a24", fontSize: 16 },
  previewEmpty: { color: "#536b64", fontSize: 15, paddingVertical: 16 }
};

export function createWhoVaForm(primitives: WhoVaPrimitiveSet): React.ComponentType<WhoVaFormProps> {
  const { View, Text, Pressable, ScrollView } = primitives;
  const questionControls = createWhoVaQuestionControls({
    View,
    Text,
    TextInput: primitives.TextInput,
    DateInput: primitives.DateInput,
    Pressable,
    Image: primitives.Image,
    platform: primitives.platform
  });

  function Form(props: WhoVaFormProps) {
    const instrument = props.instrument ?? whoVa2022Instrument;
    const locale = props.locale ?? localeFromLanguageName(instrument.defaultLanguage) ?? "en";
    const messages = resolveUiMessages(locale, props.uiTranslations);
    const [restoredNavigation] = useState(() => {
      const restored = primitives.navigation?.read();
      return restored?.instrumentId === instrument.id ? restored : undefined;
    });
    const [session] = useState(() => {
      if (props.session) {
        if (restoredNavigation) {
          props.session.replaceData(restoredNavigation.data);
          props.session.goToSection(restoredNavigation.currentSection);
        }
        return props.session;
      }
      const initialData = props.initialData ?? restoredNavigation?.data;
      return createWhoVaSession(instrument, {
        ...(initialData ? { initialData } : {}),
        ...(restoredNavigation?.currentSection
          ? { initialSection: restoredNavigation.currentSection }
          : {}),
        locale,
        ...(props.uiTranslations ? { uiTranslations: props.uiTranslations } : {})
      });
    });
    const [snapshot, setSnapshot] = useState(() => session.getSnapshot());
    const [view, setView] = useState<FormView>(restoredNavigation?.view ?? "form");
    const [draftIssues, setDraftIssues] = useState<Record<string, ValidationIssue>>({});
    const [draftId] = useState(() => props.draftId ?? restoredNavigation?.draftId ?? createDraftId());
    const [draftStatus, setDraftStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const draftCreatedAt = useRef(new Date().toISOString());
    const scrollViewRef = useRef<unknown>(null);
    const questionRefs = useRef<Record<string, unknown>>({});
    const questionPositions = useRef<Record<string, number>>({});

    useEffect(() => {
      props.onReady?.(session);
      return session.subscribe((next) => {
        setSnapshot(next);
        setDraftStatus("idle");
        props.onChange?.(next.data, next);
      });
    }, [session, props.onReady, props.onChange]);

    useEffect(() => {
      session.setLocale(locale, props.uiTranslations);
    }, [locale, props.uiTranslations, session]);

    useEffect(() => {
      session.setInstrument(instrument);
    }, [instrument, session]);

    useEffect(() => {
      primitives.navigation?.replace({
        instrumentId: instrument.id,
        draftId,
        currentSection: snapshot.currentSection.name,
        view,
        data: snapshot.data
      });
    }, [draftId, instrument.id, snapshot.currentSection.name, snapshot.data, view]);

    useEffect(() => primitives.navigation?.subscribe((state) => {
      if (!state || state.instrumentId !== instrument.id) return;
      session.replaceData(state.data);
      session.goToSection(state.currentSection);
      setView(state.view);
    }), [instrument.id, session]);

    const answer = (question: InstrumentQuestion, value: AnswerValue | undefined) => {
      session.setAnswer(question.name, value);
    };

    const setQuestionDraftIssue = useCallback((questionName: string, issue: ValidationIssue | undefined) => {
      setDraftIssues((current) => {
        if (issue) return current[questionName] === issue ? current : { ...current, [questionName]: issue };
        if (!current[questionName]) return current;
        const next = { ...current };
        delete next[questionName];
        return next;
      });
    }, []);

    const saveDraft = async () => {
      const store = props.draftStore ?? primitives.draftStore;
      if (!store) return;
      const now = new Date().toISOString();
      const current = session.getSnapshot();
      const draft: WhoVaDraft = {
        id: draftId,
        instrumentId: instrument.id,
        instrumentVersion: instrument.version,
        currentSection: current.currentSection.name,
        createdAt: draftCreatedAt.current,
        updatedAt: now,
        data: current.data
      };
      setDraftStatus("saving");
      try {
        await store.save(draft);
        setDraftStatus("saved");
        props.onDraftSaved?.(draft);
      } catch (error) {
        const resolved = error instanceof Error ? error : new Error(String(error));
        setDraftStatus("error");
        props.onDraftError?.(resolved);
      }
    };

    const scrollToIssue = (issue: ValidationIssue | undefined) => {
      if (!issue) return;
      const performScroll = () => {
        const questionNode = questionRefs.current[issue.question];
        const y = questionPositions.current[issue.question] ?? 0;
        if (primitives.scrollToQuestion) {
          primitives.scrollToQuestion(questionNode, scrollViewRef.current, y);
          return;
        }
        const scrollView = scrollViewRef.current as { scrollTo?: (options: { animated: boolean; y: number }) => void } | null;
        scrollView?.scrollTo?.({ y: Math.max(0, y - 12), animated: true });
      };
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(performScroll);
      else setTimeout(performScroll, 0);
    };

    const renderQuestion = (question: InstrumentQuestion) => {
      const value = snapshot.data[question.name];
      const draftIssue = draftIssues[question.name];
      const sessionIssues = snapshot.issues.filter((issue) => issue.question === question.name && !(draftIssue && issue.code === "required"));
      const issues = draftIssue ? [...sessionIssues, draftIssue] : sessionIssues;
      const label = interviewerQuestionLabel(interpolateSubmissionReferences(
        localized(question.label, locale, question.name),
        snapshot.data
      ));
      const hint = interpolateSubmissionReferences(localized(question.hint, locale, ""), snapshot.data);
      const guidance = interpolateSubmissionReferences(localized(question.guidance, locale, ""), snapshot.data);
      const hasIssues = issues.length > 0;

      const control = (
        <questionControls.Control
          question={question}
          value={value}
          data={snapshot.data}
          locale={locale}
          messages={messages}
          issues={issues}
          platform={props.platform}
          onAnswer={(next) => answer(question, next)}
          onDraftIssue={setQuestionDraftIssue}
        />
      );

      return (
        <View
          key={question.name}
          ref={(node: unknown) => {
            if (node == null) delete questionRefs.current[question.name];
            else questionRefs.current[question.name] = node;
          }}
          onLayout={(event: { nativeEvent: { layout: { y: number } } }) => {
            questionPositions.current[question.name] = event.nativeEvent.layout.y;
          }}
          style={[styles.question, question.control === "note" && styles.note, hasIssues && styles.questionError]}
          testID={`question-card-${question.name}`}
        >
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
      const incompleteDates = snapshot.questions
        .map((question) => draftIssues[question.name])
        .filter((issue): issue is ValidationIssue => issue != null);
      if (incompleteDates.length) {
        void saveDraft();
        props.onValidation?.(incompleteDates);
        scrollToIssue(incompleteDates[0]);
        return;
      }
      const result = session.next();
      void saveDraft();
      if (result.issues.length) {
        props.onValidation?.(result.issues);
        scrollToIssue(result.issues[0]);
      }
      if (result.completed) props.onComplete?.(session.validate());
    };

    const answeredQuestions = instrument.questions.filter((question) => (
      !["note", "calculated", "system"].includes(question.control)
      && isQuestionRelevant(instrument, question, snapshot.data)
      && hasAnswer(snapshot.data[question.name])
    ));

    if (view === "preview") {
      return (
        <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.progress}>{answeredQuestions.length} answered question{answeredQuestions.length === 1 ? "" : "s"}</Text>
          <Text style={styles.sectionTitle}>Answer preview</Text>
          <Text style={styles.previewIntro}>Review the answers entered so far. Return to the form to make changes.</Text>
          {answeredQuestions.length ? answeredQuestions.map((question) => {
            const value = snapshot.data[question.name];
            if (!hasAnswer(value)) return null;
            const label = interviewerQuestionLabel(interpolateSubmissionReferences(
              localized(question.label, locale, question.name),
              snapshot.data
            ));
            return (
              <View key={question.name} style={styles.question} testID={`preview-answer-${question.name}`}>
                <Text style={styles.label}>{label}</Text>
                <Text style={styles.previewAnswer}>{previewAnswer(question, value, locale)}</Text>
              </View>
            );
          }) : <Text style={styles.previewEmpty}>No answers have been entered yet.</Text>}
          <View style={styles.navigation}>
            <Pressable
              accessibilityRole="button"
              style={[questionControlStyles.button, questionControlStyles.buttonSecondary]}
              onPress={() => {
                setView("form");
                primitives.navigation?.back();
              }}
            >
              <Text style={questionControlStyles.buttonTextSecondary}>Back to form</Text>
            </Pressable>
          </View>
        </ScrollView>
      );
    }

    return (
      <ScrollView ref={scrollViewRef} style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.progress}>{messages.sectionProgress(snapshot.currentSectionIndex + 1, snapshot.visibleSectionCount)}</Text>
        <Text style={styles.sectionTitle}>{localized(snapshot.currentSection.label, locale, snapshot.currentSection.name)}</Text>
        {snapshot.questions.map(renderQuestion)}
        <View style={styles.navigation}>
          <Pressable
            accessibilityRole="button"
            disabled={!snapshot.canGoBack}
            style={[questionControlStyles.button, questionControlStyles.buttonSecondary, !snapshot.canGoBack && questionControlStyles.buttonDisabled]}
            onPress={() => session.previous()}
          >
            <Text style={questionControlStyles.buttonTextSecondary}>{messages.back}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={!(props.draftStore ?? primitives.draftStore) || draftStatus === "saving"}
            style={[questionControlStyles.button, questionControlStyles.buttonSecondary, (!(props.draftStore ?? primitives.draftStore) || draftStatus === "saving") && questionControlStyles.buttonDisabled]}
            onPress={() => void saveDraft()}
          >
            <Text style={questionControlStyles.buttonTextSecondary}>{draftStatus === "saving" ? messages.saving : messages.saveDraft}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={[questionControlStyles.button, questionControlStyles.buttonSecondary]}
            onPress={() => {
              void saveDraft();
              primitives.navigation?.push({
                instrumentId: instrument.id,
                draftId,
                currentSection: snapshot.currentSection.name,
                view: "preview",
                data: snapshot.data
              });
              setView("preview");
            }}
          >
            <Text style={questionControlStyles.buttonTextSecondary}>Preview answers</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={questionControlStyles.button} onPress={advance}>
            <Text style={questionControlStyles.buttonText}>{snapshot.canGoForward ? messages.next : messages.complete}</Text>
          </Pressable>
        </View>
        <Text style={styles.draftStatus}>
          {draftStatus === "saved" ? messages.draftSaved(draftId) : draftStatus === "error" ? messages.draftSaveFailed : messages.draftId(draftId)}
        </Text>
      </ScrollView>
    );
  }

  Form.displayName = "WhoVaForm";
  return Form;
}
