import { defineWhoVaElement } from "@who-va/instrument/web-component";

defineWhoVaElement();

const form = document.querySelector("who-va-2022-form");
form?.addEventListener("who-va-complete", (event) => {
  console.log((event as CustomEvent).detail);
});
