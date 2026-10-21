import { streamResponse } from "@lovable.dev/ai-gateway";
import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";
import { notebookDocumentSchema, type NotebookDocument } from "./notebook";
import { diagramWireSchema } from "./notebook-diagram";
import { IMAGE_ANALYSIS_PROMPT, parseImageAnalysis } from "./notebook-analysis";
import { parseNotebook } from "./notebook-markdown";

const wireSchema = z.object({ direction: z.enum(["rtl", "ltr"]), blocks: z.array(z.object({
  kind: z.enum(["heading", "subheading", "paragraph", "list", "quote", "diagram"]),
  runs: z.array(z.object({text:z.string(),color:z.string(),highlight:z.string().nullable(),bold:z.boolean(),underline:z.boolean()}).strict()),
  diagram: diagramWireSchema.nullable(),
}).strict()), uncertain: z.boolean() }).strict();

const DIAGRAM_PROMPT = `You are a specialist in Arabic handwritten science notebooks, low-contrast ink, ruled paper, shadows and skew. Transcribe text faithfully: never summarize, translate, correct grammar, or invent content. Ignore printed rulings. Use sentence context, subject vocabulary and letter shapes before marking a truly unreadable word [غير واضح]. Preserve headings, paragraphs, lists, order, line breaks, bold, underline, source ink and highlight colors as six-digit hex RGB.
DIAGRAM RECONSTRUCTION: Detect every physical experiment, apparatus or diagram. NEVER transcribe a drawing as prose or ASCII art. Reconstruct the entire drawing electronically as a diagram block containing structured SVG primitives. Keep the diagram at its original position among the text blocks. Text blocks have diagram=null. Diagram blocks have runs=[] (or only a source caption) and a non-null diagram. Use line/arrow, rect, ellipse and path primitives for rods, supports, electroscope knobs/stems/leaves, glass containers, pendulum strings and bobs. Use separate charge primitives with sign + or - at each EXACT source position; do not infer or add charges from textbook knowledge. Charges render red for positive and blue for negative. Preserve spacing, contact/gaps, orientation, leaf deflection, stage grouping and labels 1, 2, 3 exactly; never mirror geometry to match RTL. Label primitives contain actual source labels, not invented explanations. Arabic labels use direction=rtl; numbers/symbols use ltr. Reconstruct readable tables as vector lines with source labels, not flattened prose.
Use a tight but padded viewBox width/height between 100 and 2400, typically width 800, scaled proportionally from the source. All elements and labels must fit the viewport with enough margins for their full extent. Use fontSize 18-28 (allowed 10-64), strokeWidth 1.5-3 (allowed 0-16), charge radius 10-16 (allowed 6-40), simple valid SVG path d commands only, no markup, scripts, URLs, external images, foreignObject or HTML. Coordinates are numeric SVG units. All stroke/fill/label colors are six-digit hex; fill=null means no fill. Use restrained source colors and clean rounded line geometry. Keep apparatus proportions and do not introduce decorative graphics. Give each diagram a concise factual Arabic accessibility description, not an extra visible heading. Maximum 500 primitives per diagram. Flag uncertain=true only for genuinely unreadable source text or diagram details you cannot faithfully reconstruct; never silently guess. Return only source content.`;

async function readResponse(instructions: string, userText: string, imageUrl: string, structured = false) {
  const stream = await streamResponse({
    model: "openai/gpt-6-astra",
    instructions,
    input: [{ role: "user", content: [
      { type: "input_text", text: userText },
      { type: "input_image", image_url: imageUrl, detail: "high" },
    ] }],
    reasoning: { effort: "medium", summary: "auto" },
    include: ["reasoning.encrypted_content"],
    text: { format: structured
      ? { type: "json_schema", name: "notebook", strict: true, schema: zodToJsonSchema(wireSchema, { $refStrategy: "none" }) }
      : { type: "json_object" } },
  }, { maxRetries: 0 });
  let text = "";
  let completed = false;
  for await (const event of stream) {
    if (event.type === "response.output_text.delta") text += event.delta;
    if (event.type === "response.completed") completed = event.response.status === "completed";
  }
  if (!completed || !text.trim()) throw new Error("Incomplete notebook response");
  return text;
}

export async function transcribeNotebook(image: Uint8Array, mediaType: string): Promise<NotebookDocument> {
  const imageUrl = `data:${mediaType};base64,${Buffer.from(image).toString("base64")}`;
  const analysis = parseImageAnalysis(await readResponse(IMAGE_ANALYSIS_PROMPT,
    "Analyze this image and return the JSON as specified.", imageUrl));
  // Keep the existing reconstruction prompt, validation and React diagram renderer.
  const original = notebookDocumentSchema.parse(JSON.parse(await readResponse(DIAGRAM_PROMPT,
    "Transcribe this source page and reconstruct its experiments as faithful vector diagrams.", imageUrl, true)));
  const parsed = parseNotebook(analysis.ocrText);
  const diagrams = original.blocks.filter(block => block.kind === "diagram");
  const markdown = (text: string): NotebookDocument["blocks"][number] => ({
    kind: "markdown", runs: [{text, color: "#202124", highlight: null, bold: false, underline: false}], diagram: null,
  });
  let diagramIndex = 0;
  const blocks: NotebookDocument["blocks"] = [];
  if (parsed.some(block => block.type === "diagram")) {
    for (const block of parsed) {
      if (block.type === "markdown") blocks.push(markdown(block.content));
      else { const diagram = diagrams[diagramIndex++]; if (diagram) blocks.push(diagram); }
    }
    blocks.push(...diagrams.slice(diagramIndex));
  } else if (diagrams.length) {
    // No OCR drawing marker: retain the existing diagram slots in source order.
    const textBlocks = parsed.filter(block => block.type === "markdown");
    let textIndex = 0;
    for (const block of original.blocks) {
      if (block.kind === "diagram") blocks.push(block);
      else { const source = textBlocks[textIndex++]; if (source) blocks.push(markdown(source.content)); }
    }
    blocks.push(...textBlocks.slice(textIndex).map(block => markdown(block.content)));
  } else blocks.push(...parsed.filter(block => block.type === "markdown").map(block => markdown(block.content)));
  return notebookDocumentSchema.parse({ direction: original.direction, blocks, uncertain: original.uncertain, analysis });
}
