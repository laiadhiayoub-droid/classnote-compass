import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BookOpen, FileText, Lightbulb, ShieldCheck, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { onboardingKey, shouldShowOnboarding } from "@/lib/onboarding";

export function StudentOnboarding({ userId, roles, named, onView }: { userId: string; roles: string[]; named: boolean; onView: (view: "books" | "summaries") => void }) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  useEffect(() => {
    let seen = false;
    try { seen = localStorage.getItem(onboardingKey(userId)) === "true"; } catch { /* Storage may be unavailable. */ }
    setOpen(shouldShowOnboarding(userId, roles, named, seen));
    setStep(0);
  }, [userId, roles, named]);
  function finish() {
    try { localStorage.setItem(onboardingKey(userId), "true"); } catch { /* Keep dismissal usable without storage. */ }
    setOpen(false);
  }
  const Icon = [BookOpen, ShieldCheck, Lightbulb][step] ?? BookOpen;
  const titles = ["tourLibraryTitle", "tourRolesTitle", "tourSuggestionsTitle"] as const;
  const bodies = ["tourLibraryBody", "tourRolesBody", "tourSuggestionsBody"] as const;
  return <Dialog open={open} onOpenChange={value => { if (!value) finish(); }}>
    <DialogContent className="sm:max-w-lg gap-5 p-5 sm:p-8" dir={lang === "ar" ? "rtl" : "ltr"}>
      <div className="flex items-center gap-3 pe-8"><Icon className="size-8 text-primary shrink-0" /><p className="text-sm text-muted-foreground" aria-live="polite">{t("tourProgress", { i: step + 1, n: 3 })}</p></div>
      <DialogTitle className="text-2xl leading-snug">{t(titles[step] ?? "tourLibraryTitle")}</DialogTitle>
      <DialogDescription className="text-base leading-relaxed whitespace-pre-line">{t(bodies[step] ?? "tourLibraryBody")}</DialogDescription>
      {step === 0 && <div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => onView("books")}><BookOpen className="size-4" />{t("books")}</Button><Button variant="outline" onClick={() => onView("summaries")}><FileText className="size-4" />{t("summaries")}</Button></div>}
      {step === 1 && <div className="divide-y border-y"><p className="py-3 text-sm"><strong>{t("subscriber")}</strong> — {t("tourSubscriber")}</p><p className="py-3 text-sm"><strong>{t("approvedWriter")}</strong> — {t("tourContributor")}</p></div>}
      {step === 2 && <Button variant="outline" asChild><Link to="/suggestions" onClick={finish}><Lightbulb className="size-4" />{t("tabSuggestions")}</Link></Button>}
      <div className="flex gap-2 items-center border-t pt-4"><Button variant="ghost" onClick={finish}>{t("tourSkip")}</Button><div className="flex-1" />{step > 0 && <Button size="icon" variant="outline" aria-label={t("previous")} onClick={() => setStep(s => s - 1)}>{lang === "ar" ? <ArrowRight className="size-4" /> : <ArrowLeft className="size-4" />}</Button>}<Button onClick={() => step === 2 ? finish() : setStep(s => s + 1)}>{step === 2 ? t("tourDone") : t("tourNext")}</Button></div>
    </DialogContent>
  </Dialog>;
}