import { describe, expect, it } from "vitest";
import { onboardingKey, shouldShowOnboarding } from "@/lib/onboarding";
describe("first-time student tour", () => {
  it("opens only for a named logged-in student with loaded roles", () => {
    expect(shouldShowOnboarding("student-a", ["student"], true, false)).toBe(true);
    expect(shouldShowOnboarding(undefined, ["student"], true, false)).toBe(false);
    expect(shouldShowOnboarding("student-a", undefined, true, false)).toBe(false);
    expect(shouldShowOnboarding("student-a", ["student"], false, false)).toBe(false);
    expect(shouldShowOnboarding("admin-a", ["student", "admin"], true, false)).toBe(false);
  });
  it("does not reopen after skipping or completing", () => {
    expect(shouldShowOnboarding("student-a", ["student", "subscriber"], true, true)).toBe(false);
  });
  it("keeps completion separate for students sharing a browser", () => {
    expect(onboardingKey("student-a")).toBe("has_seen_onboarding:student-a");
    expect(onboardingKey("student-b")).not.toBe(onboardingKey("student-a"));
  });
});