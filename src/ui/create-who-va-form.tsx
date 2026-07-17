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
import { whoVa2022Instrument } from "../instrument.js";
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
  scrollToQuestion?: (questionNode: unknown, scrollViewNode: unknown, y: number) => void;
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
  draftStatus: { color: "#536b64", fontSize: 12, marginTop: 4, marginBottom: 24 }
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
    const locale = props.locale ?? "en";
    const instrument = props.instrument ?? whoVa2022Instrument;
    const [session] = useState(() => props.session ?? createWhoVaSession(
      instrument,
      props.initialData ? { initialData: props.initialData } : {}
    ));
    const [snapshot, setSnapshot] = useState(() => session.getSnapshot());
    const [draftIssues, setDraftIssues] = useState<Record<string, ValidationIssue>>({});
    const [draftId] = useState(() => props.draftId ?? createDraftId());
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
      const label = interviewerQuestionLabel(localized(question.label, locale, question.name));
      const hint = localized(question.hint, locale, "");
      const guidance = localized(question.guidance, locale, "");
      const hasIssues = issues.length > 0;

      const control = (
        <questionControls.Control
          question={question}
          value={value}
          data={snapshot.data}
          locale={locale}
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

    return (
      <ScrollView ref={scrollViewRef} style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.progress}>Section {snapshot.currentSectionIndex + 1} of {snapshot.visibleSectionCount}</Text>
        <Text style={styles.sectionTitle}>{localized(snapshot.currentSection.label, locale, snapshot.currentSection.name)}</Text>
        {snapshot.questions.map(renderQuestion)}
        <View style={styles.navigation}>
          <Pressable
            accessibilityRole="button"
            disabled={!snapshot.canGoBack}
            style={[questionControlStyles.button, questionControlStyles.buttonSecondary, !snapshot.canGoBack && questionControlStyles.buttonDisabled]}
            onPress={() => session.previous()}
          >
            <Text style={questionControlStyles.buttonTextSecondary}>Back</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={!(props.draftStore ?? primitives.draftStore) || draftStatus === "saving"}
            style={[questionControlStyles.button, questionControlStyles.buttonSecondary, (!(props.draftStore ?? primitives.draftStore) || draftStatus === "saving") && questionControlStyles.buttonDisabled]}
            onPress={() => void saveDraft()}
          >
            <Text style={questionControlStyles.buttonTextSecondary}>{draftStatus === "saving" ? "Saving…" : "Save draft"}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={questionControlStyles.button} onPress={advance}>
            <Text style={questionControlStyles.buttonText}>{snapshot.canGoForward ? "Next" : "Complete"}</Text>
          </Pressable>
        </View>
        <Text style={styles.draftStatus}>
          {draftStatus === "saved" ? `Draft saved · ${draftId}` : draftStatus === "error" ? "Draft could not be saved" : `Draft ID · ${draftId}`}
        </Text>
      </ScrollView>
    );
  }

  Form.displayName = "WhoVaForm";
  return Form;
}
