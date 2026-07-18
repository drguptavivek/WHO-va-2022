// @vitest-environment jsdom

import React from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { createWhoVaSession, type InstrumentDefinition } from "../src/index.js";
import { WhoVaForm } from "../src/web.js";

const previewInstrument: InstrumentDefinition = {
  id: "preview-test",
  title: "Preview test",
  version: "1",
  defaultLanguage: "English (en)",
  sourceFile: "generated-test-artifact.json",
  sections: [
    { name: "identity", sourceRow: 1, order: 1, label: { en: "Identity" } },
    { name: "history", sourceRow: 3, order: 2, label: { en: "History" } }
  ],
  questions: [
    {
      name: "name",
      order: 1,
      sourceRow: 2,
      sourceType: "text",
      dataType: "string",
      control: "text",
      label: { en: "Name" },
      hint: {},
      guidance: {},
      required: false,
      readOnly: false,
      constraintMessage: {},
      sectionPath: ["identity"]
    },
    {
      name: "symptom",
      order: 2,
      sourceRow: 4,
      sourceType: "select_one symptom",
      dataType: "string",
      control: "singleChoice",
      label: { en: "Main symptom" },
      hint: {},
      guidance: {},
      required: false,
      readOnly: false,
      constraintMessage: {},
      choices: [
        { value: "fever", sourceRow: 5, label: { en: "Fever" } },
        { value: "cough", sourceRow: 6, label: { en: "Cough" } }
      ],
      sectionPath: ["history"]
    }
  ]
};

afterEach(() => {
  document.body.replaceChildren();
  history.replaceState(null, "");
});

function button(container: HTMLElement, label: string): HTMLElement | undefined {
  return Array.from(container.querySelectorAll<HTMLElement>('[role="button"]')).find(
    (candidate) => candidate.textContent === label
  );
}

describe("answer preview", () => {
  it("keeps answers out of browser history state", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const session = createWhoVaSession(previewInstrument, {
      initialData: { name: "Sensitive respondent name" }
    });

    root.render(<WhoVaForm instrument={previewInstrument} session={session} />);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(JSON.stringify(history.state)).not.toContain("Sensitive respondent name");
    expect(JSON.stringify(history.state)).not.toContain('"data"');
    root.unmount();
  });

  it("returns to the same section with responses preserved", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const session = createWhoVaSession(previewInstrument, { initialData: { name: "Amina" } });
    expect(session.next().advanced).toBe(true);
    session.setAnswer("symptom", "fever");
    root.render(<WhoVaForm instrument={previewInstrument} session={session} />);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(container.textContent).toContain("Section 2 of 2");
    button(container, "Preview answers")?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(container.textContent).toContain("Answer preview");
    expect(container.textContent).toContain("Name");
    expect(container.textContent).toContain("Amina");
    expect(container.textContent).toContain("Main symptom");
    expect(container.textContent).toContain("Fever");

    button(container, "Back to form")?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(container.textContent).toContain("Section 2 of 2");
    expect(session.getSnapshot().data.symptom).toBe("fever");
    root.unmount();
  });

  it("restores the preview and current section after a browser reload", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const session = createWhoVaSession(previewInstrument, { initialData: { name: "Amina" } });
    expect(session.next().advanced).toBe(true);
    session.setAnswer("symptom", "fever");

    const firstRoot = createRoot(container);
    firstRoot.render(<WhoVaForm instrument={previewInstrument} session={session} />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    button(container, "Preview answers")?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container.textContent).toContain("Answer preview");
    firstRoot.unmount();

    const reloadedRoot = createRoot(container);
    reloadedRoot.render(<WhoVaForm instrument={previewInstrument} />);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(container.textContent).toContain("Answer preview");
    expect(container.textContent).toContain("Amina");
    expect(container.textContent).toContain("Fever");
    button(container, "Back to form")?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container.textContent).toContain("Section 2 of 2");
    reloadedRoot.unmount();
  });
});
