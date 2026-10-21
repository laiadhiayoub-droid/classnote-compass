import { notebookDocumentSchema, type NotebookDocument } from "./notebook";
import type { NotebookAnalysis } from "./notebook-analysis";
import { parseNotebook } from "./notebook-markdown";

export function combineNotebookText(analysis: NotebookAnalysis, original: NotebookDocument): NotebookDocument {
  const parsed = parseNotebook(analysis.ocrText);
  const diagrams = original.blocks.filter(block => block.kind === "diagram");
  const markdown = (text: string): NotebookDocument["blocks"][number] => ({
    kind: "markdown", runs: [{text, color: "#202124", highlight: null, bold: false, underline: false}], diagram: null,
  });
  const blocks: NotebookDocument["blocks"] = [];
  let diagramIndex = 0;
  if (parsed.some(block => block.type === "diagram")) {
    for (const block of parsed) {
      if (block.type === "markdown") blocks.push(markdown(block.content));
      else { const diagram = diagrams[diagramIndex++]; if (diagram) blocks.push(diagram); }
    }
    blocks.push(...diagrams.slice(diagramIndex));
  } else if (diagrams.length) {
    // Use matching OCR text boundaries to preserve the original diagram slots.
    // If matching is impossible, do not silently move a diagram or lose text.
    const source = analysis.ocrText;
    let cursor = 0;
    for (let i = 0; i < original.blocks.length; i++) {
      const block = original.blocks[i];
      if (block?.kind !== "diagram") continue;
      const nextText = original.blocks.slice(i + 1).find(item => item.kind !== "diagram" && item.runs.some(run => run.text.trim()));
      const anchor = nextText?.runs.map(run => run.text).join("").trim();
      const boundary = anchor ? source.indexOf(anchor, cursor) : source.length;
      if (boundary < cursor) throw new Error("Unable to align source text and diagram");
      const before = source.slice(cursor, boundary);
      if (before.trim()) blocks.push(...parseNotebook(before).filter(item=>item.type === "markdown").map(item=>markdown(item.content)));
      blocks.push(block);
      cursor = boundary;
    }
    const remaining = source.slice(cursor);
    if (remaining.trim()) blocks.push(...parseNotebook(remaining).filter(item=>item.type === "markdown").map(item=>markdown(item.content)));
  } else blocks.push(...parsed.filter(block => block.type === "markdown").map(block => markdown(block.content)));
  return notebookDocumentSchema.parse({ direction: original.direction, blocks, uncertain: original.uncertain, analysis });
}