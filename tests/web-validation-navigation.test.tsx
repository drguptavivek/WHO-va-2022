// @vitest-environment jsdom

import React from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { InstrumentDefinition } from "../src/index.js";
import { WhoVaForm } from "../src/web.js";

const requiredInstrument: InstrumentDefinition = {
  id: "validation-navigation-test",
  title: "Validation navigation test",
  version: "1",
  defaultLanguage: "English (en)",
  sourceFile: "generated-test-artifact.json",
  sections: [{ name: "details", sourceRow: 1, order: 1, label: { en: "Details" } }],
  questions: [{
    name: "required_name",
    order: 1,
    sourceRow: 2,
    sourceType: "text",
    dataType: "string",
    control: "text",
    label: { en: "Required name" },
    hint: {},
    guidance: {},
    required: true,
    readOnly: false,
    constraintMessage: {},
    sectionPath: ["details"]
  }]
};

afterEach(() => {
  document.body.replaceChildren();
  Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});

describe("validation navigation", () => {
  it("scrolls to and focuses the first invalid question after Next", async () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView
    });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    root.render(<WhoVaForm instrument={requiredInstrument} />);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const next = Array.from(container.querySelectorAll<HTMLElement>('[role="button"]'))
      .find((button) => button.textContent === "Complete");
    next?.click();
    await vi.waitFor(() => expect(scrollIntoView).toHaveBeenCalledOnce());

    const input = container.querySelector<HTMLInputElement>('[data-testid="question-required_name"]');
    expect(document.activeElement).toBe(input);

    root.unmount();
  });
});
