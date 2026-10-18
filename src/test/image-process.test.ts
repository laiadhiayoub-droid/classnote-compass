import { describe, it, expect } from "vitest";
import { extractUnitDomain } from "@/lib/image-process";
describe("extractUnitDomain", () => {
  it("finds Arabic unit and domain", () => {
    const r = extractUnitDomain("الميدان: القواعد\nالوحدة 2: الماضي\nنص");
    expect(r.unit).toContain("الوحدة 2");
    expect(r.domain).toContain("القواعد");
  });
  it("finds Spanish Unidad", () => {
    expect(extractUnitDomain("Unidad 3 - La familia").unit).toBe("Unidad 3 - La familia");
  });
});
