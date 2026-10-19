import { describe, it, expect } from "vitest";
import { pageBinding, displayEntries, groupPages, parseResourceLinks, isAuthorVisible, classNotebookPages } from "@/lib/publishing";
describe("class notebook separation", () => {
  it("includes only official notebook pages, excluding summaries of the same subject and author", () => {
    const rows = [{ id: "notebook", content_type: "lesson", user_id: "student", subject: "spanish" }, { id: "summary", content_type: "summary", user_id: "student", subject: "spanish" }];
    expect(classNotebookPages(rows).map(p => p.id)).toEqual(["notebook"]);
  });
  it("never creates a notebook from summary-only uploads", () => {
    expect(classNotebookPages([{ content_type: "summary" }])).toEqual([]);
  });
});
describe("hidden author visibility", () => {
  it("hides other accounts until visibility is known", () => {
    expect(isAuthorVisible("hidden", "student", undefined)).toBe(false);
    expect(isAuthorVisible("hidden", "student", new Set(["public"]))).toBe(false);
  });
  it("allows the owner and authorized viewers to see the account", () => {
    expect(isAuthorVisible("hidden", "hidden", undefined)).toBe(true);
    expect(isAuthorVisible("hidden", "admin", new Set(["hidden"]))).toBe(true);
    expect(isAuthorVisible("hidden", undefined, new Set(["hidden"]))).toBe(false);
  });
});
describe("multi-page publishing", () => {
  it("binds grouped images to one root and preserves page order", () => {
    expect(pageBinding(1, true, "root", null, 1)).toMatchObject({ parent_lesson_id: "root", page_number: 2, grouped_pages: true });
  });
  it("keeps ungrouped uploads independent", () => {
    expect(pageBinding(1, false, "root", null, 1)).toMatchObject({ parent_lesson_id: null, page_number: 1, grouped_pages: false });
  });
  it("preserves the existing continuation relationship", () => {
    expect(pageBinding(1, true, "root", "previous", 3)).toMatchObject({ parent_lesson_id: "previous", page_number: 4, grouped_pages: false });
  });
  it("shows grouped uploads as one entry with only its pages in the carousel", () => {
    const pages = [{id:"a",parent_lesson_id:null,grouped_pages:true},{id:"b",parent_lesson_id:"a",grouped_pages:true},{id:"c",parent_lesson_id:null,grouped_pages:false}];
    expect(displayEntries(pages).map(p=>p.id)).toEqual(["a","c"]);
    const first = pages[0];
    if (!first) throw new Error("Missing test page");
    expect(groupPages(pages,first).map(p=>p.id)).toEqual(["a","b"]);
  });
  it("accepts video and test links but rejects executable protocols", () => {
    expect(parseResourceLinks("https://youtube.com/watch?v=abc\nhttps://example.com/quiz")).toEqual(["https://youtube.com/watch?v=abc","https://example.com/quiz"]);
    expect(()=>parseResourceLinks("javascript:alert(1)")).toThrow();
  });
});