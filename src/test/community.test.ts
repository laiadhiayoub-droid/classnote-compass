import { describe, expect, it } from "vitest";
import { canAccessCommunity } from "@/lib/community";

describe("student community access", () => {
  it("allows regular signed-in students when not banned", () => {
    expect(canAccessCommunity("student", false)).toBe(true);
  });
  it("hides the directory and suggestions for banned accounts", () => {
    expect(canAccessCommunity("student", true)).toBe(false);
  });
  it("fails closed until restriction status is confirmed", () => {
    expect(canAccessCommunity("student", undefined)).toBe(false);
    expect(canAccessCommunity("student", null)).toBe(false);
  });
  it("never permits signed-out access", () => {
    expect(canAccessCommunity(undefined, false)).toBe(false);
  });
});