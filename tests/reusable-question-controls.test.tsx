// @vitest-environment jsdom

import React from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AttachmentProcessingError,
  resolveUiMessages,
  whoVa2022Instrument,
  type InstrumentQuestion
} from "../src/index.js";
import frenchLanguage from "../src/languages/fr.js";
import hindiLanguage from "../src/languages/hi.js";
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

    expect(container.querySelector<HTMLInputElement>('[data-testid="question-standalone_text"]')?.value).toBe(
      "Existing answer"
    );
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
        question={{
          ...textQuestion,
          name: "photo",
          sourceType: "image",
          dataType: "attachment",
          control: "image"
        }}
        value={{ uri: "data:image/png;base64,iVBORw0KGgo=", name: "certificate.png", mimeType: "image/png" }}
        data={{}}
        locale="en"
        issues={[]}
        onAnswer={vi.fn()}
      />
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(container.querySelector('[data-testid="question-photo-preview"]')).not.toBeNull();
    for (const action of [
      "Camera",
      "Replace image",
      "Hide image",
      "Rotate",
      "Zoom in",
      "Zoom out",
      "Remove image"
    ]) {
      expect(container.textContent).toContain(action);
    }
    const action = (label: string) =>
      Array.from(container.querySelectorAll<HTMLElement>('[role="button"]')).find(
        (button) => button.textContent === label
      );
    action("Rotate")?.click();
    await vi.waitFor(() =>
      expect(
        container.querySelector<HTMLElement>('[data-testid="question-photo-preview"]')?.style.transform
      ).toContain("rotate(90deg)")
    );
    action("Zoom in")?.click();
    await vi.waitFor(() =>
      expect(
        container.querySelector<HTMLElement>('[data-testid="question-photo-preview"]')?.style.transform
      ).toContain("scale(1.25)")
    );
    action("Hide image")?.click();
    await vi.waitFor(() =>
      expect(container.querySelector('[data-testid="question-photo-preview"]')).toBeNull()
    );
    action("View image")?.click();
    await vi.waitFor(() =>
      expect(container.querySelector('[data-testid="question-photo-preview"]')).not.toBeNull()
    );
    root.unmount();
  });

  it("localizes reusable audio, image, and file workflows", async () => {
    const frenchMessages = resolveUiMessages("fr", { fr: frenchLanguage.ui });
    const hindiMessages = resolveUiMessages("hi", { hi: hindiLanguage.ui });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    root.render(
      <>
        <WhoVaQuestionControls.Audio
          question={{
            ...textQuestion,
            name: "audio",
            sourceType: "audio",
            dataType: "attachment",
            control: "audio"
          }}
          value={undefined}
          data={{}}
          locale="fr"
          messages={frenchMessages}
          issues={[]}
          onAnswer={vi.fn()}
        />
        <WhoVaQuestionControls.Image
          question={{
            ...textQuestion,
            name: "photo",
            sourceType: "image",
            dataType: "attachment",
            control: "image"
          }}
          value={{ uri: "data:image/png;base64,iVBORw0KGgo=", mimeType: "image/png" }}
          data={{}}
          locale="fr"
          messages={frenchMessages}
          issues={[]}
          onAnswer={vi.fn()}
        />
        <WhoVaQuestionControls.File
          question={{
            ...textQuestion,
            name: "document",
            sourceType: "file",
            dataType: "attachment",
            control: "file"
          }}
          value={undefined}
          data={{}}
          locale="hi"
          messages={hindiMessages}
          issues={[]}
          onAnswer={vi.fn()}
        />
      </>
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(container.textContent).toContain("Enregistrer un audio");
    expect(container.textContent).toContain("Remplacer l’image");
    expect(container.textContent).toContain("PDF चुनें");
    expect(container.textContent).not.toContain("Record audio");
    expect(container.textContent).not.toContain("Replace image");
    expect(container.textContent).not.toContain("Choose PDF");
    root.unmount();
  });

  it("processes a selected JPG before returning it as the image answer", async () => {
    const rawJpg = {
      uri: "file:///picker/death-certificate.jpg",
      name: "death-certificate.jpg",
      mimeType: "image/jpeg",
      size: 3_000_000
    };
    const processedJpg = {
      id: "processed-jpg",
      uri: "who-va-attachment:processed-jpg",
      name: "processed-jpg.jpg",
      originalName: "death-certificate.jpg",
      mimeType: "image/jpeg",
      size: 800_000,
      width: 1600,
      height: 1200,
      processed: true
    };
    const selectImage = vi.fn().mockResolvedValue(rawJpg);
    const processImage = vi.fn().mockResolvedValue(processedJpg);
    const onAnswer = vi.fn();
    const question = {
      ...textQuestion,
      name: "photo",
      sourceType: "image" as const,
      dataType: "attachment" as const,
      control: "image" as const
    };
    const data = { existing_answer: "kept" };
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    root.render(
      <WhoVaQuestionControls.Image
        question={question}
        value={undefined}
        data={data}
        locale="en"
        issues={[]}
        platform={{ selectImage, processImage }}
        onAnswer={onAnswer}
      />
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    Array.from(container.querySelectorAll<HTMLElement>('[role="button"]'))
      .find((button) => button.textContent === "Choose image")
      ?.click();

    await vi.waitFor(() => expect(onAnswer).toHaveBeenCalledWith(processedJpg));
    expect(selectImage).toHaveBeenCalledWith(question, data);
    expect(processImage).toHaveBeenCalledWith(
      rawJpg,
      expect.objectContaining({ acceptedMimeTypes: ["image/jpeg", "image/png"] }),
      question,
      data
    );
    root.unmount();
  });

  it("shows a realtime processing error and does not retain a rejected image", async () => {
    const onAnswer = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    root.render(
      <WhoVaQuestionControls.Image
        question={{
          ...textQuestion,
          name: "photo",
          sourceType: "image",
          dataType: "attachment",
          control: "image"
        }}
        value={undefined}
        data={{}}
        locale="en"
        issues={[]}
        platform={{
          selectImage: vi.fn().mockRejectedValue(new AttachmentProcessingError("image-type-not-allowed"))
        }}
        onAnswer={onAnswer}
      />
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    const chooseImage = Array.from(container.querySelectorAll<HTMLElement>('[role="button"]')).find(
      (button) => button.textContent === "Choose image"
    );
    chooseImage?.click();

    await vi.waitFor(() =>
      expect(container.querySelector('[role="alert"]')?.textContent).toContain(
        "Choose a valid JPEG or PNG image"
      )
    );
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
        question={{
          ...textQuestion,
          name: "photo",
          sourceType: "image",
          dataType: "attachment",
          control: "image"
        }}
        value={undefined}
        data={{}}
        locale="en"
        issues={[]}
        platform={{
          selectImage: vi.fn().mockResolvedValue({ uri: "file:///camera/raw.heic", name: "raw.heic" })
        }}
        onAnswer={onAnswer}
      />
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    Array.from(container.querySelectorAll<HTMLElement>('[role="button"]'))
      .find((button) => button.textContent === "Choose image")
      ?.click();

    await vi.waitFor(() =>
      expect(container.querySelector('[role="alert"]')?.textContent).toContain(
        "Image processing is unavailable"
      )
    );
    expect(onAnswer).not.toHaveBeenCalled();
    root.unmount();
  });

  it("limits file selection to PDFs and processes the selection before returning the answer", async () => {
    const rawPdf = {
      uri: "file:///picker/report.pdf",
      name: "report.pdf",
      mimeType: "application/pdf",
      size: 120_000
    };
    const processedPdf = {
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
    const selectFile = vi.fn().mockResolvedValue(rawPdf);
    const processPdf = vi.fn().mockResolvedValue(processedPdf);
    const onAnswer = vi.fn();
    const question = {
      ...textQuestion,
      name: "document",
      sourceType: "file" as const,
      dataType: "attachment" as const,
      control: "file" as const
    };
    const data = { existing_answer: "kept" };
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    root.render(
      <WhoVaQuestionControls.File
        question={question}
        value={undefined}
        data={data}
        locale="en"
        issues={[]}
        platform={{ selectFile, processPdf }}
        onAnswer={onAnswer}
      />
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    const choosePdf = Array.from(container.querySelectorAll<HTMLElement>('[role="button"]')).find(
      (button) => button.textContent === "Choose PDF"
    );
    choosePdf?.click();
    await vi.waitFor(() => expect(onAnswer).toHaveBeenCalledWith(processedPdf));
    expect(selectFile).toHaveBeenCalledWith(question, data, ["application/pdf"]);
    expect(processPdf).toHaveBeenCalledWith(rawPdf, question, data);
    root.unmount();
  });

  it.each([
    {
      kind: "JPG",
      raw: {
        uri: "file:///picker/certificate.jpg",
        name: "certificate.jpg",
        mimeType: "image/jpeg",
        size: 120_000
      },
      processed: {
        id: "certificate-image",
        uri: "who-va-attachment:certificate-image",
        name: "certificate-image.jpg",
        originalName: "certificate.jpg",
        mimeType: "image/jpeg",
        size: 90_000,
        width: 1200,
        height: 800,
        processed: true
      },
      processor: "image"
    },
    {
      kind: "PDF",
      raw: {
        uri: "file:///picker/certificate.pdf",
        name: "certificate.pdf",
        mimeType: "application/pdf",
        size: 120_000
      },
      processed: {
        uri: "who-va-pdf-pages:certificate",
        name: "certificate-pages",
        originalName: "certificate.pdf",
        mimeType: "application/vnd.who-va.pdf-pages+json",
        pageCount: 1,
        size: 90_000,
        originalRetained: false,
        processed: true,
        pages: [{ uri: "who-va-attachment:certificate-page-001", mimeType: "image/jpeg" }]
      },
      processor: "pdf"
    }
  ])("accepts and processes a $kind medical-certificate upload", async ({ raw, processed, processor }) => {
    const question = whoVa2022Instrument.questions.find(
      (candidate) => candidate.name === "custom_medical_certificate_upload"
    );
    expect(question).toBeDefined();
    const selectFile = vi.fn().mockResolvedValue(raw);
    const processImage = vi.fn().mockResolvedValue(processed);
    const processPdf = vi.fn().mockResolvedValue(processed);
    const onAnswer = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    root.render(
      <WhoVaQuestionControls.File
        question={question as InstrumentQuestion}
        value={undefined}
        data={{}}
        locale="en"
        issues={[]}
        platform={{ selectFile, processImage, processPdf }}
        onAnswer={onAnswer}
      />
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    container
      .querySelector<HTMLElement>('[data-testid="question-custom_medical_certificate_upload"]')
      ?.click();

    await vi.waitFor(() => expect(onAnswer).toHaveBeenCalledWith(processed));
    expect(selectFile).toHaveBeenCalledWith(question, {}, ["image/jpeg", "image/png", "application/pdf"]);
    if (processor === "image") {
      expect(processImage).toHaveBeenCalledWith(raw, expect.anything(), question, {});
      expect(processPdf).not.toHaveBeenCalled();
    } else {
      expect(processPdf).toHaveBeenCalledWith(raw, question, {});
      expect(processImage).not.toHaveBeenCalled();
    }
    root.unmount();
  });
});
