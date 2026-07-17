/**
 * Translation contracts and locale-resolution utilities for instrument content
 * and form UI messages, including lazy per-language loading.
 */
import type { InstrumentDefinition, LocalizedText } from "./types.js";

export interface QuestionTranslation {
  label?: string;
  hint?: string;
  guidance?: string;
  constraintMessage?: string;
  choices?: Record<string, string>;
}

export interface InstrumentTranslation {
  sections?: Record<string, string>;
  questions?: Record<string, QuestionTranslation>;
}

export type InstrumentTranslations = Record<string, InstrumentTranslation>;

/** JSON-serializable UI strings. Braced names such as {label} are replaced at runtime. */
export interface WhoVaUiMessageTemplates {
  sectionProgress: string;
  back: string;
  saveDraft: string;
  saving: string;
  next: string;
  complete: string;
  draftSaved: string;
  draftSaveFailed: string;
  draftId: string;
  required: string;
  invalidType: string;
  invalidChoice: string;
  invalidConstraint: string;
  fourDigitYear: string;
  invalidDate: string;
  openingCalendar: string;
  selectDate: string;
  confirm: string;
  confirmed: string;
  answeredQuestions: string;
  answerPreview: string;
  previewIntro: string;
  noAnswers: string;
  backToForm: string;
  previewAnswers: string;
  yes: string;
  no: string;
  recorded: string;
}

/** One independently importable language file. */
export interface WhoVaLanguageFile {
  locale: string;
  instrument: InstrumentTranslation;
  ui?: Partial<WhoVaUiMessageTemplates>;
}

export interface LoadedWhoVaLanguage {
  locale: string;
  instrument: InstrumentDefinition;
  uiTranslations: WhoVaUiTranslations;
}

export type WhoVaLanguageImport = () => Promise<WhoVaLanguageFile | { default: WhoVaLanguageFile }>;
export type WhoVaLanguageImports = Record<string, WhoVaLanguageImport>;

export interface WhoVaLanguageLoaderOptions {
  /** Maximum translated instruments retained at once. Defaults to two. */
  maxCachedLanguages?: number;
}

export interface WhoVaUiMessages {
  sectionProgress: (current: number, total: number) => string;
  back: string;
  saveDraft: string;
  saving: string;
  next: string;
  complete: string;
  draftSaved: (id: string) => string;
  draftSaveFailed: string;
  draftId: (id: string) => string;
  required: (label: string) => string;
  invalidType: (name: string, dataType: string) => string;
  invalidChoice: (name: string) => string;
  invalidConstraint: (name: string) => string;
  fourDigitYear: string;
  invalidDate: (format: string, example: string) => string;
  openingCalendar: string;
  selectDate: string;
  confirm: string;
  confirmed: string;
  answeredQuestions: (count: number) => string;
  answerPreview: string;
  previewIntro: string;
  noAnswers: string;
  backToForm: string;
  previewAnswers: string;
  yes: string;
  no: string;
  recorded: string;
}

export type WhoVaUiTranslations = Record<string, Partial<WhoVaUiMessageTemplates>>;

export const ENGLISH_UI_MESSAGE_TEMPLATES: WhoVaUiMessageTemplates = {
  sectionProgress: "Section {current} of {total}",
  back: "Back",
  saveDraft: "Save draft",
  saving: "Saving…",
  next: "Next",
  complete: "Complete",
  draftSaved: "Draft saved · {id}",
  draftSaveFailed: "Draft could not be saved",
  draftId: "Draft ID · {id}",
  required: "{label} is required",
  invalidType: "{name} must be a valid {dataType} value",
  invalidChoice: "{name} contains a value outside its WHO choice list",
  invalidConstraint: "{name} does not satisfy its WHO constraint",
  fourDigitYear: "Enter a four-digit year, for example 2026",
  invalidDate: "Enter the date as {format}, for example {example}",
  openingCalendar: "Opening calendar…",
  selectDate: "Select date",
  confirm: "Confirm",
  confirmed: "Confirmed",
  answeredQuestions: "{count} answered questions",
  answerPreview: "Answer preview",
  previewIntro: "Review the answers entered so far. Return to the form to make changes.",
  noAnswers: "No answers have been entered yet.",
  backToForm: "Back to form",
  previewAnswers: "Preview answers",
  yes: "Yes",
  no: "No",
  recorded: "Recorded"
};

function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{([^}]+)\}/g, (match, name: string) => (
    Object.hasOwn(values, name) ? String(values[name]) : match
  ));
}

function messagesFromTemplates(templates: WhoVaUiMessageTemplates): WhoVaUiMessages {
  return {
    ...templates,
    sectionProgress: (current, total) => format(templates.sectionProgress, { current, total }),
    draftSaved: (id) => format(templates.draftSaved, { id }),
    draftId: (id) => format(templates.draftId, { id }),
    required: (label) => format(templates.required, { label }),
    invalidType: (name, dataType) => format(templates.invalidType, { name, dataType }),
    invalidChoice: (name) => format(templates.invalidChoice, { name }),
    invalidConstraint: (name) => format(templates.invalidConstraint, { name }),
    invalidDate: (dateFormat, example) => format(templates.invalidDate, { format: dateFormat, example }),
    answeredQuestions: (count) => format(templates.answeredQuestions, { count })
  };
}

export const ENGLISH_UI_MESSAGES: WhoVaUiMessages = messagesFromTemplates(ENGLISH_UI_MESSAGE_TEMPLATES);

export function localeCandidates(locale: string): string[] {
  const normalized = locale.trim().replaceAll("_", "-").toLowerCase();
  const language = normalized.split("-")[0] ?? "";
  return [...new Set([normalized, language, "en"].filter(Boolean))];
}

export function localeFromLanguageName(value: string): string | undefined {
  return value.match(/\(([A-Za-z0-9_-]+)\)\s*$/)?.[1]?.replaceAll("_", "-").toLowerCase();
}

export function localizeText(text: LocalizedText, locale: string, fallback = ""): string {
  for (const candidate of localeCandidates(locale)) {
    const value = text[candidate];
    if (value) return value;
  }
  return Object.values(text).find((value): value is string => Boolean(value)) ?? fallback;
}

export function resolveUiMessages(locale: string, translations: WhoVaUiTranslations = {}): WhoVaUiMessages {
  let templates = { ...ENGLISH_UI_MESSAGE_TEMPLATES };
  for (const candidate of localeCandidates(locale).reverse()) {
    const key = Object.keys(translations).find((item) => item.toLowerCase().replaceAll("_", "-") === candidate);
    if (key && translations[key]) templates = { ...templates, ...translations[key] };
  }
  return messagesFromTemplates(templates);
}

/** Adds locale text without changing question identifiers, values, or branching logic. */
export function withInstrumentTranslations(
  instrument: InstrumentDefinition,
  translations: InstrumentTranslations
): InstrumentDefinition {
  const sections = instrument.sections.map((section) => {
    let label = section.label;
    for (const [locale, translation] of Object.entries(translations)) {
      const value = translation.sections?.[section.name];
      if (value) {
        if (label === section.label) label = { ...section.label };
        label[locale.toLowerCase().replaceAll("_", "-")] = value;
      }
    }
    return label === section.label ? section : { ...section, label };
  });

  const questions = instrument.questions.map((question) => {
    let label = question.label;
    let hint = question.hint;
    let guidance = question.guidance;
    let constraintMessage = question.constraintMessage;
    let choices = question.choices;
    for (const [locale, translation] of Object.entries(translations)) {
      const key = locale.toLowerCase().replaceAll("_", "-");
      const value = translation.questions?.[question.name];
      if (!value) continue;
      if (value.label) {
        if (label === question.label) label = { ...question.label };
        label[key] = value.label;
      }
      if (value.hint) {
        if (hint === question.hint) hint = { ...question.hint };
        hint[key] = value.hint;
      }
      if (value.guidance) {
        if (guidance === question.guidance) guidance = { ...question.guidance };
        guidance[key] = value.guidance;
      }
      if (value.constraintMessage) {
        if (constraintMessage === question.constraintMessage) constraintMessage = { ...question.constraintMessage };
        constraintMessage[key] = value.constraintMessage;
      }
      if (value.choices && choices) {
        choices = choices.map((choice) => {
          const choiceLabel = value.choices?.[choice.value];
          return choiceLabel ? { ...choice, label: { ...choice.label, [key]: choiceLabel } } : choice;
        });
      }
    }
    const changed = label !== question.label
      || hint !== question.hint
      || guidance !== question.guidance
      || constraintMessage !== question.constraintMessage
      || choices !== question.choices;
    return changed
      ? { ...question, label, hint, guidance, constraintMessage, ...(choices ? { choices } : {}) }
      : question;
  });

  return { ...instrument, sections, questions };
}

export function withInstrumentTranslation(
  instrument: InstrumentDefinition,
  locale: string,
  translation: InstrumentTranslation
): InstrumentDefinition {
  return withInstrumentTranslations(instrument, { [locale]: translation });
}

function languageFileFromModule(module: WhoVaLanguageFile | { default: WhoVaLanguageFile }): WhoVaLanguageFile {
  return "default" in module ? module.default : module;
}

/**
 * Creates a cached lazy loader. Locale modules are not imported until `load` is called.
 * Regional locales try their exact module first, then their base language, then English.
 */
export function createWhoVaLanguageLoader(
  baseInstrument: InstrumentDefinition,
  imports: WhoVaLanguageImports,
  options: WhoVaLanguageLoaderOptions = {}
): (locale: string) => Promise<LoadedWhoVaLanguage> {
  const maximum = Math.max(1, Math.floor(options.maxCachedLanguages ?? 2));
  const cache = new Map<string, Promise<LoadedWhoVaLanguage>>();
  return async (requestedLocale: string) => {
    const normalized = localeCandidates(requestedLocale)[0] ?? "en";
    const existing = cache.get(normalized);
    if (existing) {
      cache.delete(normalized);
      cache.set(normalized, existing);
      return existing;
    }
    const loading = (async () => {
      for (const candidate of localeCandidates(requestedLocale)) {
        const key = Object.keys(imports).find((item) => item.toLowerCase().replaceAll("_", "-") === candidate);
        if (!key || !imports[key]) continue;
        const file = languageFileFromModule(await imports[key]());
        const locale = file.locale.toLowerCase().replaceAll("_", "-");
        return {
          locale,
          instrument: withInstrumentTranslation(baseInstrument, locale, file.instrument),
          uiTranslations: file.ui ? { [locale]: file.ui } : {}
        };
      }
      return { locale: "en", instrument: baseInstrument, uiTranslations: {} };
    })();
    cache.set(normalized, loading);
    while (cache.size > maximum) {
      const oldest = cache.keys().next().value as string | undefined;
      if (!oldest) break;
      cache.delete(oldest);
    }
    void loading.catch(() => {
      if (cache.get(normalized) === loading) cache.delete(normalized);
    });
    return loading;
  };
}
