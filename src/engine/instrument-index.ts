import type { InstrumentDefinition, InstrumentQuestion, InstrumentSection } from "../types.js";

export interface InstrumentRuntimeIndex {
  questionsByName: ReadonlyMap<string, InstrumentQuestion>;
  questionsBySection: ReadonlyMap<string, readonly InstrumentQuestion[]>;
  sectionsByName: ReadonlyMap<string, InstrumentSection>;
  sectionsWithQuestions: readonly InstrumentSection[];
  calculatedQuestions: readonly InstrumentQuestion[];
  choiceValuesByQuestionName: ReadonlyMap<string, ReadonlySet<string>>;
}

const runtimeIndexes = new WeakMap<InstrumentDefinition, InstrumentRuntimeIndex>();

/** Builds immutable lookup indexes once for each instrument object. */
export function getInstrumentRuntimeIndex(instrument: InstrumentDefinition): InstrumentRuntimeIndex {
  const cached = runtimeIndexes.get(instrument);
  if (cached) return cached;

  const questionsByName = new Map<string, InstrumentQuestion>();
  const questionsBySection = new Map<string, InstrumentQuestion[]>();
  const calculatedQuestions: InstrumentQuestion[] = [];
  const choiceValuesByQuestionName = new Map<string, ReadonlySet<string>>();
  for (const question of instrument.questions) {
    if (!questionsByName.has(question.name)) questionsByName.set(question.name, question);
    const sectionName = question.sectionPath.at(-1);
    if (sectionName) {
      const sectionQuestions = questionsBySection.get(sectionName) ?? [];
      sectionQuestions.push(question);
      questionsBySection.set(sectionName, sectionQuestions);
    }
    if (question.calculation) calculatedQuestions.push(question);
    if (question.choices) {
      choiceValuesByQuestionName.set(question.name, new Set(question.choices.map((choice) => choice.value)));
    }
  }

  const sectionsByName = new Map<string, InstrumentSection>();
  const sectionsWithQuestions: InstrumentSection[] = [];
  for (const section of instrument.sections) {
    if (!sectionsByName.has(section.name)) sectionsByName.set(section.name, section);
    if ((questionsBySection.get(section.name)?.length ?? 0) > 0) sectionsWithQuestions.push(section);
  }
  sectionsWithQuestions.sort((left, right) => {
    const leftOrder = questionsBySection.get(left.name)?.[0]?.order ?? left.order;
    const rightOrder = questionsBySection.get(right.name)?.[0]?.order ?? right.order;
    return leftOrder - rightOrder;
  });

  const index: InstrumentRuntimeIndex = {
    questionsByName,
    questionsBySection,
    sectionsByName,
    sectionsWithQuestions,
    calculatedQuestions,
    choiceValuesByQuestionName
  };
  runtimeIndexes.set(instrument, index);
  return index;
}
