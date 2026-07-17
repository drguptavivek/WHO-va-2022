import { describe, expect, it } from "vitest";

import { createWhoVaSession, whoVa2022Instrument } from "../src/index.js";

describe("universal instrument session", () => {
  it("initializes system metadata and exposes the first WHO section", () => {
    const now = new Date("2026-07-17T10:30:00.000Z");
    const session = createWhoVaSession(whoVa2022Instrument, { now: () => now });
    const snapshot = session.getSnapshot();

    expect(snapshot.currentSection.name).toBe("Interviewer");
    expect(snapshot.data.Id10012).toBe("2026-07-17");
    expect(snapshot.data.Id10011).toBe(now.toISOString());
  });

  it("uses the same validator before navigation and submission", () => {
    const session = createWhoVaSession(whoVa2022Instrument);
    expect(session.next().advanced).toBe(false);
    expect(session.getSnapshot().issues.some((issue) => issue.question === "Id10010" && issue.code === "required")).toBe(true);

    session.setAnswer("Id10010", "Interviewer One");
    session.setAnswer("Id10010a", 35);
    session.setAnswer("Id10010b", "female");
    session.setAnswer("Id10010c", "INT-1");
    session.setAnswer("language", "1");

    expect(session.next().advanced).toBe(true);
    expect(session.getSnapshot().currentSection.name).toBe("presets");
  });

  it("rejects values outside the question contract before mutating state", () => {
    const session = createWhoVaSession(whoVa2022Instrument);
    expect(() => session.setAnswer("Id10010b", "not-a-choice")).toThrow(/WHO choice list/);
    expect(session.getSnapshot().data.Id10010b).toBeUndefined();
  });
});
