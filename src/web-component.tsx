import React from "react";
import { createRoot, type Root } from "react-dom/client";

import { createWhoVaSession } from "./engine/session.js";
import { whoVa2022Instrument } from "./instrument.js";
import type { SubmissionData, SubmissionValidationResult, WhoVaSession } from "./types.js";
import { WhoVaForm } from "./web.js";

export class WhoVaFormElement extends HTMLElement {
  static get observedAttributes() { return ["locale"]; }

  private root: Root | undefined;
  private readonly session: WhoVaSession;

  constructor() {
    super();
    this.session = createWhoVaSession(whoVa2022Instrument);
  }

  connectedCallback(): void {
    this.renderForm();
  }

  disconnectedCallback(): void {
    this.root?.unmount();
    this.root = undefined;
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.renderForm();
  }

  getData(): SubmissionData {
    return this.session.getSnapshot().data;
  }

  setData(data: SubmissionData): void {
    this.session.replaceData(data);
  }

  validate(): SubmissionValidationResult {
    return this.session.validate();
  }

  complete(): SubmissionValidationResult {
    return this.session.complete();
  }

  private renderForm(): void {
    this.root ??= createRoot(this);
    this.root.render(
      <WhoVaForm
        session={this.session}
        locale={this.getAttribute("locale") ?? "en"}
        onChange={(data) => this.dispatchEvent(new CustomEvent("who-va-change", { detail: data, bubbles: true }))}
        onValidation={(issues) => this.dispatchEvent(new CustomEvent("who-va-validation", { detail: issues, bubbles: true }))}
        onComplete={(result) => this.dispatchEvent(new CustomEvent("who-va-complete", { detail: result, bubbles: true }))}
      />
    );
  }
}

export function defineWhoVaElement(tagName = "who-va-2022-form"): typeof WhoVaFormElement {
  const existing = customElements.get(tagName);
  if (existing) return existing as typeof WhoVaFormElement;
  const RegisteredWhoVaFormElement = class extends WhoVaFormElement {};
  customElements.define(tagName, RegisteredWhoVaFormElement);
  return RegisteredWhoVaFormElement;
}

export * from "./web.js";
