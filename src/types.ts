/**
 * Canonical, platform-neutral data contracts for the compiled instrument,
 * answers, drafts, validation results, and interview sessions.
 */
import type { WhoVaUiTranslations } from "./i18n.js";

export type AnswerDataType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "dateTime"
  | "string[]"
  | "attachment"
  | "audit"
  | "calculated"
  | "none";

export type QuestionControl =
  | "text"
  | "integer"
  | "singleChoice"
  | "multipleChoice"
  | "date"
  | "audio"
  | "image"
  | "file"
  | "confirm"
  | "note"
  | "calculated"
  | "system";

export interface LocalizedText {
  en?: string;
  fr?: string;
  [locale: string]: string | undefined;
}

export interface InstrumentChoice {
  value: string;
  label: LocalizedText;
  sourceRow: number;
}

export interface SourceExpression {
  source: string;
  ast?: ExpressionNode;
}

export type ExpressionNode =
  | { type: "literal"; value: string | number | boolean | null }
  | { type: "reference"; name: string }
  | { type: "current" }
  | { type: "unary"; operator: "not" | "negative"; operand: ExpressionNode }
  | {
      type: "binary";
      operator: "and" | "or" | "=" | "!=" | ">" | ">=" | "<" | "<=" | "+" | "-" | "*" | "div" | "mod";
      left: ExpressionNode;
      right: ExpressionNode;
    }
  | { type: "call"; name: "selected" | "count-selected" | "string-length" | "int" | "if" | "today" | "date"; arguments: ExpressionNode[] };

export interface InstrumentQuestion {
  name: string;
  order: number;
  sourceRow: number;
  sourceType: string;
  ageGroup?: string;
  dataType: AnswerDataType;
  control: QuestionControl;
  listName?: string;
  label: LocalizedText;
  hint: LocalizedText;
  guidance: LocalizedText;
  required: boolean;
  readOnly: boolean;
  appearance?: string;
  parameters?: string;
  defaultValue?: string;
  choices?: InstrumentChoice[];
  relevant?: SourceExpression;
  constraint?: SourceExpression;
  constraintMessage: LocalizedText;
  calculation?: SourceExpression;
  sectionPath: string[];
}

export interface InstrumentSection {
  name: string;
  sourceRow: number;
  order: number;
  label: LocalizedText;
  ageGroup?: string;
  parent?: string;
  relevant?: SourceExpression;
}

export interface InstrumentDefinition {
  id: string;
  title: string;
  version: string;
  defaultLanguage: string;
  sourceFile: string;
  sections: InstrumentSection[];
  questions: InstrumentQuestion[];
}

export type AnswerValue = string | number | boolean | string[] | Record<string, unknown> | null;
export type SubmissionData = Record<string, AnswerValue | undefined>;

export interface WhoVaDraft {
  id: string;
  instrumentId: string;
  instrumentVersion: string;
  currentSection: string;
  createdAt: string;
  updatedAt: string;
  data: SubmissionData;
}

export interface WhoVaDraftStore {
  save(draft: WhoVaDraft): void | Promise<void>;
  load?(id: string): WhoVaDraft | undefined | Promise<WhoVaDraft | undefined>;
  remove?(id: string): void | Promise<void>;
}

export interface ValidationIssue {
  question: string;
  code: "required" | "type" | "choice" | "constraint" | "unsupported-expression";
  message: string;
}

export interface SubmissionValidationResult {
  valid: boolean;
  data: SubmissionData;
  issues: ValidationIssue[];
}

export interface SessionSnapshot {
  data: SubmissionData;
  currentSection: InstrumentSection;
  currentSectionIndex: number;
  visibleSectionCount: number;
  questions: InstrumentQuestion[];
  issues: ValidationIssue[];
  canGoBack: boolean;
  canGoForward: boolean;
}

export interface SessionNavigationResult {
  advanced: boolean;
  completed?: boolean;
  issues: ValidationIssue[];
}

export interface WhoVaSessionOptions {
  initialData?: SubmissionData;
  initialSection?: string;
  locale?: string;
  uiTranslations?: WhoVaUiTranslations;
  now?: () => Date;
  audit?: Record<string, unknown>;
}

export interface WhoVaSession {
  getSnapshot(): SessionSnapshot;
  setInstrument(instrument: InstrumentDefinition): void;
  setAnswer(name: string, value: AnswerValue | undefined): void;
  replaceData(data: SubmissionData): void;
  goToSection(name: string): boolean;
  setLocale(locale: string, uiTranslations?: WhoVaUiTranslations): void;
  next(): SessionNavigationResult;
  previous(): boolean;
  validate(): SubmissionValidationResult;
  complete(): SubmissionValidationResult;
  subscribe(listener: (snapshot: SessionSnapshot) => void): () => void;
}
