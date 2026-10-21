// Text normalization/parser from image-to-answers revision d372d589ef9e5982976da5bafee448f62486113c.
export type NotebookBlock = { type: "markdown"; content: string } | { type: "diagram"; labels: string[]; connected: boolean };
function isDrawingLine(line: string) {
  const text = line.trim();
  return /(?:\+[-+]{2,}|[-+]{2,}\+|[┌┐└┘├┤┬┴┼│─═║])/u.test(text)
    || /^(?:[+]{3,}|[|\s+\-_/\\<>]{4,})$/.test(text)
    || /\S\s*(?:-->|->|→|←|<--|<-)\s*\S/.test(text);
}
export function diagramLabels(content: string): string[] {
  return content.split(/\r?\n|-->|->|→|←|<--|<-/u)
    .map(line => line.replace(/[+|┌┐└┘├┤┬┴┼│─═║]/gu, " ").replace(/^\s*[-_\\/<>]+|[-_\\/<>]+\s*$/g, "").trim())
    .filter(line => line && !/^[-=\s]+$/.test(line));
}
export function normalizeNoteMarkdown(text: string): string {
  const lines = text.split("\n");
  let fenced = false;
  const normalized = lines.map((line) => {
    if (/^\s*```/.test(line)) { fenced = !fenced; return line; }
    if (fenced) return line;
    return line.replace(/^\s*[•●▪]\s*/u, "- ")
      .replace(/^\s*[.٫]([0-9٠-٩]+)\s+/u, "$1. ")
      .replace(/^\s*([0-9٠-٩]+)[.)]?\s+/u, (_, number: string) => `${number.replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))}. `);
  });
  for (let i = 0; i < normalized.length - 1; i++) {
    const line = normalized[i], next = normalized[i + 1];
    if (line === undefined || next === undefined || !line.includes("|") || !next.includes("|")) continue;
    if (/^\s*\|?\s*:?-+/.test(line) || /^\s*\|?\s*:?-+/.test(next)) continue;
    const columns = line.replace(/^\s*\||\|\s*$/g, "").split("|").length;
    if (columns < 2) continue;
    let end = i + 1;
    while (end < normalized.length && normalized[end]?.includes("|")) end++;
    normalized.splice(i + 1, 0, Array.from({ length: columns }, () => "---").join(" | "));
    i = end;
  }
  return normalized.join("\n");
}
export function parseNotebook(text: string): NotebookBlock[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: NotebookBlock[] = [];
  let markdown: string[] = [];
  const flush = () => {
    if (markdown.length) blocks.push({ type: "markdown", content: normalizeNoteMarkdown(markdown.join("\n")) });
    markdown = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    if (/^\s*```/.test(line)) {
      const fence = line.trim().slice(3).toLowerCase();
      const body: string[] = [];
      i++;
      while (i < lines.length) { const item = lines[i]; if (item === undefined || /^\s*```/.test(item)) break; body.push(item); i++; }
      const drawing = ["diagram", "ascii", "text", "plaintext", ""].includes(fence) && body.some(isDrawingLine);
      if (drawing) { flush(); blocks.push({ type: "diagram", labels: diagramLabels(body.join("\n")), connected: false }); }
      else markdown.push(line, ...body, "```");
      continue;
    }
    const tableLine = /^\s*\|.*\|\s*$/.test(line) && !/[+┌┐└┘│]/u.test(line);
    if (isDrawingLine(line) && !tableLine) {
      flush();
      const drawing = [line];
      while (i + 1 < lines.length) { const next = lines[i + 1]; if (next === undefined || !isDrawingLine(next)) break; drawing.push(next); i++; }
      blocks.push({ type: "diagram", labels: diagramLabels(drawing.join("\n")), connected: false });
    } else markdown.push(line);
  }
  flush();
  return blocks;
}