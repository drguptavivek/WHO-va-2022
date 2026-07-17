import { describe, expect, it } from "vitest";

import { compileWhoVaWorkbook } from "../src/compiler/xlsform.js";

describe("WHO XLSForm compiler tracer", () => {
  it("preserves the interviewer sex question type and coded choices", async () => {
    const instrument = await compileWhoVaWorkbook("whova2022_xls_form_for_odk.xlsx");
    const question = instrument.questions.find((item) => item.name === "Id10010b");

    expect(question).toMatchObject({
      name: "Id10010b",
      sourceType: "select_one select_2",
      dataType: "string",
      control: "singleChoice",
      required: true,
      choices: [
        { value: "female", label: { en: "Female" } },
        { value: "male", label: { en: "Male" } },
        { value: "undetermined", label: { en: "Ambiguous/Intersex" } }
      ]
    });
  });

  it("preserves formula-backed read-only flags", async () => {
    const instrument = await compileWhoVaWorkbook("whova2022_xls_form_for_odk.xlsx");
    expect(instrument.questions.find((item) => item.name === "Id10120")?.readOnly).toBe(true);
  });

  it("provides interviewer-facing text for every WHO constraint", async () => {
    const instrument = await compileWhoVaWorkbook("whova2022_xls_form_for_odk.xlsx");
    const missingMessages = instrument.questions
      .filter((question) => question.constraint && !question.constraintMessage.en)
      .map((question) => question.name);

    expect(missingMessages).toEqual([]);
    expect(instrument.questions.find((question) => question.name === "Id10023_b")?.constraintMessage.en)
      .toBe("Date of death cannot be in the future.");
  });
});
