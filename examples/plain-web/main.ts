import { defineWhoVaElement } from "@drguptavivek/who-2022-va/web-component";

defineWhoVaElement();

const form = document.querySelector("who-va-2022-form");
form?.addEventListener("who-va-complete", (event) => {
  console.log((event as CustomEvent).detail);
});
