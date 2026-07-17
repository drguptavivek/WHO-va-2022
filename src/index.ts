/**
 * Platform-neutral public package entry point for the instrument, session and
 * validation engines, localization, drafts, and attachment contracts.
 */
export { evaluateExpression, parseExpression } from "./engine/expression.js";
export {
  applyCalculations,
  getQuestion,
  isQuestionRelevant,
  validateAnswer,
  validateSubmission
} from "./engine/validation.js";
export { createWhoVaSession } from "./engine/session.js";
export {
  ENGLISH_UI_MESSAGES,
  ENGLISH_UI_MESSAGE_TEMPLATES,
  createWhoVaLanguageLoader,
  localeCandidates,
  localeFromLanguageName,
  localizeText,
  resolveUiMessages,
  withInstrumentTranslation,
  withInstrumentTranslations
} from "./i18n.js";
export type {
  InstrumentTranslation,
  InstrumentTranslations,
  LoadedWhoVaLanguage,
  QuestionTranslation,
  WhoVaLanguageFile,
  WhoVaLanguageImport,
  WhoVaLanguageImports,
  WhoVaUiMessages,
  WhoVaUiMessageTemplates,
  WhoVaUiTranslations
} from "./i18n.js";
export { createDraftId, createLocalStorageDraftStore, WHO_VA_DRAFT_KEY_PREFIX } from "./draft.js";
export {
  AttachmentProcessingError,
  WHO_VA_ATTACHMENT_POLICY,
  inspectRasterImage,
  isProcessedImageAttachment,
  isProcessedPdfAttachment,
  processImageAttachment,
  processPdfAttachment
} from "./attachments.js";
export { whoVa2022Instrument } from "./instrument.js";
export type * from "./types.js";
export type * from "./attachments.js";
