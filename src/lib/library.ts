import type { Lang } from "./i18n";

type Labels = Record<Lang, string>;

export const SUBJECTS = [
  { id: "spanish", label: "اللغة الإسبانية", sub: "Lengua Española", labels: { ar: "اللغة الإسبانية", en: "Spanish Language", fr: "Langue Espagnole", es: "Lengua Española" } },
  { id: "french", label: "اللغة الفرنسية", sub: "Langue Française", labels: { ar: "اللغة الفرنسية", en: "French Language", fr: "Langue Française", es: "Lengua Francesa" } },
  { id: "english", label: "اللغة الإنجليزية", sub: "English Language", labels: { ar: "اللغة الإنجليزية", en: "English Language", fr: "Langue Anglaise", es: "Lengua Inglesa" } },
  { id: "arabic", label: "اللغة العربية والآداب", sub: "", labels: { ar: "اللغة العربية والآداب", en: "Arabic Language & Literature", fr: "Langue Arabe et Littérature", es: "Lengua Árabe y Literatura" } },
  { id: "history_geo", label: "التاريخ والجغرافيا", sub: "", labels: { ar: "التاريخ والجغرافيا", en: "History & Geography", fr: "Histoire-Géographie", es: "Historia y Geografía" } },
  { id: "philosophy", label: "الفلسفة", sub: "", labels: { ar: "الفلسفة", en: "Philosophy", fr: "Philosophie", es: "Filosofía" } },
  { id: "islamic", label: "العلوم الإسلامية", sub: "", labels: { ar: "العلوم الإسلامية", en: "Islamic Sciences", fr: "Sciences Islamiques", es: "Ciencias Islámicas" } },
  { id: "math", label: "الرياضيات", sub: "", labels: { ar: "الرياضيات", en: "Mathematics", fr: "Mathématiques", es: "Matemáticas" } },
] as const satisfies readonly { id: string; label: string; sub: string; labels: Labels }[];

export type SubjectId = (typeof SUBJECTS)[number]["id"];

export const CONTENT_TYPES = [
  { id: "lesson", label: "كراس", labels: { ar: "كراس", en: "Notebook", fr: "Cahier", es: "Cuaderno" } },
  { id: "summary", label: "ملخص", labels: { ar: "ملخص", en: "Summary", fr: "Résumé", es: "Resumen" } },
] as const satisfies readonly { id: string; label: string; labels: Labels }[];

export const SEMESTERS = [
  { id: "s1", label: "الفصل الأول", labels: { ar: "الفصل الأول", en: "Semester 1", fr: "Semestre 1", es: "Semestre 1" } },
  { id: "s2", label: "الفصل الثاني", labels: { ar: "الفصل الثاني", en: "Semester 2", fr: "Semestre 2", es: "Semestre 2" } },
  { id: "s3", label: "الفصل الثالث", labels: { ar: "الفصل الثالث", en: "Semester 3", fr: "Semestre 3", es: "Semestre 3" } },
] as const satisfies readonly { id: string; label: string; labels: Labels }[];

/** Localised labels — fall back to Arabic when a language is missing. */
export const subjectLabelL = (id: string, lang: Lang = "ar") =>
  SUBJECTS.find((s) => s.id === id)?.labels[lang] ?? subjectLabel(id);
export const semesterLabelL = (id: string | null, lang: Lang = "ar") =>
  (id ? SEMESTERS.find((s) => s.id === id)?.labels[lang] ?? semesterLabel(id) : "");
export const contentTypeLabelL = (id: string, lang: Lang = "ar") =>
  CONTENT_TYPES.find((c) => c.id === id)?.labels[lang] ?? contentTypeLabel(id);

// Arabic-only defaults kept for tests and non-React callers.
export const subjectLabel = (id: string) => SUBJECTS.find((s) => s.id === id)?.label ?? id;
export const semesterLabel = (id: string | null) => SEMESTERS.find((s) => s.id === id)?.label ?? "";
export const contentTypeLabel = (id: string) =>
  CONTENT_TYPES.find((c) => c.id === id)?.label ?? id;

/** Compress an image in the browser to a JPEG, max dimension `max`. */
export async function compressImage(file: File, max = 1600, quality = 0.75): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("compress failed"))), "image/jpeg", quality),
  );
}
