import type {
  InstrumentDefinition,
  InstrumentQuestion,
  InstrumentSection
} from "../types.js";

export interface InstrumentRuntimeIndex {
  questionsByName: ReadonlyMap<string, InstrumentQuestion>;
  questionsBySection: ReadonlyMap<string, readonly InstrumentQuestion[]>;
  sectionsByName: ReadonlyMap<string, InstrumentSection>;
  calculatedQuestions: readonly InstrumentQuestion[];
}

const runtimeIndexes = new WeakMap<InstrumentDefinition, InstrumentRuntimeIndex>();

/** Builds immutable lookup indexes once for each instrument object. */
export function getInstrumentRuntimeIndex(instrument: InstrumentDefinition): InstrumentRuntimeIndex {
  const cached = runtimeIndexes.get(instrument);
  if (cached) return cached;

  const questionsByName = new Map<string, InstrumentQuestion>();
  const questionsBySection = new Map<string, InstrumentQuestion[]>();
  const calculatedQuestions: InstrumentQuestion[] = [];
  for (const question of instrument.questions) {
    if (!questionsByName.has(question.name)) questionsByName.set(question.name, question);
    const sectionName = question.sectionPath.at(-1);
    if (sectionName) {
      const sectionQuestions = questionsBySection.get(sectionName) ?? [];
      sectionQuestions.push(question);
      questionsBySection.set(sectionName, sectionQuestions);
    }
    if (question.calculation) calculatedQuestions.push(question);
  }

  const sectionsByName = new Map<string, InstrumentSection>();
  for (const section of instrument.sections) {
    if (!sectionsByName.has(section.name)) sectionsByName.set(section.name, section);
  }

  const index: InstrumentRuntimeIndex = {
    questionsByName,
    questionsBySection,
    sectionsByName,
    calculatedQuestions
  };
  runtimeIndexes.set(instrument, index);
  return index;
}
