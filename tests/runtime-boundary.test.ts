import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { whoVa2022Instrument } from "../src/index.js";

describe("runtime artifact boundary", () => {
  it("loads the complete instrument without reading the XLSForm", () => {
    expect(whoVa2022Instrument.id).toBe("va_who_2022");
    expect(whoVa2022Instrument.questions.length).toBeGreaterThan(400);
  });

  it("does not expose the build-time workbook compiler from the public runtime", async () => {
    const source = await readFile("src/index.ts", "utf8");
    expect(source).not.toContain("compiler/xlsform");
    expect(source).not.toContain("exceljs");
  });
});
