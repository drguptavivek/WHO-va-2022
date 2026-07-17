import { describe, expect, it } from "vitest";

import hindi from "../src/languages/hi.js";
import { WHO_VA_2022_LANGUAGES, loadWhoVa2022Language } from "../src/instrument-loader.js";
import { whoVa2022Instrument } from "../src/instrument.js";
import type { QuestionTranslation } from "../src/i18n.js";

describe("built-in Hindi language", () => {
  it("covers every English instrument string", () => {
    const translatedSections = hindi.instrument.sections as Record<string, string>;
    const translatedQuestions = hindi.instrument.questions as Record<string, QuestionTranslation>;
    for (const section of whoVa2022Instrument.sections) {
      if (section.label.en) expect(translatedSections[section.name]).toBeTruthy();
    }
    for (const question of whoVa2022Instrument.questions) {
      const translated = translatedQuestions[question.name];
      for (const field of ["label", "hint", "guidance", "constraintMessage"] as const) {
        if (question[field].en) expect(translated?.[field], `${question.name}.${field}`).toBeTruthy();
      }
      for (const choice of question.choices ?? []) {
        if (choice.label.en) expect(translated?.choices?.[choice.value], `${question.name}.${choice.value}`).toBeTruthy();
      }
    }
  });

  it("loads Hindi lazily while preserving identifiers and interpolation placeholders", async () => {
    const loaded = await loadWhoVa2022Language("hi-IN");
    const childAge = loaded.instrument.questions.find((question) => question.name === "displayAgeChild");

    expect(loaded.locale).toBe("hi");
    expect(loaded.instrument.questions.map((question) => question.name)).toEqual(
      whoVa2022Instrument.questions.map((question) => question.name)
    );
    expect(childAge?.label.hi).toContain("${ageInYears}");
    expect(loaded.uiTranslations.hi?.next).toBe("आगे");
  });

  it("exposes every available built-in language", async () => {
    expect(WHO_VA_2022_LANGUAGES.map(({ locale }) => locale)).toEqual(["en", "fr", "hi"]);

    const french = await loadWhoVa2022Language("fr-FR");
    expect(french.locale).toBe("fr");
    const frenchLabel = french.instrument.questions.find((question) => question.name === "Id10010")?.label.fr;
    expect(frenchLabel).toContain("(Id10010)");
    expect(frenchLabel).not.toBe(whoVa2022Instrument.questions.find((question) => question.name === "Id10010")?.label.en);
    expect(french.uiTranslations.fr?.next).toBe("Suivant");
  });
});
