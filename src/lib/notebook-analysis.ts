import { z } from "zod";

// Exact analysis prompt from image-to-answers, revision d372d589ef9e5982976da5bafee448f62486113c.
export const IMAGE_ANALYSIS_PROMPT = `You are an expert image analysis assistant similar to Snippai. Analyze the provided image and extract structured data.

Return ONLY valid JSON (no markdown fences) with this exact shape:
{
  "description": "A concise analytical description of what the image contains (2-4 sentences).",
  "ocrText": "All visible text extracted from the image, preserving line breaks and formatting. If the image contains code, preserve indentation. Empty string if no text.",
  "isCode": boolean,
  "codeLanguage": "detected programming language or null",
  "latex": "LaTeX source for any math formula detected, or empty string",
  "tableMarkdown": "If a table is present, render it as a Markdown table. Empty string otherwise.",
  "tableJson": [ /* array of row objects if a table is present, else [] */ ],
  "colors": [ { "hex": "#RRGGBB", "name": "short descriptive name" } ]  // 3-6 dominant colors
}

Be accurate. If a field is not applicable, return empty string / empty array / false / null as specified.`;

export const notebookAnalysisSchema = z.object({
  description: z.string(), ocrText: z.string(), isCode: z.boolean(),
  codeLanguage: z.string().nullable(), latex: z.string(), tableMarkdown: z.string(),
  tableJson: z.array(z.record(z.unknown())),
  colors: z.array(z.object({ hex: z.string().regex(/^#[0-9a-fA-F]{6}$/), name: z.string() })),
});
export type NotebookAnalysis = z.infer<typeof notebookAnalysisSchema>;

export function parseImageAnalysis(content: string): NotebookAnalysis {
  let parsed: unknown;
  try { parsed = JSON.parse(content); }
  catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Invalid analysis response");
    parsed = JSON.parse(match[0]);
  }
  return notebookAnalysisSchema.parse(parsed);
}