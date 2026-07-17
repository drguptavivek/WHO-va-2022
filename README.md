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
import { WhoVaForm } from "@who-va/instrument/native";

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <WhoVaForm
        initialData={{ Id10010c: "INT-001" }}
        platform={{
          pickDate: async (_question, _data, currentValue) => {
            // Open the host app's native date picker and return YYYY-MM-DD.
            return openNativeDatePicker(currentValue);
          },
          captureAudio: async () => {
            // Connect Expo Audio or the host application's recorder here.
            return { uri: "file:///recordings/va.m4a", mimeType: "audio/mp4" };
          }
        }}
        onChange={(draft) => saveDraftOffline(draft)}
        onComplete={(result) => {
          if (result.valid) queueForSubmission(result.data);
        }}
      />
    </SafeAreaView>
  );
}
```

Date picking, audio capture, and draft storage are injected by the host so the module does not force a particular Expo SDK, database, upload service, or file lifecycle. If `pickDate` is omitted on native, full-date questions remain usable as validated text inputs with alphabetic, localized months; order follows the locale (`DD-MMM-YYYY`, `MMM-DD-YYYY`, or `YYYY-MMM-DD`). Stored answers always use canonical `YYYY-MM-DD`. Web renderers use the browser's locale-aware native calendar control automatically. Date fields with the WHO `year` appearance, such as `Id10024`, use a four-digit year input rather than the full-date control.

## React web

```tsx
import { WhoVaForm } from "@who-va/instrument/web";

export function VerbalAutopsyPage() {
  return <WhoVaForm onComplete={(result) => submit(result.data)} />;
}
```

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
  form.addEventListener("who-va-change", event => saveDraft(event.detail));
  form.addEventListener("who-va-complete", event => submit(event.detail.data));
  const assessment = form.validate();
</script>
```

The element exposes `getData()`, `setData(data)`, `validate()`, and `complete()`.

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

When Next or Complete finds validation issues, the shared renderer scrolls to the first invalid question. Web also focuses the first interactive control; Expo and React Native use the question's measured content position with `ScrollView.scrollTo`.

## Source generation and tests

```bash
pnpm dev          # launch the browser preview at http://127.0.0.1:5173
pnpm generate     # XLSForm -> checked-in runtime contract and audit report
pnpm typecheck
pnpm test         # includes one parameterized contract test per named WHO row
pnpm build
pnpm check
```

Generated artifacts:

- `src/generated/who-va-2022.instrument.json` — runtime instrument
- `src/generated/who-va-2022.question-audit.json` — human-reviewable question matrix

The question-by-question suite compares the checked-in runtime artifact with the XLSForm and verifies type, coded values, requiredness, relevance AST, constraints, calculations, field validation, and isolated submission validation for each of the 449 named rows.

See [Architecture](docs/architecture.md) for the trust boundaries and extension points.
