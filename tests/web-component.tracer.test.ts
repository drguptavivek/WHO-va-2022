// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";

import { defineWhoVaElement, type WhoVaFormElement } from "../src/web-component.js";

afterEach(() => {
  document.body.replaceChildren();
});

describe("framework-independent web embedding", () => {
  it("registers one custom element with imperative data and validation APIs", async () => {
    defineWhoVaElement("who-va-test-form");
    const element = document.createElement("who-va-test-form") as WhoVaFormElement;
    document.body.append(element);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(element.getData().Id10011).toEqual(expect.any(String));
    expect(element.textContent).not.toContain("Once filled in ODK Collect");
    element.setData({ Id10010b: "female" });
    expect(element.getData().Id10010b).toBe("female");
    expect(element.validate().valid).toBe(false);
    expect(() => element.setData({ Id10010b: "invalid" })).toThrow(/WHO choice list/);
  });

  it("routes frontend navigation errors through the shared validator", async () => {
    defineWhoVaElement("who-va-validation-test");
    const element = document.createElement("who-va-validation-test") as WhoVaFormElement;
    let validationDetail: unknown;
    element.addEventListener("who-va-validation", (event) => {
      validationDetail = (event as CustomEvent).detail;
    });
    document.body.append(element);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(element.querySelector('[data-testid="question-Id10010"]')).not.toBeNull();
    const next = [...element.querySelectorAll('[role="button"]')].find((button) => button.textContent === "Next");
    expect(next).toBeDefined();
    next?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(validationDetail).toEqual(expect.arrayContaining([
      expect.objectContaining({ question: "Id10010", code: "required" })
    ]));
  });
});
