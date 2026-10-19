import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BookOpen, LogOut, Plus, Search, ArrowUp, ArrowDown, Link2, Loader2, ImagePlus, X,
  NotebookPen, ShieldCheck, BookMarked, FileText, ArrowRight,
  SlidersHorizontal, Star, Trash2, Share2, GraduationCap, Menu, Home, Wand2, ScanText, Layers,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Timetable } from "@/components/Timetable";
import { DhikrPill } from "@/components/DhikrPill";
import { SUBJECTS, CONTENT_TYPES, SEMESTERS, subjectLabelL, contentTypeLabelL, semesterLabelL } from "@/lib/library";
import { BoundNotebookReader } from "@/components/BoundNotebookReader";
import { nextPageNumber, orderedBookPages } from "@/lib/notebook";
import { generateFormattedPage } from "@/lib/notebook.functions";
import { useServerFn } from "@tanstack/react-start";
import { ThemeToggle, LanguageMenu } from "@/components/HeaderControls";
import { ImageEditor } from "@/components/ImageEditor";
import { useI18n } from "@/lib/i18n";
import { SuggestionButton } from "@/components/Suggestions";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { pageBinding, displayEntries, groupPages, parseResourceLinks, isAuthorVisible } from "@/lib/publishing";
import { DEFAULT_EDITS, processImage, renderEdited, type ImageEdits } from "@/lib/image-process";
import { ocrPages } from "@/lib/ocr";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "المكتبة الرقمية المدرسية — 2 ثانوي لغات أجنبية" },
      { name: "description", content: "تصفّح كراريس زملائك في الإسبانية وباقي المواد، وابحث عن الدروس التي غبت عنها." },
      { property: "og:title", content: "المكتبة الرقمية المدرسية" },
      { property: "og:description", content: "كراريس دروس وملخصات تلاميذ 2AS لغات أجنبية — شعبة الإسبانية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Lesson = {
  id: string; user_id: string; title: string; subject: string; content_type: string;
  domain: string | null; unit: string | null; page_number: number; semester: string | null;
  description: string | null; resource_links: string[]; grouped_pages: boolean;
  parent_lesson_id: string | null; image_path: string; order_index: number; created_at: string;
};
type Profile = { id: string; full_name: string | null };
type Book = { userId: string; subject: string; count: number; hasNew: boolean };
type Filters = { subject: string; type: string; semester: string; unit: string };
const EMPTY_FILTERS: Filters = { subject: "all", type: "all", semester: "all", unit: "all" };
const NEW_DAYS = 7;
type View = "books" | "summaries" | "favorites";

function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { setUser(data.user); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  return { user, ready };
}

function Index() {
  const { user, ready } = useUser();
  const qc = useQueryClient();
  const { t, lang } = useI18n();

  const profiles = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name");
      if (error) throw error;
      return data as Profile[];
    },
  });
  const lessons = useQuery({
    queryKey: ["lessons"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lessons").select("*")
        .order("order_index").order("created_at");
      if (error) throw error;
      return data as Lesson[];
    },
  });

  const visibleAuthors = useQuery({ queryKey: ["visible-authors", user?.id], enabled: !!user, queryFn: async () => {
    const { data, error } = await supabase.rpc("visible_author_ids");
    if (error) throw error;
    return new Set(data.map(p => p.id));
  }});
  const myProfile = profiles.data?.find((p) => p.id === user?.id);
  const roles = useQuery({
    queryKey: ["my-roles", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      if (error) throw error;
      return data.map((r) => r.role);
    },
  });
  const isAdmin = !!roles.data?.includes("admin");
  const canPublish = isAdmin || !!roles.data?.includes("writer");
  const needsName = !!user && profiles.isSuccess && !myProfile?.full_name;

  // Hidden-role accounts and their content are invisible to everyone but themselves and admins.
  const authorVisible = useMemo(() => {
    return (userId: string) => isAuthorVisible(userId, user?.id, visibleAuthors.data);
  }, [visibleAuthors.data, user]);

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [bookQ, setBookQ] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [zoom, setZoom] = useState<Lesson | null>(null);
  const [openBook, setOpenBook] = useState<Book | null>(null);
  const [view, setView] = useState<View>("books");
  const [summarySubject, setSummarySubject] = useState("all");
  const [deleting, setDeleting] = useState<Lesson | null>(null);

  function goHome() {
    setFilters(EMPTY_FILTERS); setBookQ(""); setOpenBook(null); setView("books"); setSummarySubject("all"); setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const bookmarks = useQuery({
    queryKey: ["bookmarks", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [] as string[];
      const { data, error } = await supabase.from("bookmarks").select("lesson_id").eq("user_id", user.id);
      if (error) throw error;
      return data.map((b) => b.lesson_id);
    },
  });
  const bookmarked = useMemo(() => new Set(bookmarks.data ?? []), [bookmarks.data]);
  async function toggleBookmark(lessonId: string) {
    if (!user) return;
    if (bookmarked.has(lessonId)) {
      const { error } = await supabase.from("bookmarks").delete().eq("user_id", user.id).eq("lesson_id", lessonId);
      if (error) { toast.error(t("bookmarksFailed")); return; }
    } else {
      const { error } = await supabase.from("bookmarks").insert({ user_id: user.id, lesson_id: lessonId });
      if (error) { toast.error(t("bookmarksFailed")); return; }
    }
    qc.invalidateQueries({ queryKey: ["bookmarks", user.id] });
  }

  async function deleteLesson() {
    const l = deleting;
    if (!l) return;
    const ids = [l.id, ...(lessons.data ?? []).filter((x) => x.parent_lesson_id === l.id).map((x) => x.id)];
    const paths = (lessons.data ?? []).filter((x) => ids.includes(x.id)).map((x) => x.image_path);
    const { error } = await supabase.from("lessons").delete().in("id", ids);
    if (error) { toast.error(t("deleteFailed")); return; }
    if (paths.length) await supabase.storage.from("lessons-images").remove(paths);
    toast.success(t("deleteSuccess"));
    setDeleting(null);
    qc.invalidateQueries({ queryKey: ["lessons"] });
  }

  function shareLesson(l: Lesson) {
    const url = `${window.location.origin}/?lesson=${l.id}`;
    void navigator.clipboard.writeText(url).then(() => toast.success(t("linkCopied")), () => toast.error(t("linkCopyFailed")));
  }

  // Open a shared lesson link (?lesson=<id>)
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("lesson");
    if (!id || !lessons.data || zoom) return;
    const target = lessons.data.find((l) => l.id === id);
    if (!target) return;
    setOpenBook({ userId: target.user_id, subject: target.subject, count: 0, hasNew: false });
    setZoom(target);
  }, [lessons.data, zoom]);

  const nameOf = (id: string) => visibleAuthors.data?.has(id) ? profiles.data?.find((p) => p.id === id)?.full_name || t("student") : t("student");

  // Tier 1: book covers — one card per (student, subject) notebook
  const books = useMemo(() => {
    const cutoff = Date.now() - NEW_DAYS * 24 * 60 * 60 * 1000;
    const map = new Map<string, Book>();
    for (const l of displayEntries(lessons.data ?? [])) {
      if (!authorVisible(l.user_id)) continue;
      if (filters.subject !== "all" && l.subject !== filters.subject) continue;
      if (filters.type !== "all" && l.content_type !== filters.type) continue;
      if (filters.semester !== "all" && l.semester !== filters.semester) continue;
      if (filters.unit !== "all" && l.unit !== filters.unit) continue;
      const key = `${l.user_id}:${l.subject}`;
      const b = map.get(key) ?? { userId: l.user_id, subject: l.subject, count: 0, hasNew: false };
      b.count++;
      if (new Date(l.created_at).getTime() >= cutoff) b.hasNew = true;
      map.set(key, b);
    }
    return [...map.values()].sort((a, b) => nameOf(a.userId).localeCompare(nameOf(b.userId), lang));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessons.data, filters, profiles.data, authorVisible, lang]);

  // Tier 2: lessons inside the open book (searchable within the notebook)
  const bookLessons = useMemo(() => {
    if (!openBook) return [];
    const term = bookQ.trim().toLowerCase();
    return orderedBookPages(
      (lessons.data ?? []).filter((l) =>
        l.user_id === openBook.userId && l.subject === openBook.subject &&
        (!term || [l.title, l.domain, l.unit].some((v) => v?.toLowerCase().includes(term)))),
    );
  }, [lessons.data, openBook, bookQ]);

  // Number of photos merged into one grouped card (root + continuation pages).
  const pageCountOf = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of lessons.data ?? []) {
      if (l.parent_lesson_id) counts.set(l.parent_lesson_id, (counts.get(l.parent_lesson_id) ?? 0) + 1);
    }
    return (l: Lesson) => 1 + (counts.get(l.id) ?? 0);
  }, [lessons.data]);

  // Group notebook pages by semester, then by unit
  const groupedBookLessons = useMemo(() => {
    const groups: { semester: string; units: { unit: string; items: Lesson[] }[] }[] = [];
    for (const l of displayEntries(bookLessons)) {
      const s = l.semester || "none";
      const u = l.unit || "none";
      let sg = groups.find((g) => g.semester === s);
      if (!sg) { sg = { semester: s, units: [] }; groups.push(sg); }
      let ug = sg.units.find((x) => x.unit === u);
      if (!ug) { ug = { unit: u, items: [] }; sg.units.push(ug); }
      ug.items.push(l);
    }
    return groups;
  }, [bookLessons]);

  const unitOptions = useMemo(() => {
    const set = new Set<string>();
    for (const l of lessons.data ?? []) if (l.unit) set.add(l.unit);
    return [...set].sort((a, b) => a.localeCompare(b, lang));
  }, [lessons.data, lang]);

  const summaries = useMemo(() => {
    return displayEntries(lessons.data ?? [])
      .filter((l) => authorVisible(l.user_id))
      .filter((l) => l.content_type === "summary" && (summarySubject === "all" || l.subject === summarySubject))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessons.data, summarySubject, authorVisible]);

  const favoriteLessons = useMemo(() => {
    return (lessons.data ?? []).filter((l) => bookmarked.has(l.id) && authorVisible(l.user_id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessons.data, bookmarked, authorVisible]);

  const isOwnerBook = !!user && openBook?.userId === user.id;

  async function move(index: number, dir: -1 | 1) {
    const a = bookLessons[index], b = bookLessons[index + dir];
    if (!a || !b) return;
    const updates = bookLessons.map((l, i) => ({ id: l.id, order_index: i }));
    const first = updates[index], second = updates[index + dir];
    if (!first || !second) return;
    first.order_index = index + dir;
    second.order_index = index;
    const results = await Promise.all(
      updates.map((u) => supabase.from("lessons").update({ order_index: u.order_index }).eq("id", u.id)),
    );
    if (results.some((r) => r.error)) toast.error(t("orderFailed"));
    else toast.success(t("orderSaved"));
    qc.invalidateQueries({ queryKey: ["lessons"] });
  }

  async function signIn() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error(t("signInFailed"));
  }
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    setFilters(EMPTY_FILTERS);
    setBookQ("");
    setOpenBook(null);
    setView("books");
    toast(t("signOutDone"));
  }

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto max-w-5xl px-3 sm:px-4 py-3 flex items-center gap-2 sm:gap-3">
          <button type="button" onClick={goHome} aria-label={t("home")} className="flex flex-1 min-w-0 items-center gap-2 sm:gap-3 text-start rounded-lg">
            <span className="size-10 shrink-0 rounded-lg bg-primary text-primary-foreground grid place-items-center">
              <BookOpen className="size-5" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-display font-extrabold text-base sm:text-lg leading-tight truncate">{t("appTitle")}</span>
              <span className="block text-xs text-muted-foreground truncate">{t("appSubtitle")}</span>
            </span>
          </button>
          {user && <SuggestionButton userId={user.id} />}
          <ThemeToggle />
          <LanguageMenu />
          {ready && (user ? (
            <>
              <div className="hidden md:flex items-center gap-2 shrink-0">
                <span className="text-sm text-muted-foreground">{myProfile?.full_name}</span>
                {isAdmin && (
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/admin"><ShieldCheck className="size-4" /> {t("dashboard")}</Link>
                  </Button>
                )}
                <Button size="sm" onClick={() => setUploadOpen(true)} disabled={needsName}>
                  <Plus className="size-4" /> {canPublish ? t("addLesson") : t("addSummary")}
                </Button>
                <Button size="icon" variant="ghost" onClick={signOut} aria-label={t("signOut")}>
                  <LogOut className="size-4" />
                </Button>
              </div>
              <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                <SheetTrigger asChild>
                  <Button size="icon" variant="outline" className="md:hidden shrink-0 size-11" aria-label={t("menu")}>
                    <Menu className="size-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 flex flex-col gap-3 pt-12">
                  <SheetTitle className="text-start">{myProfile?.full_name || t("menu")}</SheetTitle>
                  <Button className="h-12 justify-start" onClick={() => { setMenuOpen(false); setUploadOpen(true); }} disabled={needsName}>
                    <Plus className="size-4" /> {canPublish ? t("addLesson") : t("addSummary")}
                  </Button>
                  {isAdmin && (
                    <Button className="h-12 justify-start" variant="outline" asChild>
                      <Link to="/admin" onClick={() => setMenuOpen(false)}><ShieldCheck className="size-4" /> {t("dashboard")}</Link>
                    </Button>
                  )}
                  <Button className="h-12 justify-start" variant="ghost" onClick={() => { setMenuOpen(false); signOut(); }}>
                    <LogOut className="size-4" /> {t("signOut")}
                  </Button>
                </SheetContent>
              </Sheet>
            </>
          ) : (
            <Button size="sm" className="shrink-0 h-10" onClick={signIn}>
              <span className="sm:hidden">{t("signInShort")}</span>
              <span className="hidden sm:inline">{t("signIn")}</span>
            </Button>
          ))}
        </div>
      </header>

      {!openBook && <div className="mx-auto max-w-5xl px-4 pt-6"><Timetable /></div>}

      {ready && !user ? (
        <main className="mx-auto max-w-xl px-4 py-16">
          <div className="notebook-paper margin-line rounded-xl p-10 text-center space-y-4">
            <BookOpen className="mx-auto size-10 text-primary" />
            <h2 className="text-2xl font-extrabold">{t("libraryOfNotebooks")}</h2>
            <p className="text-muted-foreground">{t("signInPrompt")}</p>
            <Button onClick={signIn}>{t("signIn")}</Button>
          </div>
        </main>
      ) : (
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        {openBook ? (
          /* ============ Tier 2: Lesson List View (داخل الكراس) ============ */
          <section className="space-y-5">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => setOpenBook(null)}>
                <ArrowRight className="size-4" /> {t("allBooks")}
              </Button>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-extrabold leading-tight">
                  {t("notebookOf", { subject: subjectLabelL(openBook.subject, lang), name: nameOf(openBook.userId) })}
                </h2>
                <p className="text-sm text-muted-foreground">{t("pagesCount", { n: bookLessons.length })}</p>
              </div>
              {bookLessons[0] && (
                <Button variant="outline" size="sm" onClick={() => { const first = bookLessons[0]; if (first) shareLesson(first); }}>
                  <Share2 className="size-4" /> {t("copyLink")}
                </Button>
              )}
            </div>

            <div className="relative max-w-md">
              <Search className="size-4 absolute top-1/2 -translate-y-1/2 start-3 text-muted-foreground" />
              <Input className="ps-9 bg-card" value={bookQ} onChange={(e) => setBookQ(e.target.value)}
                placeholder={t("searchInBook")} />
            </div>

            {bookLessons.length === 0 ? (
              <div className="notebook-paper margin-line rounded-xl p-12 text-center text-muted-foreground">
                <NotebookPen className="mx-auto mb-3 size-8" />
                {t("noLessonsInBook")}
              </div>
            ) : (
              <div className="space-y-6">
                {groupedBookLessons.map((sg) => (
                  <section key={sg.semester} className="space-y-3">
                    <h3 className="flex items-center gap-2 text-base font-extrabold text-primary">
                      <span className="h-px flex-1 bg-border" />
                      {sg.semester === "none" ? t("noSemester") : semesterLabelL(sg.semester, lang)}
                      <span className="h-px flex-1 bg-border" />
                    </h3>
                    {sg.units.map((ug) => (
                      <div key={ug.unit} className="space-y-2">
                        {ug.unit !== "none" && (
                          <p className="text-sm font-bold text-muted-foreground">{ug.unit}</p>
                        )}
                        <ol className="space-y-2">
                          {ug.items.map((l) => {
                            const i = bookLessons.indexOf(l);
                            return (
                              <LessonRow key={l.id} lesson={l}
                                parent={lessons.data?.find((p) => p.id === l.parent_lesson_id)}
                                pageCount={pageCountOf(l)}
                                starred={bookmarked.has(l.id)} onStar={() => toggleBookmark(l.id)}
                                onShare={() => shareLesson(l)}
                                onDelete={isAdmin ? () => setDeleting(l) : undefined}
                                onOpen={() => setZoom(l)}
                                controls={isOwnerBook ? {
                                  up: i > 0 ? () => move(i, -1) : undefined,
                                  down: i < bookLessons.length - 1 ? () => move(i, 1) : undefined,
                                } : undefined} />
                            );
                          })}
                        </ol>
                      </div>
                    ))}
                  </section>
                ))}
              </div>
            )}
          </section>
        ) : (
          /* ============ Tier 1: Book Covers (أغلفة الكراريس) ============ */
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <h2 className="text-xl font-extrabold">
                  {view === "books" ? t("books") : view === "summaries" ? t("summaries") : t("favorites")}
                </h2>
                <span className="text-sm text-muted-foreground">
                  {view === "books" ? t("countBooks", { n: books.length }) : view === "summaries" ? t("countSummaries", { n: summaries.length }) : t("countItems", { n: favoriteLessons.length })}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant={view === "books" && !Object.values(filters).some((v) => v !== "all") ? "default" : "outline"} size="sm" onClick={goHome}>
                  <Home className="size-4" /> {t("home")}
                </Button>
                <Button variant={view === "summaries" ? "default" : "outline"} size="sm" onClick={() => setView(view === "summaries" ? "books" : "summaries")}>
                  <GraduationCap className="size-4" /> {t("summaries")}
                </Button>
                <Button variant={view === "favorites" ? "default" : "outline"} size="sm" onClick={() => setView(view === "favorites" ? "books" : "favorites")}>
                  <Star className="size-4" /> {t("favorites")}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setFilterOpen(true)}
                  className={Object.values(filters).some((v) => v !== "all") ? "border-primary text-primary" : ""}>
                  <SlidersHorizontal className="size-4" /> {t("filter")}
                  {Object.values(filters).filter((v) => v !== "all").length > 0 && (
                    <Badge className="ms-1 px-1.5 py-0 text-[10px]">{Object.values(filters).filter((v) => v !== "all").length}</Badge>
                  )}
                </Button>
              </div>
            </div>

            {view === "summaries" ? (
              <section className="space-y-4">
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                  {[{ id: "all", label: t("allSubjects") }, ...SUBJECTS.map(s => ({ id: s.id, label: s.labels[lang] }))].map((s) => (
                    <button key={s.id} onClick={() => setSummarySubject(s.id)}
                      className={`shrink-0 rounded-full border px-4 py-1.5 text-sm transition ${summarySubject === s.id ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground hover:bg-secondary"}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
                {summaries.length === 0 ? (
                  <div className="notebook-paper margin-line rounded-xl p-12 text-center text-muted-foreground">
                    <GraduationCap className="mx-auto mb-3 size-8" />
                    {t("noSummariesHere")}
                  </div>
                ) : (
                  <ol className="space-y-2">
                    {summaries.map((l) => (
                      <LessonRow key={l.id} lesson={l} author={nameOf(l.user_id)} pageCount={pageCountOf(l)}
                        starred={bookmarked.has(l.id)} onStar={() => toggleBookmark(l.id)}
                        onShare={() => shareLesson(l)}
                        onDelete={isAdmin ? () => setDeleting(l) : undefined}
                        onOpen={() => {
                          setOpenBook({ userId: l.user_id, subject: l.subject, count: 0, hasNew: false });
                          setZoom(l);
                        }} />
                    ))}
                  </ol>
                )}
              </section>
            ) : view === "favorites" ? (
              favoriteLessons.length === 0 ? (
                <div className="notebook-paper margin-line rounded-xl p-12 text-center text-muted-foreground">
                  <Star className="mx-auto mb-3 size-8" />
                  {t("noFavorites")}
                </div>
              ) : (
                <ol className="space-y-2">
                  {favoriteLessons.map((l) => (
                    <LessonRow key={l.id} lesson={l} author={nameOf(l.user_id)} pageCount={pageCountOf(l)}
                      starred={true} onStar={() => toggleBookmark(l.id)}
                      onShare={() => shareLesson(l)}
                      onDelete={isAdmin ? () => setDeleting(l) : undefined}
                      onOpen={() => {
                        setOpenBook({ userId: l.user_id, subject: l.subject, count: 0, hasNew: false });
                        setZoom(l);
                      }} />
                  ))}
                </ol>
              )
            ) : lessons.isLoading ? (
              <div className="py-20 grid place-items-center"><Loader2 className="animate-spin text-primary" /></div>
            ) : books.length === 0 ? (
              <div className="notebook-paper margin-line rounded-xl p-12 text-center text-muted-foreground">
                <NotebookPen className="mx-auto mb-3 size-8" />
                {t("noMatchingBooks")}
              </div>
            ) : (
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {books.map((b) => (
                  <BookCover key={`${b.userId}:${b.subject}`} book={b} onOpen={() => setOpenBook(b)} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
      )}
      <DhikrPill />

      {needsName && user && <NameDialog userId={user.id} onDone={() => qc.invalidateQueries({ queryKey: ["profiles"] })} />}
      <FilterDialog open={filterOpen} onOpenChange={setFilterOpen} filters={filters} onApply={setFilters} units={unitOptions} />
      <Dialog open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="pe-8">{t("deleteConfirmTitle")}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{t("deleteConfirmDesc", { title: deleting?.title ?? "" })}</p>
          <div className="flex flex-col-reverse sm:flex-row gap-2">
            <Button variant="destructive" className="h-11 sm:flex-1" onClick={deleteLesson}>{t("yesDelete")}</Button>
            <Button variant="outline" className="h-11 sm:flex-1" onClick={() => setDeleting(null)}>{t("cancel")}</Button>
          </div>
        </DialogContent>
      </Dialog>
      {user && canPublish && (
        <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} userId={user.id}
          defaultSubject={filters.subject === "all" ? "spanish" : filters.subject}
          myLessons={(lessons.data ?? []).filter((l) => l.user_id === user.id)}
          onDone={() => qc.invalidateQueries({ queryKey: ["lessons"] })} />
      )}
      {user && !canPublish && (
        <SummaryDialog open={uploadOpen} onOpenChange={setUploadOpen} userId={user.id}
          defaultSubject={filters.subject === "all" ? "spanish" : filters.subject}
          myLessons={(lessons.data ?? []).filter((l) => l.user_id === user.id)}
          onDone={() => qc.invalidateQueries({ queryKey: ["lessons"] })} />
      )}
      <BoundNotebookReader pages={zoom ? groupPages(bookLessons, zoom) : bookLessons} initialId={zoom?.id ?? null} roles={roles.data ?? []} onClose={() => setZoom(null)} />
    </div>
  );
}

/* ---------- Tier 1: 3D book cover (no author name) ---------- */
function BookCover({ book, onOpen }: { book: Book; onOpen: () => void }) {
  const { t, lang } = useI18n();
  const sub = SUBJECTS.find((s) => s.id === book.subject);
  return (
    <button onClick={onOpen}
      className="group relative text-start rounded-xl border bg-card overflow-hidden shadow-[0_10px_24px_-14px_oklch(0.3_0.05_40/45%),inset_0_1px_0_oklch(1_0_0/60%)] transition duration-300 hover:shadow-[0_18px_36px_-16px_oklch(0.3_0.05_40/50%)] hover:-translate-y-1 hover:rotate-[-0.5deg] focus-visible:ring-2 focus-visible:ring-primary">
      <div className="absolute inset-y-0 start-0 w-2.5 bg-gradient-to-b from-primary via-primary/90 to-primary/70" />
      <div className="absolute inset-y-0 start-2.5 w-px bg-foreground/10" />
      {book.hasNew && (
        <span className="absolute top-3 end-3 rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-bold text-accent-foreground shadow-sm animate-pulse">{t("newBadge")}</span>
      )}
      <div className="p-5 ps-8 space-y-4 min-h-44 flex flex-col">
        <BookMarked className="size-10 sm:size-8 text-primary transition-transform duration-300 group-hover:scale-110" />
        <div className="flex-1 space-y-1.5">
          <Badge variant="secondary" className="text-[10px]">{sub?.sub || t("subjectFallback")}</Badge>
          <h3 className="font-extrabold text-base leading-snug">{sub?.labels[lang] ?? book.subject}</h3>
        </div>
        <span className="self-start inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-bold">
          <FileText className="size-3.5" /> {book.count} {book.count > 2 ? t("lessonWordPlural") : t("lessonWord")}
        </span>
      </div>
    </button>
  );
}

/* ---------- Filter modal ---------- */
function FilterDialog({ open, onOpenChange, filters, onApply, units }: {
  open: boolean; onOpenChange: (o: boolean) => void; filters: Filters; onApply: (f: Filters) => void;
  units: string[];
}) {
  const { t, lang } = useI18n();
  const [draft, setDraft] = useState<Filters>(filters);
  useEffect(() => { if (open) setDraft(filters); }, [open, filters]);
  const set = (k: keyof Filters) => (v: string) => setDraft((d) => ({ ...d, [k]: v }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2 pe-8"><SlidersHorizontal className="size-5 shrink-0" /> {t("filterNotebooks")}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("subject")}</Label>
            <Select value={draft.subject} onValueChange={set("subject")}>
              <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allSubjects")}</SelectItem>
                {SUBJECTS.map((s) => <SelectItem key={s.id} value={s.id}>{s.labels[lang]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("contentType")}</Label>
            <Select value={draft.type} onValueChange={set("type")}>
              <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("all")}</SelectItem>
                {CONTENT_TYPES.map((c) => <SelectItem key={c.id} value={c.id}>{c.labels[lang]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("semester")}</Label>
            <Select value={draft.semester} onValueChange={set("semester")}>
              <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allSemesters")}</SelectItem>
                {SEMESTERS.map((s) => <SelectItem key={s.id} value={s.id}>{s.labels[lang]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("unitDomain")}</Label>
            <Select value={draft.unit} onValueChange={set("unit")}>
              <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allUnits")}</SelectItem>
                {units.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 pt-1">
            <Button className="flex-1" onClick={() => { onApply(draft); onOpenChange(false); }}>{t("applyFilter")}</Button>
            <Button variant="outline" onClick={() => { setDraft(EMPTY_FILTERS); onApply(EMPTY_FILTERS); onOpenChange(false); }}>{t("resetFilter")}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Tier 2: clean lesson row (no thumbnail) ---------- */
function LessonRow({ lesson: l, parent, author, pageCount, starred, onStar, onShare, onDelete, onOpen, controls }: {
  lesson: Lesson; parent?: Lesson | undefined; author?: string | undefined; pageCount?: number | undefined;
  starred?: boolean | undefined; onStar?: (() => void) | undefined;
  onShare?: (() => void) | undefined; onDelete?: (() => void) | undefined;
  onOpen: () => void;
  controls?: { up: (() => void) | undefined; down: (() => void) | undefined } | undefined;
}) {
  const { t, lang } = useI18n();
  const pages = pageCount ?? 1;
  return (
    <li className="flex items-center gap-2">
      <button onClick={onOpen}
        className="flex-1 min-w-0 flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-start transition hover:bg-secondary/60 hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary">
        <span className="shrink-0 size-9 rounded-md bg-primary/10 text-primary grid place-items-center">
          {pages > 1 ? <Layers className="size-4.5" /> : <FileText className="size-4.5" />}
        </span>
        <span className="flex-1 min-w-0 space-y-0.5">
          <span className="block font-bold truncate">{l.title}</span>
          {author && <span className="block text-[11px] text-primary font-semibold">{author}</span>}
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <Badge className={`text-[10px] px-1.5 py-0 ${l.content_type === "summary" ? "bg-summary text-summary-foreground" : ""}`}>
              {contentTypeLabelL(l.content_type, lang)}
            </Badge>
            {pages > 1 && <span className="inline-flex items-center gap-0.5 font-semibold text-primary"><Layers className="size-3" /> {t("pagesN", { n: pages })}</span>}
            {l.unit && <span>{l.unit}</span>}
            {l.semester && <span>· {semesterLabelL(l.semester, lang)}</span>}
            {l.domain && <span>· {l.domain}</span>}
            {parent && <span className="text-primary inline-flex items-center gap-0.5"><Link2 className="size-3" /> {t("continuation", { title: parent.title })}</span>}
          </span>
        </span>
        <span className="shrink-0 text-end text-xs text-muted-foreground space-y-0.5">
          <Badge variant="outline" className="block">{pages > 1 ? t("pagesN", { n: pages }) : t("pageN", { n: l.page_number })}</Badge>
          <span className="block">{new Date(l.created_at).toLocaleDateString(lang)}</span>
        </span>
      </button>
      <span className="flex flex-col gap-1.5 shrink-0">
        {onStar && (
          <Button size="icon" variant="ghost" className="size-10 sm:size-8" onClick={onStar}
            aria-label={starred ? t("removeFavorite") : t("addFavorite")}>
            <Star className={`size-4 ${starred ? "fill-accent stroke-accent" : ""}`} />
          </Button>
        )}
        {onShare && (
          <Button size="icon" variant="ghost" className="size-10 sm:size-8" onClick={onShare} aria-label={t("copyLink")}>
            <Share2 className="size-3.5" />
          </Button>
        )}
        {onDelete && (
          <Button size="icon" variant="ghost" className="size-10 sm:size-8 text-destructive hover:bg-destructive/10" onClick={onDelete} aria-label={t("delete")}>
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </span>
      {controls && (
        <span className="flex flex-col gap-1.5 shrink-0">
          <Button size="icon" variant="outline" className="size-10 sm:size-8" disabled={!controls.up}
            onClick={controls.up} aria-label={t("moveUp")}><ArrowUp className="size-3.5" /></Button>
          <Button size="icon" variant="outline" className="size-10 sm:size-8" disabled={!controls.down}
            onClick={controls.down} aria-label={t("moveDown")}><ArrowDown className="size-3.5" /></Button>
        </span>
      )}
    </li>
  );
}

function NameDialog({ userId, onDone }: { userId: string; onDone: () => void }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy) return;
    if (name.trim().length < 3) { toast.error(t("nameError")); return; }
    setBusy(true);
    const { error } = await supabase.from("profiles").upsert({ id: userId, full_name: name.trim() });
    setBusy(false);
    if (error) { toast.error(t("nameSaveFailed")); return; }
    toast.success(t("welcomeToast"));
    setDone(true);
    onDone();
  }
  return (
    <Dialog open={!done}>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="[&>button.absolute]:hidden"
      >
        <DialogHeader><DialogTitle className="pe-8">{t("welcomeNameTitle")}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <Label htmlFor="fn">{t("fullNameLabel")}</Label>
          <Input id="fn" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t("namePlaceholder")} />
          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="animate-spin size-4" />} {t("confirmSave")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Shared upload plumbing ---------- */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`timeout:${label}`)), ms);
    }),
  ]).finally(() => { if (timer) clearTimeout(timer); });
}

type PhotoListProps = {
  files: File[]; setFiles: React.Dispatch<React.SetStateAction<File[]>>;
  edits: ImageEdits[]; setEdits: React.Dispatch<React.SetStateAction<ImageEdits[]>>;
  busy: boolean; setEditing: (i: number | null) => void;
};

/** Multi-photo picker with manual reordering and removal. */
function PhotoPicker({ files, setFiles, setEdits, busy, setEditing }: PhotoListProps) {
  const { t } = useI18n();
  const swap = <T,>(prev: T[], i: number, j: number) => {
    const next = [...prev]; const a = next[i], b = next[j];
    if (a !== undefined && b !== undefined) { next[i] = b; next[j] = a; }
    return next;
  };
  return <>
    <ol className="space-y-2">
      {files.map((file, i) => <li key={`${file.name}-${i}`} className="flex flex-wrap items-center gap-1 rounded-md border p-2 text-sm">
        <span className="text-muted-foreground shrink-0">{i + 1}</span><span className="flex-1 min-w-0 basis-[70%] truncate">{file.name}</span>
        <Button size="icon" variant="ghost" className="size-10" disabled={busy} aria-label={t("editImage", { n: i + 1 })} onClick={() => setEditing(i)}><Wand2 className="size-4" /></Button>
        <Button size="icon" variant="ghost" className="size-10" disabled={busy || i === 0} aria-label={t("moveImageUp", { n: i + 1 })} onClick={() => { setFiles(p => swap(p, i, i - 1)); setEdits(p => swap(p, i, i - 1)); }}><ArrowUp className="size-4" /></Button>
        <Button size="icon" variant="ghost" className="size-10" disabled={busy || i === files.length - 1} aria-label={t("moveImageDown", { n: i + 1 })} onClick={() => { setFiles(p => swap(p, i, i + 1)); setEdits(p => swap(p, i, i + 1)); }}><ArrowDown className="size-4" /></Button>
        <Button size="icon" variant="ghost" className="size-10" disabled={busy} aria-label={t("removeImage", { n: i + 1 })} onClick={() => { setFiles(p => p.filter((_, j) => j !== i)); setEdits(p => p.filter((_, j) => j !== i)); }}><X className="size-4" /></Button>
      </li>)}
    </ol>
    {files.length > 0 && <p className="text-[11px] text-muted-foreground">{t("optimizeHint")}</p>}
  </>;
}

/** Smart OCR button: extracts Word-style text + unit/domain from all picked photos. */
function OcrButton({ files, edits, onText, onUnit, onDomain }: {
  files: File[]; edits: ImageEdits[];
  onText: (text: string) => void; onUnit?: ((unit: string) => void) | undefined; onDomain?: ((domain: string) => void) | undefined;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  async function run() {
    if (busy || files.length === 0) return;
    setBusy(true);
    try {
      const canvases: HTMLCanvasElement[] = [];
      for (const [i, file] of files.entries()) canvases.push(await renderEdited(file, edits[i] ?? DEFAULT_EDITS, 1600));
      const result = await ocrPages(canvases);
      if (result.text) onText(result.text);
      if (result.unit && onUnit) onUnit(result.unit);
      if (result.domain && onDomain) onDomain(result.domain);
      if (result.text) toast.success(t("ocrDone"));
      else toast.error(t("ocrFailed"));
    } catch { toast.error(t("ocrFailed")); }
    finally { setBusy(false); }
  }
  return (
    <Button type="button" variant="outline" className="w-full" disabled={busy || files.length === 0} onClick={run}>
      {busy ? <Loader2 className="animate-spin size-4" /> : <ScanText className="size-4" />}
      {busy ? t("ocrExtracting") : t("ocrExtract")}
    </Button>
  );
}

type LessonInsert = Database["public"]["Tables"]["lessons"]["Insert"];

/** Upload photos for the current user and build lesson rows (grouped as one card). */
async function uploadPhotoRows(opts: {
  files: File[]; edits: ImageEdits[]; userId: string; grouped: boolean;
  rootId: string; parentId: string | null; startPage: number; order: number;
  onProgress: (msg: string) => void; progressLabel: (i: number, n: number) => string;
  buildRow: (i: number, path: string) => Record<string, unknown>;
}): Promise<LessonInsert[]> {
  const paths: string[] = [];
  const rows: LessonInsert[] = [];
  try {
    for (const [i, file] of opts.files.entries()) {
      opts.onProgress(opts.progressLabel(i + 1, opts.files.length));
      const blob = await withTimeout(processImage(file, opts.edits[i] ?? DEFAULT_EDITS), 30000, "compress");
      const ext = blob.type === "image/webp" ? "webp" : "jpg";
      const path = `${opts.userId}/${crypto.randomUUID()}.${ext}`;
      const up = await withTimeout(
        supabase.storage.from("lessons-images").upload(path, blob, { contentType: blob.type }),
        60000, "upload",
      );
      if (up.error) throw up.error;
      paths.push(path);
      rows.push({ ...pageBinding(i, opts.grouped, opts.rootId, opts.parentId, opts.startPage), order_index: opts.order + i, image_path: path, ...opts.buildRow(i, path) } as LessonInsert);
    }
    const { error } = await supabase.from("lessons").insert(rows);
    if (error) throw error;
    return rows;
  } catch (cause) {
    if (paths.length) await supabase.storage.from("lessons-images").remove(paths);
    throw cause;
  }
}

function backgroundFormat(rows: LessonInsert[], generate: ReturnType<typeof useServerFn<typeof generateFormattedPage>>) {
  void (async () => {
    for (const row of rows) {
      if (!row.id) continue;
      try { const result = await generate({ data: { lessonId: row.id } }); if (result.status === "error") break; }
      catch { break; }
    }
  })();
}

/* ---------- Writer upload dialog (lessons + summaries) ---------- */
function UploadDialog({ open, onOpenChange, userId, defaultSubject, myLessons, onDone }: {
  open: boolean; onOpenChange: (o: boolean) => void; userId: string;
  defaultSubject: string; myLessons: Lesson[]; onDone: () => void;
}) {
  const { t, lang } = useI18n();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [type, setType] = useState<string>("lesson");
  const [semester, setSemester] = useState<string>("s1");
  const [domain, setDomain] = useState("");
  const [unit, setUnit] = useState("");
  const [description, setDescription] = useState("");
  const [links, setLinks] = useState("");
  const [grouped, setGrouped] = useState(true);
  const [isCont, setIsCont] = useState(false);
  const [parentId, setParentId] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [edits, setEdits] = useState<ImageEdits[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [progress, setProgress] = useState("");
  const generate = useServerFn(generateFormattedPage);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) setSubject(defaultSubject); }, [open, defaultSubject]);
  const notebook = myLessons.filter((l) => l.subject === subject);
  const roots = notebook.filter((l) => !l.parent_lesson_id);

  function resetForm() {
    setDescription(""); setLinks(""); setGrouped(true); setTitle(""); setDomain(""); setUnit(""); setIsCont(false); setParentId("");
    setFiles([]); setEdits([]); setType("lesson"); setSemester("s1"); setProgress("");
  }

  async function submit() {
    if (busy) return;
    if (!title.trim()) { toast.error(t("titleRequired")); return; }
    if (!files.length) { toast.error(t("photosRequired")); return; }
    if (isCont && !parentId) { toast.error(t("parentRequired")); return; }
    let resourceLinks: string[];
    try { resourceLinks = parseResourceLinks(links); } catch { toast.error(t("linksInvalid")); return; }
    setBusy(true);
    try {
      const parent = isCont ? notebook.find((l) => l.id === parentId) : undefined;
      const rootId = parent?.id ?? crypto.randomUUID();
      const pageNumber = nextPageNumber(notebook, parent?.id ?? null);
      const order = notebook.reduce((m, l) => Math.max(m, l.order_index), -1) + 1;
      const rows = await uploadPhotoRows({
        files, edits, userId, grouped, rootId, parentId: parent?.id ?? null, startPage: pageNumber, order,
        onProgress: setProgress,
        progressLabel: (i, n) => t("uploadingPage", { i, n }),
        buildRow: () => ({
          user_id: userId, title: title.trim(), subject, content_type: type,
          semester, domain: domain.trim() || null, unit: unit.trim() || null,
          description: description.trim() || null, resource_links: resourceLinks,
        }),
      });
      onDone();
      toast.success(type === "summary" ? t("summarySaved") : t("pagesSaved"));
      resetForm();
      onOpenChange(false);
      backgroundFormat(rows, generate);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      if (message.startsWith("timeout:")) toast.error(t("uploadTimeout"));
      else if (message) toast.error(t("uploadFailed", { message }));
      else toast.error(t("uploadError"));
    } finally { setBusy(false); setProgress(""); }
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle className="pe-8">{t("addLessonOrSummary")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label htmlFor="upload-title">{t("lessonTitle")}</Label>
            <Input id="upload-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("titlePlaceholder")} /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>{t("subject")}</Label>
              <Select value={subject} onValueChange={(v) => { setSubject(v); setParentId(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SUBJECTS.map((s) => <SelectItem key={s.id} value={s.id}>{s.labels[lang]}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1.5"><Label>{t("contentType")}</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CONTENT_TYPES.map((c) => <SelectItem key={c.id} value={c.id}>{c.labels[lang]}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1.5"><Label>{t("semesterRequired")}</Label>
              <Select value={semester} onValueChange={setSemester}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SEMESTERS.map((s) => <SelectItem key={s.id} value={s.id}>{s.labels[lang]}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1.5"><Label>{t("domainLabel")}</Label>
              <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder={t("domainPlaceholder")} /></div>
            <div className="space-y-1.5"><Label>{t("unitLabel")}</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder={t("unitPlaceholder")} /></div>
          </div>
          <OcrButton files={files} edits={edits} onText={setDescription}
            onUnit={(u) => setUnit((v) => v.trim() ? v : u)} onDomain={(d) => setDomain((v) => v.trim() ? v : d)} />
          <div className="space-y-1.5"><Label htmlFor="summary-details">{t("extraDetails")}</Label><Textarea id="summary-details" rows={5} value={description} onChange={e => setDescription(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="resource-links">{t("externalLinks")}</Label><Textarea id="resource-links" dir="ltr" value={links} onChange={e => setLinks(e.target.value)} placeholder={t("resourceLinksPlaceholder")} /></div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={isCont} onCheckedChange={(v) => setIsCont(!!v)} disabled={roots.length === 0} />
            {t("continuationToggle")} {roots.length === 0 && <span className="text-muted-foreground">{t("noPreviousLessons")}</span>}
          </label>
          {isCont && (
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger><SelectValue placeholder={t("previousLesson")} /></SelectTrigger>
              <SelectContent>{roots.map((l) => <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-5 cursor-pointer hover:bg-secondary text-sm text-muted-foreground">
            <ImagePlus className="size-6" /> {t("addNotebookPages")}
            <input type="file" accept="image/*" multiple disabled={busy} className="hidden" onChange={(e) => {
              const added = Array.from(e.target.files ?? []).filter(f => f.type.startsWith("image/"));
              setFiles(previous => [...previous, ...added]);
              setEdits(previous => [...previous, ...added.map(() => DEFAULT_EDITS)]);
              e.target.value = "";
            }} />
          </label>
          {files.length > 1 && <label className="flex items-center gap-3 text-sm py-2"><Switch checked={grouped} disabled={busy || isCont} onCheckedChange={setGrouped} />{type === "summary" ? t("groupSummary") : t("groupLesson")}</label>}
          <PhotoPicker files={files} setFiles={setFiles} edits={edits} setEdits={setEdits} busy={busy} setEditing={setEditing} />
          <ImageEditor file={editing !== null ? files[editing] ?? null : null} edits={editing !== null ? edits[editing] ?? DEFAULT_EDITS : DEFAULT_EDITS}
            open={editing !== null} onOpenChange={(o) => { if (!o) setEditing(null); }}
            onSave={(e) => { const i = editing; if (i !== null) setEdits(prev => prev.map((x, j) => j === i ? e : x)); }} />
          {progress && <p role="status" className="text-sm text-muted-foreground">{progress}</p>}
          <Button className="w-full h-11" onClick={submit} disabled={busy}>
            {busy && <Loader2 className="animate-spin size-4" />} {t("saveInNotebook")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Simplified student "Add Summary" dialog ---------- */
function SummaryDialog({ open, onOpenChange, userId, defaultSubject, myLessons, onDone }: {
  open: boolean; onOpenChange: (o: boolean) => void; userId: string;
  defaultSubject: string; myLessons: Lesson[]; onDone: () => void;
}) {
  const { t, lang } = useI18n();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [description, setDescription] = useState("");
  const [links, setLinks] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [edits, setEdits] = useState<ImageEdits[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [progress, setProgress] = useState("");
  const generate = useServerFn(generateFormattedPage);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) setSubject(defaultSubject); }, [open, defaultSubject]);
  const notebook = myLessons.filter((l) => l.subject === subject);

  function resetForm() {
    setTitle(""); setDescription(""); setLinks(""); setFiles([]); setEdits([]); setProgress("");
  }

  async function submit() {
    if (busy) return;
    if (!title.trim()) { toast.error(t("titleRequired")); return; }
    if (!files.length) { toast.error(t("photosRequired")); return; }
    let resourceLinks: string[];
    try { resourceLinks = parseResourceLinks(links); }
    catch { toast.error(t("linksInvalid")); return; }
    setBusy(true);
    try {
      const rootId = crypto.randomUUID();
      const order = notebook.reduce((m, l) => Math.max(m, l.order_index), -1) + 1;
      // Multiple photos of one summary are always merged into a single card (carousel in the reader).
      const rows = await uploadPhotoRows({
        files, edits, userId, grouped: true, rootId, parentId: null, startPage: 1, order,
        onProgress: setProgress,
        progressLabel: (i, n) => t("uploadingPage", { i, n }),
        buildRow: () => ({
          user_id: userId, title: title.trim(), subject, content_type: "summary",
          semester: null, domain: null, unit: null,
          description: description.trim() || null, resource_links: resourceLinks,
        }),
      });
      onDone();
      toast.success(t("summarySaved"));
      resetForm();
      onOpenChange(false);
      backgroundFormat(rows, generate);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      if (message.startsWith("timeout:")) toast.error(t("uploadTimeout"));
      else if (message) toast.error(t("uploadFailed", { message }));
      else toast.error(t("uploadError"));
    } finally { setBusy(false); setProgress(""); }
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle className="pe-8">{t("addSummary")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label htmlFor="sum-title">{t("summaryTitle")} *</Label>
            <Input id="sum-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("titlePlaceholder")} /></div>
          <div className="space-y-1.5"><Label>{t("subject")}</Label>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{SUBJECTS.map((s) => <SelectItem key={s.id} value={s.id}>{s.labels[lang]}</SelectItem>)}</SelectContent>
            </Select></div>
          <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-5 cursor-pointer hover:bg-secondary text-sm text-muted-foreground">
            <ImagePlus className="size-6" /> {t("addSummaryPhotos")}
            <input type="file" accept="image/*" multiple disabled={busy} className="hidden" onChange={(e) => {
              const added = Array.from(e.target.files ?? []).filter(f => f.type.startsWith("image/"));
              setFiles(previous => [...previous, ...added]);
              setEdits(previous => [...previous, ...added.map(() => DEFAULT_EDITS)]);
              e.target.value = "";
            }} />
          </label>
          <PhotoPicker files={files} setFiles={setFiles} edits={edits} setEdits={setEdits} busy={busy} setEditing={setEditing} />
          <OcrButton files={files} edits={edits} onText={setDescription} />
          <div className="space-y-1.5"><Label htmlFor="sum-details">{t("extraDetails")}</Label><Textarea id="sum-details" rows={5} value={description} onChange={e => setDescription(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="sum-links">{t("externalLinks")}</Label><Textarea id="sum-links" dir="ltr" value={links} onChange={e => setLinks(e.target.value)} placeholder={t("resourceLinksPlaceholder")} /></div>
          <ImageEditor file={editing !== null ? files[editing] ?? null : null} edits={editing !== null ? edits[editing] ?? DEFAULT_EDITS : DEFAULT_EDITS}
            open={editing !== null} onOpenChange={(o) => { if (!o) setEditing(null); }}
            onSave={(e) => { const i = editing; if (i !== null) setEdits(prev => prev.map((x, j) => j === i ? e : x)); }} />
          {progress && <p role="status" className="text-sm text-muted-foreground">{progress}</p>}
          <Button className="w-full h-11" onClick={submit} disabled={busy}>
            {busy && <Loader2 className="animate-spin size-4" />} {t("saveSummary")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
