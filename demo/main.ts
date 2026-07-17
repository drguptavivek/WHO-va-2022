import { defineWhoVaElement, type WhoVaFormElement } from "../src/web-component.js";
import { WHO_VA_2022_LANGUAGES } from "../src/instrument-loader.js";

defineWhoVaElement();

const form = document.querySelector<WhoVaFormElement>("#who-va-form");
const language = document.querySelector<HTMLSelectElement>("#language");

for (const availableLanguage of WHO_VA_2022_LANGUAGES) {
  const option = document.createElement("option");
  option.value = availableLanguage.locale;
  option.textContent = availableLanguage.label;
  option.selected = availableLanguage.locale === (form?.getAttribute("locale") ?? "en");
  language?.append(option);
}

language?.addEventListener("change", () => {
  form?.setAttribute("locale", language.value);
  document.documentElement.lang = language.value;
});
