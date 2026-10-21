import { describe, expect, it } from "vitest";
import { parseNotebook, normalizeNoteMarkdown } from "@/lib/notebook-markdown";
import { parseImageAnalysis } from "@/lib/notebook-analysis";
import { notebookDocumentSchema } from "@/lib/notebook";
import { combineNotebookText } from "@/lib/notebook-text";

describe("repository notebook text processing", () => {
  it("keeps existing diagram geometry and its position between OCR sections", () => {
    const diagram = {kind:"diagram" as const,runs:[],diagram:{width:200,height:200,description:"رسم",elements:[{kind:"line" as const,x:20,y:20,x2:180,y2:180,stroke:"#202124",fill:null,strokeWidth:2}]}};
    const analysis = {description:"",ocrText:"قبل\nالضوء -> العدسة\nبعد",isCode:false,codeLanguage:null,latex:"",tableMarkdown:"",tableJson:[],colors:[]};
    const document = combineNotebookText(analysis,{direction:"rtl",blocks:[diagram],uncertain:false});
    expect(document.blocks.map(block=>block.kind)).toEqual(["markdown","diagram","markdown"]);
    expect(document.blocks[1]).toEqual(diagram);
    expect(document.blocks[0]?.runs[0]?.text).toBe("قبل");
    expect(document.blocks[2]?.runs[0]?.text).toBe("بعد");
  });
  it("preserves diagram slots when OCR has no drawing marker", () => {
    const run = (text:string)=>({text,color:"#202124",highlight:null,bold:false,underline:false});
    const diagram = {kind:"diagram" as const,runs:[],diagram:{width:200,height:200,description:"رسم",elements:[{kind:"line" as const,x:20,y:20,x2:180,y2:180,stroke:"#202124",fill:null,strokeWidth:2}]}};
    const original = {direction:"rtl" as const,blocks:[{kind:"paragraph" as const,runs:[run("قبل")]},diagram,{kind:"paragraph" as const,runs:[run("بعد")]}],uncertain:false};
    const analysis = {description:"",ocrText:"قبل\nبعد",isCode:false,codeLanguage:null,latex:"",tableMarkdown:"",tableJson:[],colors:[]};
    expect(combineNotebookText(analysis,original).blocks.map(block=>block.kind)).toEqual(["markdown","diagram","markdown"]);
    expect(()=>combineNotebookText({...analysis,ocrText:"نص مختلف"},original)).toThrow("Unable to align");
  });
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