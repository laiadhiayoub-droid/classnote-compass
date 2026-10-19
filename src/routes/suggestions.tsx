import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, Lightbulb, Loader2, Send, Trash2, Users, ExternalLink, GraduationCap, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ThemeToggle, LanguageMenu } from "@/components/HeaderControls";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { communityQuery } from "@/lib/community-query";
import { useI18n } from "@/lib/i18n";
import { ProfileSettingsButton } from "@/components/StudentProfile";
import { ageAt, safeBioLink } from "@/lib/student-profile";

export const Route = createFileRoute("/suggestions")({
  ssr: false,
  loader: ({ context }) => context.queryClient.ensureQueryData(communityQuery),
  head: () => ({ meta: [
    { title: "الاقتراحات ودليل التلاميذ — المكتبة الرقمية المدرسية" },
    { name: "description", content: "اقتراحات التلاميذ ودليل زملاء القسم في المكتبة الرقمية المدرسية." },
    { property: "og:title", content: "الاقتراحات ودليل التلاميذ — المكتبة الرقمية المدرسية" },
    { property: "og:description", content: "اقتراحات التلاميذ ودليل زملاء القسم في المكتبة الرقمية المدرسية." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  pendingComponent: CommunityPending,
  errorComponent: CommunityError,
  notFoundComponent: CommunityUnavailable,
  component: SuggestionsPage,
});

function CommunityPending() {
  const { t } = useI18n();
  return <main className="min-h-screen grid place-items-center"><Loader2 className="size-6 animate-spin text-primary" aria-label={t("loading")} /></main>;
}

function CommunityError({ reset }: { reset: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const router = useRouter();
  return <main className="mx-auto max-w-5xl px-4 py-12 space-y-4">
    <p role="alert">{t("suggestionsFailedLoad")}</p>
    <Button onClick={async () => { await qc.invalidateQueries({ queryKey: communityQuery.queryKey }); await router.invalidate(); reset(); }}>{t("retry")}</Button>
    <Button variant="outline" asChild><Link to="/">{t("backToLibrary")}</Link></Button>
  </main>;
}

function CommunityUnavailable() {
  const { t } = useI18n();
  return <main className="mx-auto max-w-5xl px-4 py-12 space-y-4"><p>{t("suggestionsFailedLoad")}</p><Button asChild><Link to="/">{t("backToLibrary")}</Link></Button></main>;
}

function SuggestionsPage() {
  const { t, lang } = useI18n();
  const { data } = useSuspenseQuery(communityQuery);
  const qc = useQueryClient();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function send() {
    if (!data.allowed || !data.userId || !message.trim() || busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("suggestions").insert({ user_id: data.userId, message: message.trim() });
      if (error) throw error;
      setMessage("");
      await qc.invalidateQueries({ queryKey: communityQuery.queryKey });
      await qc.invalidateQueries({ queryKey: ["admin-suggestions"] });
      toast.success(t("suggestionSent"));
    } catch { toast.error(t("suggestionFailed")); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!data.admin || deleting) return;
    setDeleting(id);
    try {
      const { error } = await supabase.from("suggestions").delete().eq("id", id);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: communityQuery.queryKey });
      await qc.invalidateQueries({ queryKey: ["admin-suggestions"] });
    } catch { toast.error(t("deleteFailed")); }
    finally { setDeleting(null); }
  }

  const students = data.students;
  return <div className="min-h-screen">
    <header className="border-b bg-card">
      <nav className="mx-auto max-w-5xl px-4 py-3 flex flex-wrap items-center gap-2">
        <Button variant="ghost" asChild><Link to="/"><ArrowRight className="size-4" />{t("libraryLink")}</Link></Button>
        <span className="flex-1" />
        <ProfileSettingsButton /><ThemeToggle /><LanguageMenu />
      </nav>
    </header>
    <main className="mx-auto max-w-5xl px-4 py-8 space-y-8">
      <h1 className="flex items-center gap-3 text-2xl font-extrabold"><Lightbulb className="size-6 text-primary shrink-0" />{t("tabSuggestions")}</h1>
      {!data.allowed ? <section className="space-y-4 py-8">
        <p>{data.userId ? t("communityRestricted") : t("communitySignIn")}</p>
        {!data.userId && <Button onClick={async () => {
          const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
          if (result.error) toast.error(t("signInFailed"));
        }}>{t("signIn")}</Button>}
      </section> : <div className="grid gap-10 lg:grid-cols-2">
        <div className="min-w-0 space-y-8">
          <form className="space-y-3" onSubmit={e => { e.preventDefault(); void send(); }}>
            <Label htmlFor="suggestion-message" className="text-base font-bold">{t("sendSuggestion")}</Label>
            <Textarea id="suggestion-message" maxLength={2000} rows={5} placeholder={t("suggestionPlaceholder")} value={message} onChange={e => setMessage(e.target.value)} />
            <Button type="submit" disabled={busy || !message.trim()}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}{t("submit")}</Button>
          </form>
          <section aria-labelledby="suggestion-threads" className="space-y-4">
            <h2 id="suggestion-threads" className="text-lg font-bold">{t("suggestionThreads")}</h2>
            {data.suggestions.length === 0 && <p className="py-6 text-muted-foreground">{t("noSuggestions")}</p>}
            <ul className="space-y-3">{data.suggestions.map(s => <li key={s.id} className="border rounded-lg bg-card p-4 flex gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-bold break-words">{s.profiles?.full_name || t("student")}</p>
                <time className="text-xs text-muted-foreground" dateTime={s.created_at}>{new Date(s.created_at).toLocaleDateString(lang)}</time>
                <p className="whitespace-pre-wrap break-words mt-3">{s.message}</p>
              </div>
              {data.admin && <Button variant="ghost" size="icon" aria-label={t("delete")} disabled={deleting !== null} onClick={() => void remove(s.id)}><Trash2 className="size-4" /></Button>}
            </li>)}</ul>
          </section>
        </div>
        <section aria-labelledby="student-directory" className="min-w-0 space-y-4 border-t pt-6 lg:border-t-0 lg:border-s lg:ps-6 lg:pt-0">
          <h2 id="student-directory" className="flex items-center gap-2 text-lg font-bold"><Users className="size-5 text-school" />{t("studentDirectory")}</h2>
          <ul className="grid gap-3">{students.map(s => {
            const link = safeBioLink(s.bio_link);
            return <li className="rounded-lg border bg-card p-4 space-y-4 min-w-0" key={s.id}>
              <div className="flex items-center gap-3"><span aria-hidden="true" className="size-10 shrink-0 rounded-full bg-accent text-accent-foreground grid place-items-center font-bold">{(s.full_name || t("student")).trim().slice(0, 1)}</span><h3 className="font-bold break-words min-w-0">{s.full_name || t("noName")}</h3></div>
              <dl className="space-y-3 text-sm"><div className="flex gap-2"><GraduationCap className="size-4 text-muted-foreground shrink-0 mt-1" /><div className="min-w-0"><dt className="text-xs text-muted-foreground">{t("classStream")}</dt><dd className="break-words">{s.class_stream || t("notProvided")}</dd></div></div><div className="flex gap-2"><CalendarDays className="size-4 text-muted-foreground shrink-0 mt-1" /><div><dt className="text-xs text-muted-foreground">{t("birthDate")}</dt><dd>{s.birth_date ? <><time dateTime={s.birth_date}>{new Date(`${s.birth_date}T12:00:00`).toLocaleDateString(lang)}</time><span className="text-muted-foreground"> · {t("ageYears", { n: ageAt(s.birth_date) })}</span></> : t("notProvided")}</dd></div></div></dl>
              {link ? <Button variant="outline" size="sm" asChild><a href={link} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-4" />{t("openBioLink")}</a></Button> : <p className="text-xs text-muted-foreground">{t("openBioLink")} · {t("notProvided")}</p>}
            </li>;
          })}</ul>
          {students.length === 0 && <p className="text-sm text-muted-foreground">{t("noUsers")}</p>}
        </section>
      </div>}
    </main>
  </div>;
}