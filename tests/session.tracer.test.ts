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

  it("allows a temporary constraint-invalid value while the interviewer is typing", () => {
    const session = createWhoVaSession(whoVa2022Instrument);

    expect(() => session.setAnswer("Id10010a", 3)).not.toThrow();
    expect(session.getSnapshot().data.Id10010a).toBe(3);
    expect(session.getSnapshot().issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ question: "Id10010a", code: "constraint" })
    ]));

    session.setAnswer("Id10010a", 33);
    expect(session.getSnapshot().issues.some((issue) => issue.question === "Id10010a")).toBe(false);
  });

  it("keeps interview completion after the consented questionnaire sections", () => {
    const sectionNames = new Set(["stillbirth", "injuries_accidents", "consented"]);
    const questionNames = new Set(["Id10104", "nmh", "Id10077", "Id10481", "noteend", "comment"]);
    const instrument = {
      ...whoVa2022Instrument,
      sections: whoVa2022Instrument.sections.filter((section) => sectionNames.has(section.name)),
      questions: whoVa2022Instrument.questions.filter((question) => questionNames.has(question.name))
    };
    const session = createWhoVaSession(instrument, {
      initialData: { Id10013: "yes", isNeonatal: "1", Id10114: "no" }
    });

    expect(session.getSnapshot().currentSection.name).toBe("stillbirth");
    session.setAnswer("Id10104", "yes");
    expect(session.next().advanced).toBe(true);

    const injuries = session.getSnapshot();
    expect(injuries.currentSection.name).toBe("injuries_accidents");
    expect(injuries.questions.map((question) => question.name)).toEqual(["nmh", "Id10077"]);

    session.setAnswer("Id10077", "no");
    expect(session.next().advanced).toBe(true);
    expect(session.getSnapshot().currentSection).toMatchObject({
      name: "consented",
      label: { en: "Interview completion" }
    });
    expect(session.getSnapshot().questions.map((question) => question.name)).toEqual(["noteend", "comment"]);
  });
});
