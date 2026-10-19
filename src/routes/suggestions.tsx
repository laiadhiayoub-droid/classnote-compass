import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, Lightbulb, Loader2, Search, Send, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ThemeToggle, LanguageMenu } from "@/components/HeaderControls";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { communityQuery } from "@/lib/community-query";
import { useI18n } from "@/lib/i18n";

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
  component: SuggestionsPage,
});

function CommunityPending() {
  const { t } = useI18n();
  return <main className="min-h-screen grid place-items-center"><Loader2 className="size-6 animate-spin text-primary" aria-label={t("loading")} /></main>;
}

function CommunityError({ reset }: { reset: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  return <main className="mx-auto max-w-5xl px-4 py-12 space-y-4">
    <p role="alert">{t("suggestionsFailedLoad")}</p>
    <Button onClick={() => { void qc.invalidateQueries({ queryKey: communityQuery.queryKey }); reset(); }}>{t("retry")}</Button>
    <Button variant="outline" asChild><Link to="/">{t("backToLibrary")}</Link></Button>
  </main>;
}

function SuggestionsPage() {
  const { t, lang } = useI18n();
  const { data } = useSuspenseQuery(communityQuery);
  const qc = useQueryClient();
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
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

  const students = data.students.filter(s => (s.full_name ?? "").toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  return <div className="min-h-screen">
    <header className="border-b bg-card">
      <nav className="mx-auto max-w-5xl px-4 py-3 flex flex-wrap items-center gap-2">
        <Button variant="ghost" asChild><Link to="/"><ArrowRight className="size-4" />{t("libraryLink")}</Link></Button>
        <span className="flex-1" />
        <ThemeToggle /><LanguageMenu />
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
      </section> : <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
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
          <div className="relative"><Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input className="ps-9" aria-label={t("searchStudents")} placeholder={t("searchStudents")} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <ul className="divide-y border-y">{students.map(s => <li className="py-3 break-words font-medium" key={s.id}>{s.full_name || t("noName")}</li>)}</ul>
          {students.length === 0 && <p className="text-sm text-muted-foreground">{t("noUsers")}</p>}
        </section>
      </div>}
    </main>
  </div>;
}