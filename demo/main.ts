import { defineWhoVaElement, type WhoVaFormElement } from "../src/web-component.js";

defineWhoVaElement();

const form = document.querySelector<WhoVaFormElement>("#who-va-form");
const status = document.querySelector<HTMLElement>("#status");

form?.addEventListener("who-va-change", () => {
  if (status) status.textContent = "Unsaved changes";
});

form?.addEventListener("who-va-draft-saved", (event) => {
  const draft = (event as CustomEvent<{ id: string }>).detail;
  if (status && !status.textContent?.includes("need attention")) {
    status.textContent = `Draft ${draft.id} saved locally`;
  }
});

form?.addEventListener("who-va-validation", (event) => {
  const issues = (event as CustomEvent<Array<unknown>>).detail;
  if (status) status.textContent = `${issues.length} field${issues.length === 1 ? "" : "s"} need attention`;
});

form?.addEventListener("who-va-complete", (event) => {
  const result = (event as CustomEvent<{ valid: boolean }>).detail;
  if (status) status.textContent = result.valid ? "Submission is valid" : "Submission needs attention";
});
