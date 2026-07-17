/**
 * Stateful, UI-independent interview session engine for answers, calculations,
 * section navigation, localization, and submission validation.
 */
import { applyCalculations, getQuestion, isQuestionRelevant, validateAnswer, validateSubmission } from "./validation.js";
import { formatLocalDate } from "./date.js";
import type {
  AnswerValue,
  InstrumentDefinition,
  InstrumentQuestion,
  InstrumentSection,
  SessionNavigationResult,
  SessionSnapshot,
  SubmissionData,
  SubmissionValidationResult,
  ValidationIssue,
  WhoVaSession,
  WhoVaSessionOptions
} from "../types.js";
import { resolveUiMessages, type WhoVaUiMessages, type WhoVaUiTranslations } from "../i18n.js";

function directQuestions(instrument: InstrumentDefinition, section: InstrumentSection): InstrumentQuestion[] {
  return instrument.questions.filter((question) => question.sectionPath.at(-1) === section.name);
}

function sectionIsRelevant(instrument: InstrumentDefinition, section: InstrumentSection, data: SubmissionData): boolean {
  const sample = directQuestions(instrument, section)[0];
  if (sample) return isQuestionRelevant(instrument, sample, data);
  return false;
}

function blocksDraftMutation(issue: ValidationIssue): boolean {
  return issue.code === "type" || issue.code === "choice" || issue.code === "unsupported-expression";
}

class UniversalWhoVaSession implements WhoVaSession {
  private data: SubmissionData;
  private currentSectionName: string;
  private issues: ValidationIssue[] = [];
  private readonly listeners = new Set<(snapshot: SessionSnapshot) => void>();
  private readonly now: () => Date;
  private locale: string;
  private messages: WhoVaUiMessages;

  constructor(private instrument: InstrumentDefinition, options: WhoVaSessionOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.locale = options.locale ?? "en";
    this.messages = resolveUiMessages(this.locale, options.uiTranslations);
    const startedAt = this.now();
    this.data = { ...(options.initialData ?? {}) };
    for (const question of instrument.questions) {
      if (question.sourceType === "today" && this.data[question.name] == null) this.data[question.name] = formatLocalDate(startedAt);
      if (question.sourceType === "start" && this.data[question.name] == null) this.data[question.name] = startedAt.toISOString();
      if (question.sourceType === "audit" && options.audit && this.data[question.name] == null) this.data[question.name] = options.audit;
    }
    this.data = applyCalculations(instrument, this.data);
    const first = this.visibleSections()[0];
    if (!first) throw new Error("Instrument has no visible sections");
    const requested = options.initialSection
      ? this.visibleSections().find((section) => section.name === options.initialSection)
      : undefined;
    this.currentSectionName = requested?.name ?? first.name;
  }

  private visibleSections(): InstrumentSection[] {
    return this.instrument.sections
      .filter((section) => directQuestions(this.instrument, section).length > 0 && sectionIsRelevant(this.instrument, section, this.data))
      .sort((left, right) => {
        const leftOrder = directQuestions(this.instrument, left)[0]?.order ?? left.order;
        const rightOrder = directQuestions(this.instrument, right)[0]?.order ?? right.order;
        return leftOrder - rightOrder;
      });
  }

  private currentSection(): InstrumentSection {
    const visible = this.visibleSections();
    return visible.find((section) => section.name === this.currentSectionName) ?? visible[0] ?? this.instrument.sections[0] as InstrumentSection;
  }

  private currentQuestions(): InstrumentQuestion[] {
    const section = this.currentSection();
    return directQuestions(this.instrument, section).filter(
      (question) => !["calculated", "system"].includes(question.control) && isQuestionRelevant(this.instrument, question, this.data)
    );
  }

  private notify(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) listener(snapshot);
  }

  getSnapshot(): SessionSnapshot {
    const sections = this.visibleSections();
    const currentSection = this.currentSection();
    const index = Math.max(0, sections.findIndex((section) => section.name === currentSection.name));
    return {
      data: { ...this.data },
      currentSection,
      currentSectionIndex: index,
      visibleSectionCount: sections.length,
      questions: this.currentQuestions(),
      issues: [...this.issues],
      canGoBack: index > 0,
      canGoForward: index < sections.length - 1
    };
  }

  setInstrument(instrument: InstrumentDefinition): void {
    if (instrument.id !== this.instrument.id || instrument.version !== this.instrument.version) {
      throw new Error("A session language change must use the same instrument id and version");
    }
    this.instrument = instrument;
    this.data = applyCalculations(instrument, this.data);
    this.notify();
  }

  setAnswer(name: string, value: AnswerValue | undefined): void {
    const question = getQuestion(this.instrument, name);
    if (question.readOnly || ["note", "calculated", "system"].includes(question.control)) {
      throw new Error(`${name} cannot be edited by the respondent`);
    }
    const nextData = { ...this.data };
    if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) delete nextData[name];
    else nextData[name] = value;
    const calculatedNextData = applyCalculations(this.instrument, nextData);
    const fieldIssues = validateAnswer(question, value, calculatedNextData, this.locale, this.messages);
    const blocking = fieldIssues.filter(blocksDraftMutation);
    if (blocking.length) throw new Error(blocking[0]?.message ?? `${name} is invalid`);
    this.data = calculatedNextData;
    this.issues = [
      ...this.issues.filter((issue) => issue.question !== name),
      ...fieldIssues
    ];
    this.notify();
  }

  replaceData(data: SubmissionData): void {
    const replacement = { ...this.data };
    for (const question of this.instrument.questions) {
      if (["calculated", "system"].includes(question.control)) continue;
      delete replacement[question.name];
    }
    for (const [name, value] of Object.entries(data)) {
      const question = getQuestion(this.instrument, name);
      if (["calculated", "system"].includes(question.control)) continue;
      const errors = validateAnswer(question, value, { ...replacement, [name]: value }, this.locale, this.messages).filter(blocksDraftMutation);
      if (errors.length) throw new Error(errors[0]?.message ?? `${name} is invalid`);
      replacement[name] = value;
    }
    this.data = applyCalculations(this.instrument, replacement);
    this.issues = [];
    const current = this.currentSection();
    this.currentSectionName = current.name;
    this.notify();
  }

  goToSection(name: string): boolean {
    const section = this.visibleSections().find((candidate) => candidate.name === name);
    if (!section) return false;
    if (section.name === this.currentSectionName) return true;
    this.currentSectionName = section.name;
    this.issues = [];
    this.notify();
    return true;
  }

  setLocale(locale: string, uiTranslations?: WhoVaUiTranslations): void {
    this.locale = locale;
    this.messages = resolveUiMessages(locale, uiTranslations);
  }

  next(): SessionNavigationResult {
    const currentIssues = this.currentQuestions().flatMap((question) => validateAnswer(question, this.data[question.name], this.data, this.locale, this.messages));
    this.issues = currentIssues;
    if (currentIssues.length) {
      this.notify();
      return { advanced: false, issues: [...currentIssues] };
    }
    const sections = this.visibleSections();
    const index = sections.findIndex((section) => section.name === this.currentSection().name);
    const next = sections[index + 1];
    if (!next) {
      const completed = this.complete();
      return { advanced: completed.valid, completed: completed.valid, issues: completed.issues };
    }
    this.currentSectionName = next.name;
    this.issues = [];
    this.notify();
    return { advanced: true, issues: [] };
  }

  previous(): boolean {
    const sections = this.visibleSections();
    const index = sections.findIndex((section) => section.name === this.currentSection().name);
    const previous = sections[index - 1];
    if (!previous) return false;
    this.currentSectionName = previous.name;
    this.issues = [];
    this.notify();
    return true;
  }

  validate(): SubmissionValidationResult {
    return validateSubmission(this.instrument, this.data, this.locale, this.messages);
  }

  complete(): SubmissionValidationResult {
    const completedAt = this.now().toISOString();
    for (const question of this.instrument.questions) if (question.sourceType === "end") this.data[question.name] = completedAt;
    const result = validateSubmission(this.instrument, this.data, this.locale, this.messages);
    this.data = result.data;
    this.issues = result.issues;
    this.notify();
    return result;
  }

  subscribe(listener: (snapshot: SessionSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export function createWhoVaSession(
  instrument: InstrumentDefinition,
  options: WhoVaSessionOptions = {}
): WhoVaSession {
  return new UniversalWhoVaSession(instrument, options);
}
