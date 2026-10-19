import { describe, expect, it } from "vitest";
import { ageAt, profileComplete, safeBioLink } from "@/lib/student-profile";
const profile = { id: "student", full_name: "Student", birth_date: "2010-10-19", class_stream: "2AS languages", bio_link: null };
describe("student profiles", () => {
  it("requires birth date before profile completion", () => {
    expect(profileComplete({ ...profile, birth_date: null })).toBe(false);
    expect(profileComplete(profile)).toBe(true);
  });
  it("requires class before profile completion", () => {
    expect(profileComplete({ ...profile, class_stream: " " })).toBe(false);
    expect(profileComplete(profile)).toBe(true);
  });
  it("keeps social links optional", () => expect(profileComplete({ ...profile, bio_link: null })).toBe(true));
  it("only exposes safe social links", () => {
    expect(safeBioLink("https://instagram.com/student")).toBe("https://instagram.com/student");
    expect(safeBioLink("javascript:alert(1)")).toBeNull();
    expect(safeBioLink("https://user:password@example.com")).toBeNull();
  });
  it("calculates age before and on a birthday", () => {
    expect(ageAt("2010-10-19", new Date(2026, 9, 18))).toBe(15);
    expect(ageAt("2010-10-19", new Date(2026, 9, 19))).toBe(16);
  });
});