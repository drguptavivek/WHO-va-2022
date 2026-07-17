import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { whoVa2022Instrument } from "../src/index.js";

describe("runtime artifact boundary", () => {
  it("loads the complete instrument without reading the XLSForm", () => {
    expect(whoVa2022Instrument.id).toBe("va_who_2022");
    expect(whoVa2022Instrument.questions.length).toBeGreaterThan(400);
  });

  it("adds the custom medical-certificate upload immediately after Id10473", () => {
    const durationIndex = whoVa2022Instrument.questions.findIndex((question) => question.name === "Id10473");
    const upload = whoVa2022Instrument.questions[durationIndex + 1];

    expect(durationIndex).toBeGreaterThan(-1);
    expect(upload).toMatchObject({
      name: "custom_medical_certificate_upload",
      sourceType: "custom-attachment",
      dataType: "attachment",
      control: "file",
      appearance: "image-or-pdf",
      label: { en: "Upload medical certificate (image or PDF)" },
      required: false,
      sectionPath: ["consented", "deathcert"],
      relevant: expect.objectContaining({ source: "selected(${Id10463}, 'yes')" })
    });
  });

  it("builds from checked-in JSON while workbook tooling remains development-only", async () => {
    const [source, packageSource] = await Promise.all([
      readFile("src/index.ts", "utf8"),
      readFile("package.json", "utf8")
    ]);
    const packageJson = JSON.parse(packageSource) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(source).not.toContain("compiler/xlsform");
    expect(packageJson.scripts).not.toHaveProperty("generate");
    expect(packageJson.scripts?.build).not.toContain("generate");
    expect(packageJson.scripts?.check).not.toContain("generate");
    expect(packageJson.dependencies).not.toHaveProperty("exceljs");
    expect(packageJson.devDependencies).toHaveProperty("exceljs");
  });
});
