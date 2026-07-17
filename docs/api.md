# API reference

This is a practical guide to the public package surface. TypeScript declarations emitted by `pnpm build` remain the exact signature reference.

## Entry points

| Import | Use it for |
| --- | --- |
| `@who-va/instrument` | Instrument data, sessions, expressions, validation, drafts, localization, and platform-neutral attachments |
| `@who-va/instrument/native` | Expo/React Native form, controls, and native attachment processing |
| `@who-va/instrument/web` | React web form, controls, and browser attachment persistence |
| `@who-va/instrument/web-component` | Custom element plus all web exports |

## Instrument loading

- `whoVa2022Instrument` is the synchronous, built-in canonical instrument. Importing it through the root entry point includes the JSON contract in that entry's module graph.
- `loadWhoVa2022Instrument()` lazily imports and caches the canonical instrument.
- `loadWhoVa2022Language(locale)` loads the instrument and a built-in translation when available.
- `WHO_VA_2022_LANGUAGES` lists the built-in English, French, and Hindi choices.

Use the lazy loader in applications sensitive to startup parsing cost. Use the synchronous export for headless/server workflows that need immediate access.

## Headless sessions

```ts
import { createWhoVaSession, loadWhoVa2022Instrument } from "@who-va/instrument";

const instrument = await loadWhoVa2022Instrument();
const session = createWhoVaSession(instrument, {
  initialData: { Id10010c: "INT-001" },
  locale: "en"
});

session.setAnswer("Id10021", "1980-04-10");
const snapshot = session.getSnapshot();
const navigation = session.next();
const result = session.complete();
```

The session exposes:

| Method | Result |
| --- | --- |
| `getSnapshot()` | Current normalized data, visible section, questions, issues, and navigation flags |
| `setAnswer(name, value)` | Validate and apply one answer, then recompute derived values |
| `replaceData(data)` | Replace session answers as a unit |
| `setInstrument(instrument)` | Switch to another compatible instrument, such as a translated instance |
| `goToSection(name)` | Navigate to a visible section by name |
| `setLocale(locale, translations?)` | Change display locale and UI messages |
| `next()` / `previous()` | Validate and navigate the interview |
| `validate()` / `complete()` | Return normalized data and validation issues |
| `subscribe(listener)` | Observe snapshots; returns an unsubscribe function |

## Stateless engine functions

- `parseExpression(source)` converts a supported XLSForm expression to the runtime AST.
- `evaluateExpression(expression, data, options?)` evaluates an AST or source expression against answers.
- `applyCalculations(instrument, data)` returns data with calculated questions recomputed.
- `getQuestion(instrument, name)` returns a named question or throws when it is absent.
- `isQuestionRelevant(instrument, question, data)` evaluates visibility.
- `validateAnswer(instrument, question, value, data, ...)` validates one field.
- `validateSubmission(instrument, data, ...)` recalculates, removes irrelevant answers from normalized output, and validates the complete submission.

Prefer `validateSubmission()` at server ingress even if the client already validated the interview.

## Form component

`WhoVaForm` is exported by `/native` and `/web`. Important props include:

| Prop | Purpose |
| --- | --- |
| `instrument` | Use a supplied canonical or translated instrument instead of the built-in default |
| `session` | Reuse a caller-owned session |
| `initialData` | Seed a new session |
| `locale` / `uiTranslations` | Control question localization and form chrome |
| `showSourceGuidance` | Display source guidance text |
| `platform` | Inject date, audio, image, file, and attachment lifecycle services |
| `draftId` / `draftStore` | Control durable draft identity and persistence |
| `onReady` | Receive the initialized session |
| `onChange` | Receive answer data and the current snapshot |
| `onValidation` | Receive current validation issues |
| `onDraftSaved` / `onDraftError` | Observe draft persistence |
| `onInstrumentError` | Handle default-instrument loading failures |
| `onComplete` | Receive the normalized submission result |

Web forms use a browser draft store by default. Native hosts should inject a `WhoVaDraftStore` suitable for their app.

## Reusable question controls

`WhoVaQuestionControls` is exported by `/native` and `/web`. `Control` dispatches from `question.control`; named components are also available for text, integer, date, single choice, multiple choice, confirm, audio, image, file, note, calculated, and system questions.

Each receives the same core contract: `question`, `value`, `data`, `locale`, `issues`, `platform`, and `onAnswer`. Use these controls when a host needs its own section layout but wants the package's input behavior.

## Drafts

- `createDraftId()` creates a UUID draft identifier.
- `createLocalStorageDraftStore(storage?)` creates the browser-compatible key/value adapter.
- `WHO_VA_DRAFT_KEY_PREFIX` is the default `who-va-2022:draft:` prefix.

A `WhoVaDraft` contains its ID, instrument ID/version, current section, timestamps, and unvalidated answer data. Draft metadata is deliberately outside the WHO submission object.

## Localization

- `localizeText()` resolves localized text with fallback behavior.
- `resolveUiMessages()` resolves form chrome and validation messages.
- `withInstrumentTranslation()` and `withInstrumentTranslations()` apply partial translations without changing stable data identifiers.
- `createWhoVaLanguageLoader()` builds a lazy, bounded translation loader.
- `localeCandidates()` and `localeFromLanguageName()` help normalize locale selection.

Language files may translate section labels, question labels, hints, guidance, choice labels, constraint messages, and UI text. They must not translate question names, coded values, or expressions.

## Attachments

Platform-neutral exports include `WHO_VA_ATTACHMENT_POLICY`, `inspectRasterImage()`, image/PDF processing functions, processed-value guards, and `AttachmentProcessingError`.

The native entry point adds `processNativeImageAttachment()`. The web entry point supplies browser adapters and these application-facing helpers:

- `loadWhoVaWebAttachmentBlob(reference)` loads an IndexedDB-backed attachment for streaming through `fetch` or `FormData`.
- `cleanupWhoVaWebAttachments(references)` deletes binaries not reachable from the complete supplied set of retained drafts or answers.

Attachment answer values are references, not base64 payloads. See [Attachment processing](attachments.md) before implementing storage, upload, cleanup, or a new file format.

## Web component

```ts
import { defineWhoVaElement } from "@who-va/instrument/web-component";

defineWhoVaElement();
```

`<who-va-2022-form>` observes `locale` and `show-guidance`, accepts `draft-id`, and exposes `getData()`, `setData()`, `getDraftId()`, `validate()`, and `complete()`.

It emits bubbling custom events: `who-va-change`, `who-va-validation`, `who-va-draft-saved`, `who-va-draft-error`, and `who-va-complete`. Event data is available on `event.detail`.

## Core data contracts

The most commonly used types are:

- `InstrumentDefinition`, `InstrumentSection`, and `InstrumentQuestion`
- `SubmissionData` and `AnswerValue`
- `ValidationIssue` and `SubmissionValidationResult`
- `WhoVaSession`, `WhoVaSessionOptions`, and `SessionSnapshot`
- `WhoVaDraft` and `WhoVaDraftStore`
- `WhoVaFormProps` and `WhoVaPlatformServices` from the UI entry points

Stored answers use stable WHO question names as keys. Choice answers store coded values, dates use ISO `YYYY-MM-DD`, multi-select answers use string arrays, and attachments use structured reference objects.
