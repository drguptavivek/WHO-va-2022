import ExcelJS from "exceljs";
import path from "node:path";

import type {
  AnswerDataType,
  InstrumentChoice,
  InstrumentDefinition,
  InstrumentQuestion,
  InstrumentSection,
  LocalizedText,
  QuestionControl
} from "../types.js";
import { parseExpression } from "../engine/expression.js";

type SourceRow = Record<string, string> & { _row: string };

const INTERVIEWER_CONSTRAINT_MESSAGES: Record<string, LocalizedText> = {
  Id10023_a: {
    en: "Date of death must be on or after the date of birth and cannot be in the future."
  },
  Id10023_b: {
    en: "Date of death cannot be in the future."
  },
  Id10382: {
    en: "Enter a whole number of hours from 0 to 98. Use 0 for less than 1 hour; use 23 or 25 when only the less-than or more-than-24-hour estimate is known; use 88 for refused; and use 99 for don't know. If the actual duration was 88 hours, enter 87."
  }
};

const RUNTIME_QUESTION_CONSTRAINTS: Record<string, string> = {
  Id10382: "(.>=0 and .<=98) or .=99"
};

const RUNTIME_SECTION_LABELS: Record<string, LocalizedText> = {
  consented: { en: "Interview completion" }
};

// `consented` is an XLSForm container rather than one contiguous screen. Keep
// its mid-form guidance with the following injury section; its trailing items
// then form the actual interview-completion screen.
const RUNTIME_QUESTION_SECTION_PATHS: Record<string, string[]> = {
  nmh: ["consented", "injuries_accidents"]
};

// Both answers can validly be "No" for a baby of normal birth weight. The
// upstream rule rejects that ordinary combination, so it must not reach the
// standalone runtime contract.
const OMITTED_SOURCE_CONSTRAINTS = new Set(["Id10365"]);

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("result" in value && value.result != null) return String(value.result);
    if ("text" in value && value.text != null) return String(value.text);
    if ("richText" in value && Array.isArray(value.richText)) return value.richText.map((part) => part.text).join("");
  }
  return String(value);
}

function worksheetRows(sheet: ExcelJS.Worksheet): SourceRow[] {
  const headers = sheet.getRow(1).values as ExcelJS.CellValue[];
  const output: SourceRow[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const record: SourceRow = { _row: String(rowNumber) };
    for (let column = 1; column < headers.length; column += 1) {
      const header = cellText(headers[column] ?? null).trim();
      if (header) record[header] = cellText(row.getCell(column).value).trim();
    }
    output.push(record);
  }
  return output;
}

function localeFromHeader(header: string): string | undefined {
  return header.match(/\(([A-Za-z0-9-]+)\)\s*$/)?.[1]?.toLowerCase();
}

function localized(row: SourceRow, prefix: string): LocalizedText {
  const result: LocalizedText = {};
  for (const [header, value] of Object.entries(row)) {
    if (!header.startsWith(`${prefix}::`) || !value) continue;
    const locale = localeFromHeader(header);
    if (locale) result[locale] = value;
  }
  return result;
}

function constraintMessage(row: SourceRow): LocalizedText {
  const interviewerMessage = INTERVIEWER_CONSTRAINT_MESSAGES[row.name ?? ""];
  if (interviewerMessage) return interviewerMessage;
  const sourceMessage = localized(row, "constraint_message");
  return Object.keys(sourceMessage).length > 0 ? sourceMessage : {};
}

function normalizeType(sourceType: string): string {
  return sourceType.trim().replace(/\s+/g, " ");
}

function sourceBoolean(value: string | undefined): boolean {
  return /^(?:yes|true|true\(\)|1)$/i.test((value ?? "").trim());
}

function compileExpression(source: string, row: number, column: string) {
  try {
    return { source, ast: parseExpression(source) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot compile survey row ${row} ${column}: ${message}. Expression: ${source}`);
  }
}

function questionShape(sourceType: string): { control: QuestionControl; dataType: AnswerDataType; listName?: string } {
  const type = normalizeType(sourceType);
  if (type.startsWith("select_one ")) return { control: "singleChoice", dataType: "string", listName: type.slice("select_one ".length) };
  if (type.startsWith("select_multiple ")) return { control: "multipleChoice", dataType: "string[]", listName: type.slice("select_multiple ".length) };
  switch (type) {
    case "text": return { control: "text", dataType: "string" };
    case "integer": return { control: "integer", dataType: "number" };
    case "date": return { control: "date", dataType: "date" };
    case "audio": return { control: "audio", dataType: "attachment" };
    case "image": return { control: "image", dataType: "attachment" };
    case "file": return { control: "file", dataType: "attachment" };
    case "trigger": return { control: "confirm", dataType: "boolean" };
    case "note": return { control: "note", dataType: "none" };
    case "calculate": return { control: "calculated", dataType: "calculated" };
    case "today": return { control: "system", dataType: "date" };
    case "start":
    case "end": return { control: "system", dataType: "dateTime" };
    case "audit": return { control: "system", dataType: "audit" };
    default: return { control: "system", dataType: "none" };
  }
}

export async function compileWhoVaWorkbook(sourceFile: string): Promise<InstrumentDefinition> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(sourceFile);
  const surveySheet = workbook.getWorksheet("survey");
  const choicesSheet = workbook.getWorksheet("choices");
  const settingsSheet = workbook.getWorksheet("settings");
  if (!surveySheet || !choicesSheet || !settingsSheet) throw new Error("XLSForm must contain survey, choices, and settings sheets");

  const surveyRows = worksheetRows(surveySheet);
  const choiceRows = worksheetRows(choicesSheet).filter((row) => row.list_name && row.name);
  const settings = worksheetRows(settingsSheet)[0];
  if (!settings) throw new Error("XLSForm settings sheet is empty");

  const choicesByList = new Map<string, InstrumentChoice[]>();
  for (const row of choiceRows) {
    const listName = row.list_name;
    const choiceName = row.name;
    if (!listName || !choiceName) continue;
    const list = choicesByList.get(listName) ?? [];
    list.push({ value: choiceName, label: localized(row, "label"), sourceRow: Number(row._row) });
    choicesByList.set(listName, list);
  }

  const sections: InstrumentSection[] = [];
  const questions: InstrumentQuestion[] = [];
  const sectionStack: string[] = [];
  for (const row of surveyRows) {
    const sourceType = row.type ?? "";
    const type = normalizeType(sourceType);
    if (type === "begin group") {
      const name = row.name || `group_${row._row}`;
      const parent = sectionStack.at(-1);
      const sourceLabel = localized(row, "label");
      sections.push({
        name,
        sourceRow: Number(row._row),
        order: Number(row.order || 0),
        label: { ...sourceLabel, ...RUNTIME_SECTION_LABELS[name] },
        ...(row.agegroup ? { ageGroup: row.agegroup } : {}),
        ...(parent ? { parent } : {}),
        ...(row.relevant ? { relevant: compileExpression(row.relevant, Number(row._row), "relevant") } : {})
      });
      sectionStack.push(name);
      continue;
    }
    if (type === "end group") {
      sectionStack.pop();
      continue;
    }
    if (!row.name) continue;

    const shape = questionShape(sourceType);
    const omitSourceConstraint = OMITTED_SOURCE_CONSTRAINTS.has(row.name);
    const constraintSource = RUNTIME_QUESTION_CONSTRAINTS[row.name] ?? row.constraint;
    const question: InstrumentQuestion = {
      name: row.name,
      order: Number(row.order || 0),
      sourceRow: Number(row._row),
      sourceType,
      dataType: shape.dataType,
      control: shape.control,
      label: localized(row, "label"),
      hint: localized(row, "hint"),
      guidance: localized(row, "guidance_hint"),
      required: sourceBoolean(row.required),
      readOnly: sourceBoolean(row.read_only),
      constraintMessage: omitSourceConstraint ? {} : constraintMessage(row),
      sectionPath: [...(RUNTIME_QUESTION_SECTION_PATHS[row.name] ?? sectionStack)],
      ...(row.agegroup ? { ageGroup: row.agegroup } : {}),
      ...(shape.listName ? { listName: shape.listName, choices: choicesByList.get(shape.listName) ?? [] } : {}),
      ...(row.appearance ? { appearance: row.appearance } : {}),
      ...(row.parameters ? { parameters: row.parameters } : {}),
      ...(row.default ? { defaultValue: row.default } : {}),
      ...(row.relevant ? { relevant: compileExpression(row.relevant, Number(row._row), "relevant") } : {}),
      ...(constraintSource && !omitSourceConstraint
        ? { constraint: compileExpression(constraintSource, Number(row._row), "constraint") }
        : {}),
      ...(row.calculation ? { calculation: compileExpression(row.calculation, Number(row._row), "calculation") } : {})
    };
    questions.push(question);
  }

  return {
    id: settings.form_id ?? "",
    title: settings.form_title ?? "",
    version: settings.version ?? "",
    defaultLanguage: settings.default_language ?? "",
    sourceFile: path.basename(sourceFile),
    sections,
    questions
  };
}
