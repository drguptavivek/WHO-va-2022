import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { compileWhoVaWorkbook } from "../src/compiler/xlsform.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(repositoryRoot, "whova2022_xls_form_for_odk.xlsx");
const generatedDirectory = path.join(repositoryRoot, "src", "generated");

const instrument = await compileWhoVaWorkbook(source);
const audit = {
  generatedFrom: instrument.sourceFile,
  instrumentId: instrument.id,
  instrumentVersion: instrument.version,
  sectionCount: instrument.sections.length,
  questionCount: instrument.questions.length,
  questions: instrument.questions.map((question) => ({
    name: question.name,
    sourceRow: question.sourceRow,
    sourceType: question.sourceType,
    dataType: question.dataType,
    control: question.control,
    required: question.required,
    choiceValues: question.choices?.map((choice) => choice.value) ?? [],
    relevant: question.relevant?.source ?? null,
    constraint: question.constraint?.source ?? null,
    calculation: question.calculation?.source ?? null
  }))
};

await fs.mkdir(generatedDirectory, { recursive: true });
await Promise.all([
  fs.writeFile(path.join(generatedDirectory, "who-va-2022.instrument.json"), `${JSON.stringify(instrument, null, 2)}\n`),
  fs.writeFile(path.join(generatedDirectory, "who-va-2022.question-audit.json"), `${JSON.stringify(audit, null, 2)}\n`)
]);

console.log(`Generated ${instrument.questions.length} questions and ${instrument.sections.length} sections from ${instrument.sourceFile}`);
