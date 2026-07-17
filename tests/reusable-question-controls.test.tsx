// @vitest-environment jsdom

import React from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AttachmentProcessingError, whoVa2022Instrument, type InstrumentQuestion } from "../src/index.js";
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

  it("shows a realtime processing error and does not retain a rejected image", async () => {
    const onAnswer = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    root.render(
      <WhoVaQuestionControls.Image
        question={{ ...textQuestion, name: "photo", sourceType: "image", dataType: "attachment", control: "image" }}
        value={undefined}
        data={{}}
        locale="en"
        issues={[]}
        platform={{ selectImage: vi.fn().mockRejectedValue(new AttachmentProcessingError("image-type-not-allowed")) }}
        onAnswer={onAnswer}
      />
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    const chooseImage = Array.from(container.querySelectorAll<HTMLElement>('[role="button"]'))
      .find((button) => button.textContent === "Choose image");
    chooseImage?.click();

    await vi.waitFor(() => expect(container.querySelector('[role="alert"]')?.textContent)
      .toContain("Choose a valid JPEG or PNG image"));
    expect(onAnswer).not.toHaveBeenCalled();
    root.unmount();
  });

  it("does not accept an unprocessed native image reference", async () => {
    const onAnswer = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    root.render(
      <WhoVaQuestionControls.Image
        question={{ ...textQuestion, name: "photo", sourceType: "image", dataType: "attachment", control: "image" }}
        value={undefined}
        data={{}}
        locale="en"
        issues={[]}
        platform={{ selectImage: vi.fn().mockResolvedValue({ uri: "file:///camera/raw.heic", name: "raw.heic" }) }}
        onAnswer={onAnswer}
      />
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    Array.from(container.querySelectorAll<HTMLElement>('[role="button"]'))
      .find((button) => button.textContent === "Choose image")?.click();

    await vi.waitFor(() => expect(container.querySelector('[role="alert"]')?.textContent)
      .toContain("Image processing is unavailable"));
    expect(onAnswer).not.toHaveBeenCalled();
    root.unmount();
  });

  it("limits the reusable file selector to PDFs and returns the attachment", async () => {
    const selectedPdf = {
      uri: "who-va-pdf-pages:report",
      name: "report-pages",
      originalName: "report.pdf",
      mimeType: "application/vnd.who-va.pdf-pages+json",
      pageCount: 1,
      size: 24,
      originalRetained: false,
      processed: true,
      pages: [{ uri: "who-va-attachment:report-page-001", mimeType: "image/jpeg" }]
    };
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
