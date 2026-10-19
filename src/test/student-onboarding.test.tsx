import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import { StudentOnboarding } from "@/components/StudentOnboarding";
vi.mock("@tanstack/react-router", () => ({ Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => <a href={to} {...props}>{children}</a> }));
afterEach(() => { cleanup(); localStorage.clear(); });
describe("student onboarding completion", () => {
  it("saves skipping from a later step", () => {
    render(<I18nProvider><StudentOnboarding userId="student-tour" roles={["student"]} named onView={() => {}} /></I18nProvider>);
    fireEvent.click(screen.getByRole("button", { name: "التالي" }));
    fireEvent.click(screen.getByRole("button", { name: "تخطي" }));
    expect(localStorage.getItem("has_seen_onboarding:student-tour")).toBe("true");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("persists completing the three-step tour", () => {
    render(<I18nProvider><StudentOnboarding userId="student-finish" roles={["student"]} named onView={() => {}} /></I18nProvider>);
    fireEvent.click(screen.getByRole("button", { name: "التالي" }));
    fireEvent.click(screen.getByRole("button", { name: "التالي" }));
    fireEvent.click(screen.getByRole("button", { name: "ابدأ التصفح" }));
    expect(localStorage.getItem("has_seen_onboarding:student-finish")).toBe("true");
  });
});