/**
 * Runtime instrument assembled from the generated WHO contract plus the custom
 * medical-certificate attachment question required by this implementation.
 */
import generatedInstrument from "./generated/who-va-2022.instrument.json";

import type { InstrumentDefinition, InstrumentQuestion } from "./types.js";

const generated = generatedInstrument as InstrumentDefinition;
const medicalCertificateAnchorIndex = generated.questions.findIndex(
  (question) => question.name === "Id10473"
);

if (medicalCertificateAnchorIndex < 0) {
  throw new Error("Cannot add the medical-certificate upload because Id10473 is missing");
}

const medicalCertificateAnchor = generated.questions[medicalCertificateAnchorIndex]!;
const medicalCertificateUpload: InstrumentQuestion = {
  name: "custom_medical_certificate_upload",
  order: medicalCertificateAnchor.order + 1,
  sourceRow: 0,
  sourceType: "custom-attachment",
  dataType: "attachment",
  control: "file",
  label: { en: "Upload medical certificate (image or PDF)" },
  hint: { en: "Choose a JPEG or PNG image, or a PDF document." },
  guidance: {},
  required: false,
  readOnly: false,
  appearance: "image-or-pdf",
  constraintMessage: {},
  sectionPath: [...medicalCertificateAnchor.sectionPath],
  ...(medicalCertificateAnchor.ageGroup ? { ageGroup: medicalCertificateAnchor.ageGroup } : {}),
  ...(medicalCertificateAnchor.relevant ? { relevant: medicalCertificateAnchor.relevant } : {})
};

export const whoVa2022Instrument: InstrumentDefinition = {
  ...generated,
  questions: [
    ...generated.questions.slice(0, medicalCertificateAnchorIndex + 1),
    medicalCertificateUpload,
    ...generated.questions.slice(medicalCertificateAnchorIndex + 1)
  ]
};
