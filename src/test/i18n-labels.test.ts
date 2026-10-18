import { describe, it, expect } from "vitest";
import { structureOcrText } from "@/lib/ocr";
import { DAYS_BY_LANG, SUBJECT_NAMES, dayLabelL, subjectNameL } from "@/lib/timetable";
import { subjectLabelL, contentTypeLabelL, semesterLabelL } from "@/lib/library";

describe("smart OCR text structuring", () => {
  it("separates paragraphs on blank lines", () => {
    expect(structureOcrText("First paragraph\nstill first\n\nSecond paragraph")).toBe("First paragraph still first\n\nSecond paragraph");
  });
  it("re-joins words hyphenated across line breaks", () => {
    expect(structureOcrText("El preté-\nrito indefinido")).toBe("El pretérito indefinido");
  });
  it("normalises bullet markers onto their own block", () => {
    expect(structureOcrText("Intro\n- verbos regulares\n- verbos irregulares")).toBe("Intro\n\n• verbos regulares\n\n• verbos irregulares");
  });
  it("keeps numbered list markers", () => {
    expect(structureOcrText("1. hablar\n2. comer")).toBe("1. hablar\n\n2. comer");
  });
});

describe("four-language labels", () => {
  it("has all five weekdays in all four languages", () => {
    for (const lang of ["ar", "en", "fr", "es"] as const) expect(DAYS_BY_LANG[lang]).toHaveLength(5);
    expect(dayLabelL(0, "en")).toBe("Sunday");
    expect(dayLabelL(0, "fr")).toBe("Dimanche");
    expect(dayLabelL(0, "es")).toBe("Domingo");
  });
  it("translates every scheduled subject name", () => {
    for (const lang of ["ar", "en", "fr", "es"] as const) {
      expect(subjectNameL("إسبانية", lang)).toBe(SUBJECT_NAMES["إسبانية"]![lang]);
      expect(subjectNameL("إنجليزية", lang)).toBe(SUBJECT_NAMES["إنجليزية"]![lang]);
    }
    expect(subjectNameL("إسبانية", "es")).toBe("Español");
  });
  it("localises subject, content type and semester labels", () => {
    expect(subjectLabelL("spanish", "fr")).toBe("Langue Espagnole");
    expect(contentTypeLabelL("summary", "es")).toBe("Resumen");
    expect(semesterLabelL("s1", "en")).toBe("Semester 1");
  });
});
