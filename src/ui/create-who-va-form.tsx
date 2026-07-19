/**
 * Factory for the shared questionnaire form, coordinating session state,
 * validation, navigation, draft persistence, and platform question controls.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
import { applyCalculations, isQuestionRelevantWithCalculatedData } from "../engine/validation.js";
import {
  localeFromLanguageName,
  localizeText,
  resolveUiMessages,
  type WhoVaUiTranslations
} from "../i18n.js";
import {
  createWhoVaQuestionControls,
  questionControlStyles,
  type WhoVaPlatformServices
} from "./question-controls.js";
import { withWebTheme } from "./web-theme.js";

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
  onDraftController?: (controller: WhoVaDraftController | undefined) => void;
  autoSaveDraftOnChange?: boolean;
  autoSaveDraftIntervalMs?: number | false;
  onInstrumentError?: (error: Error) => void;
  onComplete?: (result: SubmissionValidationResult) => void;
}

export interface WhoVaDraftController {
  draftId: string;
  saveDraft(): Promise<void>;
}

export interface WhoVaPrimitiveSet {
  View: React.ElementType;
  Text: React.ElementType;
  TextInput: React.ElementType;
  DateInput?: React.ElementType;
  Pressable: React.ElementType;
  ScrollView: React.ElementType;
  Image?: React.ElementType;
  Svg?: React.ElementType;
  SvgCircle?: React.ElementType;
  SvgPath?: React.ElementType;
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
  data?: SubmissionData;
}

export interface WhoVaNavigationAdapter {
  read(): WhoVaNavigationState | undefined;
  replace(state: WhoVaNavigationState): void;
  push(state: WhoVaNavigationState): void;
  back(): void;
  subscribe(listener: (state: WhoVaNavigationState | undefined) => void): () => void;
}

type FooterIconName = "preview" | "save";

function FooterIcon({
  name,
  primitives
}: {
  name: FooterIconName;
  primitives: Required<Pick<WhoVaPrimitiveSet, "Svg" | "SvgCircle" | "SvgPath">>;
}): React.ReactElement {
  const { Svg, SvgCircle, SvgPath } = primitives;
  const iconProps = {
    fill: "none",
    height: 22,
    stroke: "#183d33",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    viewBox: "0 0 24 24",
    width: 22
  };
  return (
    <Svg {...iconProps} style={styles.icon} aria-hidden="true" focusable="false">
      {name === "save" ? (
        <>
          <SvgPath d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
          <SvgPath d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" />
          <SvgPath d="M7 3v4a1 1 0 0 0 1 1h7" />
        </>
      ) : (
        <>
          <SvgPath d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
          <SvgCircle cx="12" cy="12" r="3" />
        </>
      )}
    </Svg>
  );
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

function previewAnswer(
  question: InstrumentQuestion,
  value: AnswerValue,
  locale: string,
  messages: ReturnType<typeof resolveUiMessages>
): string {
  const choiceLabel = (choiceValue: string) => {
    const choice = question.choices?.find((candidate) => candidate.value === choiceValue);
    return choice ? localized(choice.label, locale, choiceValue) : choiceValue;
  };
  if (Array.isArray(value)) return value.map(choiceLabel).join(", ");
  if (typeof value === "string") return choiceLabel(value);
  if (typeof value === "boolean") return value ? messages.yes : messages.no;
  if (typeof value === "number") return String(value);
  if (value == null) return messages.recorded;
  for (const property of ["name", "originalName", "fileName", "uri"] as const) {
    const candidate = value[property];
    if (typeof candidate === "string" && candidate) return candidate;
  }
  return messages.recorded;
}

const styles = {
  root: withWebTheme({ flex: 1, backgroundColor: "#f6f8f7" }, { backgroundColor: "canvas" }),
  content: withWebTheme(
    { padding: 20, maxWidth: 760, width: "100%", alignSelf: "center" as const },
    { padding: "formPadding", maxWidth: "formMaxWidth" }
  ),
  progress: withWebTheme({ color: "#47625b", marginBottom: 6, fontSize: 13 }, { color: "muted" }),
  sectionTitle: withWebTheme(
    { color: "#12372d", fontSize: 24, fontWeight: "700" as const, marginBottom: 18 },
    { color: "brandDeep" }
  ),
  question: withWebTheme(
    {
      backgroundColor: "#ffffff",
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: "#dce6e1"
    },
    { backgroundColor: "surface", borderRadius: "cardRadius", borderColor: "border" }
  ),
  questionError: withWebTheme({ borderColor: "#d66552" }, { borderColor: "dangerBorder" }),
  label: withWebTheme(
    { color: "#142a24", fontSize: 16, fontWeight: "600" as const, marginBottom: 8 },
    { color: "ink" }
  ),
  required: withWebTheme({ color: "#a23a2a" }, { color: "danger" }),
  hint: withWebTheme({ color: "#536b64", fontSize: 13, marginBottom: 10 }, { color: "muted" }),
  guidance: withWebTheme({ color: "#315e73", fontSize: 13, marginBottom: 10 }, { color: "guidance" }),
  note: withWebTheme(
    { backgroundColor: "#edf5f2", borderLeftWidth: 4, borderLeftColor: "#147d64" },
    { backgroundColor: "brandSoft", borderLeftColor: "brand" }
  ),
  error: withWebTheme({ color: "#a23a2a", marginTop: 8, fontSize: 13 }, { color: "danger" }),
  navigation: {
    flexDirection: "row" as const,
    flexWrap: "nowrap" as const,
    alignItems: "center" as const,
    gap: 8,
    justifyContent: "center" as const,
    marginTop: 12,
    marginBottom: 12
  },
  navButton: {
    minHeight: 40,
    minWidth: 68,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  navIconButton: {
    alignItems: "center" as const,
    justifyContent: "center" as const,
    minHeight: 40,
    minWidth: 44,
    paddingHorizontal: 0,
    paddingVertical: 0
  },
  navPrimaryButton: {
    minHeight: 42,
    minWidth: 76,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  icon: { height: 22, width: 22 },
  draftStatus: withWebTheme(
    { color: "#536b64", fontSize: 12, marginTop: 4, marginBottom: 24 },
    { color: "muted" }
  ),
  previewIntro: withWebTheme({ color: "#536b64", fontSize: 14, marginBottom: 18 }, { color: "muted" }),
  previewAnswer: withWebTheme({ color: "#142a24", fontSize: 16 }, { color: "ink" }),
  previewEmpty: withWebTheme({ color: "#536b64", fontSize: 15, paddingVertical: 16 }, { color: "muted" })
};

export function createWhoVaForm(
  primitives: WhoVaPrimitiveSet,
  loadDefaultInstrument?: () => Promise<InstrumentDefinition>
): React.ComponentType<WhoVaFormProps> {
  const { View, Text, Pressable, ScrollView } = primitives;
  const svgPrimitives =
    primitives.Svg && primitives.SvgCircle && primitives.SvgPath
      ? { Svg: primitives.Svg, SvgCircle: primitives.SvgCircle, SvgPath: primitives.SvgPath }
      : undefined;
  const questionControls = createWhoVaQuestionControls({
    View,
    Text,
    TextInput: primitives.TextInput,
    DateInput: primitives.DateInput,
    Pressable,
    Image: primitives.Image,
    platform: primitives.platform
  });

  function ReadyForm(props: WhoVaFormProps & { resolvedInstrument: InstrumentDefinition }) {
    const { draftStore, onChange, onDraftController, onDraftError, onDraftSaved, onReady } = props;
    const instrument = props.resolvedInstrument;
    const locale = props.locale ?? localeFromLanguageName(instrument.defaultLanguage) ?? "en";
    const messages = resolveUiMessages(locale, props.uiTranslations);
    const saveDraftIcon = svgPrimitives ? (
      <FooterIcon name="save" primitives={svgPrimitives} />
    ) : (
      <Text style={questionControlStyles.buttonTextSecondary}>Save</Text>
    );
    const previewIcon = svgPrimitives ? (
      <FooterIcon name="preview" primitives={svgPrimitives} />
    ) : (
      <Text style={questionControlStyles.buttonTextSecondary}>View</Text>
    );
    const [restoredNavigation] = useState(() => {
      const restored = primitives.navigation?.read();
      return restored?.instrumentId === instrument.id ? restored : undefined;
    });
    const [session] = useState(() => {
      if (props.session) {
        if (restoredNavigation) {
          if (restoredNavigation.data) props.session.replaceData(restoredNavigation.data);
          props.session.goToSection(restoredNavigation.currentSection);
        }
        return props.session;
      }
      const initialData = props.initialData ?? restoredNavigation?.data;
      return createWhoVaSession(instrument, {
        ...(initialData ? { initialData } : {}),
        ...(restoredNavigation?.currentSection ? { initialSection: restoredNavigation.currentSection } : {}),
        locale,
        ...(props.uiTranslations ? { uiTranslations: props.uiTranslations } : {})
      });
    });
    const [snapshot, setSnapshot] = useState(() => session.getSnapshot());
    const [view, setView] = useState<FormView>(restoredNavigation?.view ?? "form");
    const [draftIssues, setDraftIssues] = useState<Record<string, ValidationIssue>>({});
    const [draftId] = useState(() => props.draftId ?? restoredNavigation?.draftId ?? createDraftId());
    const [draftStatus, setDraftStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const autoSaveDraftIntervalMs = props.autoSaveDraftIntervalMs ?? 20_000;
    const draftCreatedAt = useRef(new Date().toISOString());
    const draftSaveQueue = useRef<Promise<void>>(Promise.resolve());
    const latestDraftSaveRequest = useRef(0);
    const onDraftErrorRef = useRef(onDraftError);
    const onDraftSavedRef = useRef(onDraftSaved);
    const scrollViewRef = useRef<unknown>(null);
    const questionRefs = useRef<Record<string, unknown>>({});
    const questionPositions = useRef<Record<string, number>>({});

    useEffect(() => {
      onReady?.(session);
      return session.subscribe((next) => {
        setSnapshot(next);
        setDraftStatus("idle");
        onChange?.(next.data, next);
      });
    }, [onChange, onReady, session]);

    useEffect(() => {
      onDraftErrorRef.current = onDraftError;
      onDraftSavedRef.current = onDraftSaved;
    }, [onDraftError, onDraftSaved]);

    useEffect(() => {
      session.setLocale(locale, props.uiTranslations);
    }, [locale, props.uiTranslations, session]);

    useEffect(() => {
      session.setInstrument(instrument);
    }, [instrument, session]);

    useEffect(() => {
      if (!restoredNavigation || restoredNavigation.data) return;
      const store = draftStore ?? primitives.draftStore;
      let active = true;
      const restore = async () => {
        const draft = await store?.load?.(restoredNavigation.draftId);
        if (!active) return;
        if (draft && draft.instrumentId === instrument.id && draft.instrumentVersion === instrument.version) {
          session.replaceData(draft.data);
        }
        session.goToSection(restoredNavigation.currentSection);
        setView(restoredNavigation.view);
      };
      void restore().catch((error: unknown) => {
        if (!active) return;
        onDraftError?.(error instanceof Error ? error : new Error(String(error)));
      });
      return () => {
        active = false;
      };
    }, [instrument.id, instrument.version, draftStore, onDraftError, restoredNavigation, session]);

    useEffect(() => {
      primitives.navigation?.replace({
        instrumentId: instrument.id,
        draftId,
        currentSection: snapshot.currentSection.name,
        view,
        data: snapshot.data
      });
    }, [draftId, instrument.id, snapshot.currentSection.name, snapshot.data, view]);

    useEffect(
      () =>
        primitives.navigation?.subscribe((state) => {
          if (!state || state.instrumentId !== instrument.id) return;
          if (state.data) {
            session.replaceData(state.data);
            session.goToSection(state.currentSection);
            setView(state.view);
            return;
          }
          const store = draftStore ?? primitives.draftStore;
          void Promise.resolve(store?.load?.(state.draftId))
            .then((draft) => {
              if (draft?.instrumentId === instrument.id && draft.instrumentVersion === instrument.version) {
                session.replaceData(draft.data);
              }
              session.goToSection(state.currentSection);
              setView(state.view);
            })
            .catch((error: unknown) => {
              onDraftError?.(error instanceof Error ? error : new Error(String(error)));
            });
        }),
      [draftStore, instrument.id, instrument.version, onDraftError, session]
    );

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

    const saveDraft = useCallback(async () => {
      const store = draftStore ?? primitives.draftStore;
      if (!store) return;
      const requestId = ++latestDraftSaveRequest.current;
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
      const save = draftSaveQueue.current.then(async () => {
        try {
          await store.save(draft);
          if (requestId === latestDraftSaveRequest.current) setDraftStatus("saved");
          onDraftSavedRef.current?.(draft);
        } catch (error) {
          const resolved = error instanceof Error ? error : new Error(String(error));
          if (requestId === latestDraftSaveRequest.current) setDraftStatus("error");
          onDraftErrorRef.current?.(resolved);
        }
      });
      draftSaveQueue.current = save;
      await save;
    }, [draftId, instrument.id, instrument.version, draftStore, session]);

    useEffect(() => {
      onDraftController?.({ draftId, saveDraft });
      return () => onDraftController?.(undefined);
    }, [draftId, onDraftController, saveDraft]);

    useEffect(() => {
      if (!props.autoSaveDraftOnChange) return;
      if (Object.keys(snapshot.data).length === 0) return;
      queueMicrotask(() => void saveDraft());
    }, [props.autoSaveDraftOnChange, saveDraft, snapshot.data]);

    useEffect(() => {
      if (autoSaveDraftIntervalMs === false) return;
      if (autoSaveDraftIntervalMs <= 0) return;
      const timer = setInterval(() => {
        if (Object.keys(session.getSnapshot().data).length === 0) return;
        void saveDraft();
      }, autoSaveDraftIntervalMs);

      return () => clearInterval(timer);
    }, [autoSaveDraftIntervalMs, saveDraft, session]);

    const scrollToIssue = (issue: ValidationIssue | undefined) => {
      if (!issue) return;
      const performScroll = () => {
        const questionNode = questionRefs.current[issue.question];
        const y = questionPositions.current[issue.question] ?? 0;
        if (primitives.scrollToQuestion) {
          primitives.scrollToQuestion(questionNode, scrollViewRef.current, y);
          return;
        }
        const scrollView = scrollViewRef.current as {
          scrollTo?: (options: { animated: boolean; y: number }) => void;
        } | null;
        scrollView?.scrollTo?.({ y: Math.max(0, y - 12), animated: true });
      };
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(performScroll);
      else setTimeout(performScroll, 0);
    };

    const renderQuestion = (question: InstrumentQuestion) => {
      const value = snapshot.data[question.name];
      const draftIssue = draftIssues[question.name];
      const sessionIssues = snapshot.issues.filter(
        (issue) => issue.question === question.name && !(draftIssue && issue.code === "required")
      );
      const issues = draftIssue ? [...sessionIssues, draftIssue] : sessionIssues;
      const label = interviewerQuestionLabel(
        interpolateSubmissionReferences(localized(question.label, locale, question.name), snapshot.data)
      );
      const hint = interpolateSubmissionReferences(localized(question.hint, locale, ""), snapshot.data);
      const guidance = interpolateSubmissionReferences(
        localized(question.guidance, locale, ""),
        snapshot.data
      );
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
          style={[
            styles.question,
            question.control === "note" && styles.note,
            hasIssues && styles.questionError
          ]}
          testID={`question-card-${question.name}`}
        >
          <Text style={styles.label}>
            {label}
            {question.required && question.control !== "note" ? (
              <Text style={styles.required}> *</Text>
            ) : null}
          </Text>
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

    const answeredQuestions = useMemo(() => {
      if (view !== "preview") return [];
      const calculated = applyCalculations(instrument, snapshot.data);
      return instrument.questions.filter(
        (question) =>
          !["note", "calculated", "system"].includes(question.control) &&
          hasAnswer(snapshot.data[question.name]) &&
          isQuestionRelevantWithCalculatedData(instrument, question, calculated)
      );
    }, [instrument, snapshot.data, view]);

    if (view === "preview") {
      return (
        <ScrollView
          style={styles.root}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.progress}>{messages.answeredQuestions(answeredQuestions.length)}</Text>
          <Text style={styles.sectionTitle}>{messages.answerPreview}</Text>
          <Text style={styles.previewIntro}>{messages.previewIntro}</Text>
          {answeredQuestions.length ? (
            answeredQuestions.map((question) => {
              const value = snapshot.data[question.name];
              if (!hasAnswer(value)) return null;
              const label = interviewerQuestionLabel(
                interpolateSubmissionReferences(
                  localized(question.label, locale, question.name),
                  snapshot.data
                )
              );
              return (
                <View key={question.name} style={styles.question} testID={`preview-answer-${question.name}`}>
                  <Text style={styles.label}>{label}</Text>
                  <Text style={styles.previewAnswer}>{previewAnswer(question, value, locale, messages)}</Text>
                </View>
              );
            })
          ) : (
            <Text style={styles.previewEmpty}>{messages.noAnswers}</Text>
          )}
          <View style={styles.navigation}>
            <Pressable
              accessibilityRole="button"
              style={[questionControlStyles.button, questionControlStyles.buttonSecondary]}
              onPress={() => {
                setView("form");
                primitives.navigation?.back();
              }}
            >
              <Text style={questionControlStyles.buttonTextSecondary}>{messages.backToForm}</Text>
            </Pressable>
          </View>
        </ScrollView>
      );
    }

    return (
      <ScrollView
        ref={scrollViewRef}
        style={styles.root}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.progress}>
          {messages.sectionProgress(snapshot.currentSectionIndex + 1, snapshot.visibleSectionCount)}
        </Text>
        <Text style={styles.sectionTitle}>
          {localized(snapshot.currentSection.label, locale, snapshot.currentSection.name)}
        </Text>
        {snapshot.questions.map(renderQuestion)}
        <View style={styles.navigation}>
          <Pressable
            accessibilityRole="button"
            disabled={!snapshot.canGoBack}
            style={[
              questionControlStyles.button,
              questionControlStyles.buttonSecondary,
              styles.navButton,
              !snapshot.canGoBack && questionControlStyles.buttonDisabled
            ]}
            onPress={() => session.previous()}
          >
            <Text style={questionControlStyles.buttonTextSecondary}>{messages.back}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={!(props.draftStore ?? primitives.draftStore) || draftStatus === "saving"}
            style={[
              questionControlStyles.button,
              questionControlStyles.buttonSecondary,
              styles.navIconButton,
              (!(props.draftStore ?? primitives.draftStore) || draftStatus === "saving") &&
                questionControlStyles.buttonDisabled
            ]}
            onPress={() => void saveDraft()}
            accessibilityLabel={draftStatus === "saving" ? messages.saving : messages.saveDraft}
          >
            {saveDraftIcon}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={messages.previewAnswers}
            style={[
              questionControlStyles.button,
              questionControlStyles.buttonSecondary,
              styles.navIconButton
            ]}
            onPress={() => {
              void saveDraft().then(() => {
                primitives.navigation?.push({
                  instrumentId: instrument.id,
                  draftId,
                  currentSection: snapshot.currentSection.name,
                  view: "preview"
                });
                setView("preview");
              });
            }}
          >
            {previewIcon}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={[questionControlStyles.button, styles.navPrimaryButton]}
            onPress={advance}
          >
            <Text style={questionControlStyles.buttonText}>
              {snapshot.canGoForward ? messages.next : messages.complete}
            </Text>
          </Pressable>
        </View>
        <Text style={styles.draftStatus}>
          {draftStatus === "saved"
            ? messages.draftSaved(draftId)
            : draftStatus === "error"
              ? messages.draftSaveFailed
              : messages.draftId(draftId)}
        </Text>
      </ScrollView>
    );
  }

  function Form(props: WhoVaFormProps) {
    const { instrument: providedInstrument, onInstrumentError } = props;
    const [loadedInstrument, setLoadedInstrument] = useState<InstrumentDefinition>();
    const [loadError, setLoadError] = useState<Error>();

    useEffect(() => {
      if (providedInstrument) return;
      let active = true;
      if (!loadDefaultInstrument) {
        const error = new Error("No instrument or default instrument loader was provided");
        queueMicrotask(() => {
          if (!active) return;
          setLoadError(error);
          onInstrumentError?.(error);
        });
        return () => {
          active = false;
        };
      }
      void loadDefaultInstrument()
        .then((instrument) => {
          if (active) setLoadedInstrument(instrument);
        })
        .catch((error: unknown) => {
          if (!active) return;
          const resolved = error instanceof Error ? error : new Error(String(error));
          setLoadError(resolved);
          onInstrumentError?.(resolved);
        });
      return () => {
        active = false;
      };
    }, [onInstrumentError, providedInstrument]);

    const instrument = providedInstrument ?? loadedInstrument;
    if (!instrument) {
      return (
        <View style={styles.root}>
          <View style={styles.content}>
            <Text
              accessibilityLiveRegion="polite"
              role={loadError ? "alert" : undefined}
              style={loadError ? styles.error : styles.progress}
            >
              {loadError ? "The questionnaire could not be loaded." : "Loading questionnaire…"}
            </Text>
          </View>
        </View>
      );
    }
    return <ReadyForm {...props} resolvedInstrument={instrument} />;
  }

  Form.displayName = "WhoVaForm";
  return Form;
}
