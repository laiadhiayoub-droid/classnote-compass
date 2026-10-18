import { extractUnitDomain } from "./image-process";

export type OcrResult = { text: string; unit: string; domain: string };

/**
 * Turn raw OCR output into Word-style text: paragraph blocks separated by
 * blank lines, bullets normalised, stray hyphenation across lines re-joined.
 * Pure function — unit-testable without a browser.
 */
export function structureOcrText(raw: string): string {
  const lines = raw.split(/\r?\n/).map((l) => l.replace(/[ \t]+/g, " ").trim());
  const blocks: string[] = [];
  let current: string[] = [];
  const flush = () => {
    if (current.length) { blocks.push(current.join(" ").trim()); current = []; }
  };
  for (const line of lines) {
    if (!line) { flush(); continue; }
    // Re-join words hyphenated across a line break (common in scanned notebooks).
    const lastLine = current[current.length - 1];
    if (lastLine !== undefined && /[A-Za-zÀ-ÿ]-$/.test(lastLine)) {
      current[current.length - 1] = lastLine.replace(/-$/, "") + line.replace(/-$/, "");
      continue;
    }
    // Bullets and numbered items start their own block.
    if (/^([-•*–—]|\d+[.)])\s+/.test(line)) {
      flush();
      blocks.push(line.replace(/^([-•*–—]|\d+[.)])\s+/, (m) => (/^\d/.test(m) ? m : "• ")));
      continue;
    }
    current.push(line);
  }
  flush();
  return blocks.filter(Boolean).join("\n\n");
}

/** Run smart OCR on rendered page canvases (Arabic + Spanish + French + English). */
export async function ocrPages(canvases: HTMLCanvasElement[]): Promise<OcrResult> {
  const { recognize } = await import("tesseract.js");
  const texts: string[] = [];
  for (const canvas of canvases) {
    const { data } = await recognize(canvas, "ara+spa+fra+eng");
    texts.push(data.text);
  }
  const raw = texts.join("\n\n");
  const structured = structureOcrText(raw);
  const found = extractUnitDomain(raw);
  return { text: structured, unit: found.unit, domain: found.domain };
}
