// @vitest-environment jsdom

import React from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { whoVa2022Instrument, type InstrumentQuestion } from "../src/index.js";
import { WhoVaQuestionControls } from "../src/web.js";

const textQuestion: InstrumentQuestion = {
  name: "standalone_text",
  order: 1,
  sourceRow: 1,
  sourceType: "text",
  dataType: "string",
  control: "text",
  label: { en: "Standalone text" },
  hint: {},
  guidance: {},
  required: false,
  readOnly: false,
  constraintMessage: {},
  sectionPath: ["standalone"]
};

afterEach(() => document.body.replaceChildren());

describe("reusable question controls", () => {
  it("exports a reusable component for every supported question control", () => {
    expect(Object.keys(WhoVaQuestionControls)).toEqual([
      "Control",
      "Text",
      "Integer",
      "Date",
      "SingleChoice",
      "MultipleChoice",
      "Confirm",
      "Audio",
      "Image",
      "File",
      "Note",
      "Calculated",
      "System"
    ]);
  });

  it("renders the text control independently of the full form", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    root.render(
      <WhoVaQuestionControls.Text
        question={textQuestion}
        value="Existing answer"
        data={{ standalone_text: "Existing answer" }}
        locale="en"
        issues={[]}
        onAnswer={vi.fn()}
      />
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(container.querySelector<HTMLInputElement>('[data-testid="question-standalone_text"]')?.value).toBe("Existing answer");
    root.unmount();
  });

  it("renders detailed narrative questions as multiline text fields", async () => {
    const narrativeQuestion = whoVa2022Instrument.questions.find((question) => question.name === "Id10476");
    expect(narrativeQuestion?.appearance).toBe("multiline");
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    root.render(
      <WhoVaQuestionControls.Text
        question={narrativeQuestion as InstrumentQuestion}
        value={undefined}
        data={{}}
        locale="en"
        issues={[]}
        onAnswer={vi.fn()}
      />
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(container.querySelector('textarea[data-testid="question-Id10476"]')).not.toBeNull();
    root.unmount();
  });

  it("renders reusable image preview, rotate, zoom, view, camera, and library actions", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    root.render(
      <WhoVaQuestionControls.Image
        question={{ ...textQuestion, name: "photo", sourceType: "image", dataType: "attachment", control: "image" }}
        value={{ uri: "data:image/png;base64,iVBORw0KGgo=", name: "certificate.png", mimeType: "image/png" }}
        data={{}}
        locale="en"
        issues={[]}
        onAnswer={vi.fn()}
      />
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(container.querySelector('[data-testid="question-photo-preview"]')).not.toBeNull();
    for (const action of ["Camera", "Replace image", "Hide image", "Rotate", "Zoom in", "Zoom out", "Remove image"]) {
      expect(container.textContent).toContain(action);
    }
    const action = (label: string) => Array.from(container.querySelectorAll<HTMLElement>('[role="button"]'))
      .find((button) => button.textContent === label);
    action("Rotate")?.click();
    await vi.waitFor(() => expect(
      container.querySelector<HTMLElement>('[data-testid="question-photo-preview"]')?.style.transform
    ).toContain("rotate(90deg)"));
    action("Zoom in")?.click();
    await vi.waitFor(() => expect(
      container.querySelector<HTMLElement>('[data-testid="question-photo-preview"]')?.style.transform
    ).toContain("scale(1.25)"));
    action("Hide image")?.click();
    await vi.waitFor(() => expect(container.querySelector('[data-testid="question-photo-preview"]')).toBeNull());
    action("View image")?.click();
    await vi.waitFor(() => expect(container.querySelector('[data-testid="question-photo-preview"]')).not.toBeNull());
    root.unmount();
  });

  it("limits the reusable file selector to PDFs and returns the attachment", async () => {
    const selectedPdf = { uri: "app://documents/report.pdf", name: "report.pdf", mimeType: "application/pdf" };
    const selectFile = vi.fn().mockResolvedValue(selectedPdf);
    const onAnswer = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    root.render(
      <WhoVaQuestionControls.File
        question={{ ...textQuestion, name: "document", sourceType: "file", dataType: "attachment", control: "file" }}
        value={undefined}
        data={{}}
        locale="en"
        issues={[]}
        platform={{ selectFile }}
        onAnswer={onAnswer}
      />
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    const choosePdf = Array.from(container.querySelectorAll<HTMLElement>('[role="button"]'))
      .find((button) => button.textContent === "Choose PDF");
    choosePdf?.click();
    await vi.waitFor(() => expect(onAnswer).toHaveBeenCalledWith(selectedPdf));
    expect(selectFile).toHaveBeenCalledWith(expect.objectContaining({ name: "document" }), {}, ["application/pdf"]);
    root.unmount();
  });
});
