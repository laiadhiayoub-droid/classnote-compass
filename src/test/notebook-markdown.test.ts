import { describe, expect, it } from "vitest";
import { parseNotebook, normalizeNoteMarkdown } from "@/lib/notebook-markdown";
import { parseImageAnalysis } from "@/lib/notebook-analysis";
import { notebookDocumentSchema } from "@/lib/notebook";

describe("repository notebook text processing", () => {
  it("preserves Arabic headings, list order and complete tables", () => {
    const text = "# الفيزياء\n## الطاقة\n1. تعريف\n2. مثال\n- ملاحظة\n\n| الكمية | القيمة |\n| --- | --- |\n| السرعة | 20 |";
    expect(parseNotebook(text)).toEqual([{type:"markdown",content:text}]);
  });
  it("normalizes OCR bullets and Arabic-Indic numbers", () => {
    expect(normalizeNoteMarkdown("• تعريف\n● مثال\n.1 تحضير\n٢ تسجيل")).toBe("- تعريف\n- مثال\n1. تحضير\n2. تسجيل");
  });
  it("adds the delimiter to explicit OCR tables", () => {
    expect(parseNotebook("الكمية | القيمة\nالسرعة | 20")).toEqual([{type:"markdown",content:"الكمية | القيمة\n--- | ---\nالسرعة | 20"}]);
  });
  it("retains diagram positions without rendering ASCII as text", () => {
    expect(parseNotebook("# التجربة\nالنص قبل الرسم\nالضوء -> العدسة\nالنص بعد الرسم")).toEqual([
      {type:"markdown",content:"# التجربة\nالنص قبل الرسم"},
      {type:"diagram",labels:["الضوء","العدسة"],connected:false},
      {type:"markdown",content:"النص بعد الرسم"},
    ]);
    expect(parseNotebook("```ascii\n+-----+\n| الخلية |\n+-----+\n```")).toEqual([{type:"diagram",labels:["الخلية"],connected:false}]);
  });
  it("preserves program code and horizontal rules", () => {
    const text = "---\n```js\na -> b\n```";
    expect(parseNotebook(text)).toEqual([{type:"markdown",content:text}]);
  });
  it("validates all repository analysis fields and JSON fence recovery", () => {
    const analysis = {description:"صورة",ocrText:"النص",isCode:false,codeLanguage:null,latex:"",tableMarkdown:"",tableJson:[],colors:[{hex:"#202124",name:"حبر"}]};
    expect(parseImageAnalysis("```json\n"+JSON.stringify(analysis)+"\n```")).toEqual(analysis);
    expect(()=>parseImageAnalysis(JSON.stringify({...analysis,ocrText:42}))).toThrow();
    expect(notebookDocumentSchema.parse({direction:"rtl",blocks:[{kind:"markdown",runs:[{text:"# النص",color:"#202124",highlight:null,bold:false,underline:false}]}],uncertain:false,analysis}).analysis).toEqual(analysis);
  });
});