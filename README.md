# WHO 2022 Verbal Autopsy Instrument

A React Native-first implementation of the **WHO 2022 Verbal Autopsy instrument V1.1**. One platform-neutral question contract drives Expo, React Native, React Native Web, non-React websites, field validation, and submission validation.

The runtime does **not** use SurveyJS and does **not** read the Excel workbook. The WHO XLSForm is a build-time source used only by `pnpm generate`.

## Package entry points

| Import | Purpose |
| --- | --- |
| `@who-va/instrument` | Headless instrument, expression, session, and submission APIs |
| `@who-va/instrument/native` | Expo and React Native `WhoVaForm` |
| `@who-va/instrument/web` | React web `WhoVaForm`, rendered through React Native Web |
| `@who-va/instrument/web-component` | `<who-va-2022-form>` wrapper for non-React web apps |

## Expo / React Native

```tsx
import { SafeAreaView } from "react-native";
import { WhoVaForm, type WhoVaDraftStore } from "@who-va/instrument/native";

const draftStore: WhoVaDraftStore = {
  async save(draft) {
    // Use Expo SQLite, AsyncStorage, MMKV, or the app database here.
    await appStorage.set(`who-va-2022:draft:${draft.id}`, JSON.stringify(draft));
  }
};

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <WhoVaForm
        initialData={{ Id10010c: "INT-001" }}
        draftStore={draftStore}
        platform={{
          pickDate: async (_question, _data, currentValue) => {
            // Open the host app's native date picker and return YYYY-MM-DD.
            return openNativeDatePicker(currentValue);
          },
          captureAudio: async () => {
            // Connect Expo Audio or the host application's recorder here.
            return { uri: "file:///recordings/va.m4a", mimeType: "audio/mp4" };
          },
          captureImage: async () => openCamera(),
          selectImage: async () => openImageLibrary(),
          selectFile: async (_question, _data, acceptedMimeTypes) => {
            // Connect Expo DocumentPicker and restrict it to acceptedMimeTypes.
            return openDocumentPicker(acceptedMimeTypes);
          }
        }}
        onDraftSaved={(draft) => console.log(`Saved ${draft.id}`)}
        onComplete={(result) => {
          if (result.valid) queueForSubmission(result.data);
        }}
      />
    </SafeAreaView>
  );
}
```

Date picking, audio capture, and draft storage are injected by the host so the module does not force a particular Expo SDK, database, upload service, or file lifecycle. The Save draft button and every Next/Complete press write a UUID-addressed envelope through `draftStore`. If `pickDate` is omitted on native, full-date questions remain usable as validated text inputs with alphabetic, localized months; order follows the locale (`DD-MMM-YYYY`, `MMM-DD-YYYY`, or `YYYY-MMM-DD`). Stored answers always use canonical `YYYY-MM-DD`. Web renderers use the browser's locale-aware native calendar control automatically. Date fields with the WHO `year` appearance, such as `Id10024`, use a four-digit year input rather than the full-date control.

## Reusable question controls

Both `/web` and `/native` export `WhoVaQuestionControls`. Its named components are `Text`, `Integer`, `Date`, `SingleChoice`, `MultipleChoice`, `Confirm`, `Audio`, `Image`, `File`, `Note`, `Calculated`, and `System`; `Control` dispatches from a question's canonical `control` value. These components accept the same question/value/data/issues/onAnswer contract and can be used outside the full form.

WHO text questions with `appearance: "multiline"`, including the detailed open narrative, use a tall multiline input. Image controls support camera/library selection, preview, hide/view, 90-degree rotation, zoom, replace, and remove. File controls request PDF MIME type only and support replace/remove. Web supplies browser selectors; Expo/React Native hosts connect camera, image-library, and document-picker functions through `platform`.

Attachment answers should be durable references such as encrypted app URIs or upload records. The web fallback uses data URLs for standalone operation; production applications should normally persist binary files outside the answer JSON and return a durable reference.

## React web

```tsx
import { WhoVaForm } from "@who-va/instrument/web";

export function VerbalAutopsyPage() {
  return <WhoVaForm onDraftSaved={(draft) => console.log(draft.id)} onComplete={(result) => submit(result.data)} />;
}
```

Web uses `localStorage` by default under `who-va-2022:draft:<uuid>`. Pass `draftId` to continue overwriting a known draft, or pass a custom `draftStore` to use another persistence layer. Audio questions use the browser microphone: press **Record audio**, then **Stop and save recording**. The browser will request microphone permission, and recording requires a secure context (`https://` or localhost).

`localStorage` is unencrypted browser storage. For production VA data, provide a secured storage adapter with the application's encryption, access-control, retention, and device-loss protections.

## Any web application

```ts
import { defineWhoVaElement } from "@who-va/instrument/web-component";

defineWhoVaElement();
```

```html
<who-va-2022-form locale="en"></who-va-2022-form>

<script type="module">
  const form = document.querySelector("who-va-2022-form");
  form.setData(savedDraft);
  form.addEventListener("who-va-draft-saved", event => console.log(event.detail.id));
  form.addEventListener("who-va-complete", event => submit(event.detail.data));
  const assessment = form.validate();
</script>
```

The element exposes `getData()`, `setData(data)`, `getDraftId()`, `validate()`, and `complete()`. Set a `draft-id` attribute before attaching the element to continue a known UUID; otherwise it generates one.

## Web theming

The React web renderer and web component expose namespaced CSS custom properties. Set them on `:root`, an application wrapper, or one form instance; no component fork or `!important` override is needed.

```css
.my-va-page {
  --who-2022-web-color-brand: #275dad;
  --who-2022-web-color-brand-deep: #173b70;
  --who-2022-web-color-brand-soft: #eaf1fb;
  --who-2022-web-color-canvas: #f5f7fb;
  --who-2022-web-color-surface: #ffffff;
  --who-2022-web-color-ink: #172033;
  --who-2022-web-color-muted: #5c667a;
  --who-2022-web-color-border: #dce2eb;
  --who-2022-web-color-control-border: #9aa8bc;
  --who-2022-web-radius-control: 10px;
  --who-2022-web-radius-card: 16px;
  --who-2022-web-form-max-width: 48rem;
  --who-2022-web-form-padding: clamp(1rem, 2.5vw, 1.5rem);
}
```

```html
<section class="my-va-page">
  <who-va-2022-form locale="en"></who-va-2022-form>
</section>
```

All web theme properties use the `--who-2022-web-` namespace. Less commonly needed tokens cover guidance, danger, and image-preview colors: `color-ink-subtle`, `color-guidance`, `color-danger`, `color-danger-border`, `color-danger-strong`, `color-danger-soft`, and `color-image-background`.

The form is mobile-first: it fills the available width with responsive padding, then stops growing at `--who-2022-web-form-max-width` (default `48rem`). The same cap applies in portrait and landscape, preventing long question text and controls from stretching across widescreen displays. Set the token on a wrapper or individual form when a host application needs a narrower measure. `--who-2022-web-form-padding` controls both gutters with one CSS length; `--who-2022-web-form-padding-inline` and `--who-2022-web-form-padding-block` can override the horizontal and vertical gutters independently.

## Headless validation

```ts
import { validateSubmission, whoVa2022Instrument } from "@who-va/instrument";

const assessment = validateSubmission(whoVa2022Instrument, incomingPayload);
if (!assessment.valid) {
  return { status: 422, issues: assessment.issues };
}

await save(assessment.data);
```

This is the same validator used by the native and web form sessions.

When Next or Complete finds validation issues, the shared renderer aligns the first invalid question at the top of the screen and highlights its error card. Web also focuses the first interactive control; Expo and React Native use the question's measured content position with `ScrollView.scrollTo`.

## Source generation and tests

```bash
pnpm dev          # launch the browser preview at http://127.0.0.1:5173
pnpm generate     # XLSForm -> checked-in runtime contract and audit report
pnpm typecheck
pnpm test         # includes one parameterized contract test per named WHO row
pnpm test:e2e     # run Chromium form automation with trace, video, and HTML report
pnpm test:e2e:headed # watch each action at 800 ms and each form sequentially
pnpm test:e2e:report # open the most recent Playwright report
pnpm build
pnpm check
```

Install the pinned Playwright browser once with `pnpm exec playwright install chromium`. The browser suite enters answers through the rendered controls, captures validation errors and corrected states, verifies the visible age summary and calculated values derived from `Id10021`, and confirms valid paths can advance without alerts.

Generated artifacts:

- `src/generated/who-va-2022.instrument.json` — runtime instrument
- `src/generated/who-va-2022.question-audit.json` — human-reviewable question matrix

The question-by-question suite compares the checked-in runtime artifact with the XLSForm and verifies type, coded values, requiredness, relevance AST, constraints, calculations, field validation, and isolated submission validation for each of the 449 named rows.

See [Architecture](docs/architecture.md) for the trust boundaries and extension points.
