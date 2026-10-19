import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowRight, Loader2, Search, ShieldAlert, ShieldCheck, Pencil, Ban, Undo2, Trash2, Users, BookOpen, Eye, Megaphone,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SuggestionsPanel } from "@/components/Suggestions";
import { ThemeToggle, LanguageMenu } from "@/components/HeaderControls";
import { SUBJECTS, CONTENT_TYPES, subjectLabelL, contentTypeLabelL } from "@/lib/library";
import { useI18n } from "@/lib/i18n";
import { PreregistrationPanel } from "@/components/PreregistrationPanel";
import { BoundNotebookReader } from "@/components/BoundNotebookReader";
import { groupPages } from "@/lib/publishing";
import { orderedBookPages } from "@/lib/notebook";
import { ProfileSettingsButton, StudentProfileDialog } from "@/components/StudentProfile";
import type { StudentProfile } from "@/lib/student-profile";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "لوحة التحكم — المكتبة الرقمية المدرسية" },
      { name: "description", content: "إدارة التلاميذ والدروس والإعلانات في المكتبة الرقمية." },
      { property: "og:title", content: "لوحة التحكم" },
      { property: "og:description", content: "إدارة المنصة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type U = { id: string; email: string; full_name: string | null; roles: string[]; banned: boolean; lessons_count: number };

function AdminPage() {
  const { t } = useI18n();
  const isAdmin = useQuery({
    queryKey: ["am-admin"],
    retry: false,
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { data } = await supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
      return data === true;
    },
  });

  if (isAdmin.isLoading) return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin text-primary" /></div>;
  if (!isAdmin.data) {
    return (
      <div className="min-h-screen grid place-items-center px-4">
        <div className="notebook-paper rounded-xl p-10 text-center space-y-3">
          <ShieldAlert className="mx-auto size-10 text-destructive" />
          <h1 className="text-xl font-extrabold">{t("adminOnly")}</h1>
          <p className="text-muted-foreground">{t("adminOnlyDesc")}</p>
          <Button asChild><Link to="/">{t("backToLibrary")}</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold"><ShieldCheck className="text-school" /> {t("adminDashboard")}</h1>
        <div className="flex items-center"><ProfileSettingsButton /><ThemeToggle /><LanguageMenu /></div>
        <Button variant="ghost" asChild><Link to="/"><ArrowRight className="size-4" /> {t("libraryLink")}</Link></Button>
      </div>
      <Stats />
      <Tabs defaultValue="users">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="users">{t("tabUsers")}</TabsTrigger>
          <TabsTrigger value="banned">{t("tabBanned")}</TabsTrigger>
          <TabsTrigger value="lessons">{t("tabLessons")}</TabsTrigger>
          <TabsTrigger value="suggestions">{t("tabSuggestions")}</TabsTrigger>
          <TabsTrigger value="announce">{t("tabAnnounce")}</TabsTrigger>
        </TabsList>
        <TabsContent value="users"><UsersPanel /></TabsContent>
        <TabsContent value="banned"><BannedPanel /></TabsContent>
        <TabsContent value="lessons"><LessonsPanel /></TabsContent>
        <TabsContent value="suggestions"><SuggestionsPanel /></TabsContent>
        <TabsContent value="announce"><AnnouncePanel /></TabsContent>
      </Tabs>
    </div>
  );
}

function Stats() {
  const { t, lang } = useI18n();
  const s = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_stats");
      if (error) throw error;
      return data[0];
    },
  });
  const top = (s.data?.top_subjects as { subject: string; views: number }[] | undefined) ?? [];
  return (
    <section className="grid gap-3 sm:grid-cols-3">
      <Card icon={<Users className="size-5" />} label={t("statStudents")} value={s.data?.students} />
      <Card icon={<BookOpen className="size-5" />} label={t("statLessons")} value={s.data?.lessons} />
      <div className="rounded-xl border bg-card p-4 space-y-2">
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Eye className="size-5" /> {t("statTopSubjects")}</p>
        {top.length === 0 ? <p className="text-sm text-muted-foreground">{t("noReads")}</p> : (
          <ol className="space-y-1 text-sm">
            {top.slice(0, 3).map((x, i) => (
              <li key={x.subject} className="flex justify-between"><span>{i + 1}. {subjectLabelL(x.subject, lang)}</span><span className="text-muted-foreground">{x.views}</span></li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
function Card({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | undefined }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">{icon} {label}</p>
      <p className="mt-2 text-3xl font-extrabold">{value ?? "…"}</p>
    </div>
  );
}

function useUsers() {
  return useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_users_full");
      if (error) throw error;
      return data as unknown as U[];
    },
  });
}

function UsersPanel() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const users = useUsers();
  const profileDetails = useQuery({ queryKey: ["admin-student-profiles"], queryFn: async () => {
    const { data, error } = await supabase.rpc("admin_student_profiles");
    if (error) throw error; return data;
  }});
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [edit, setEdit] = useState<U | null>(null);
  const [banEmail, setBanEmail] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (users.data ?? []).filter((u) => {
      if (filter === "banned" ? !u.banned : filter !== "all" && !u.roles.includes(filter)) return false;
      return !term || u.email?.toLowerCase().includes(term) || u.full_name?.toLowerCase().includes(term);
    });
  }, [users.data, q, filter]);

  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); qc.invalidateQueries({ queryKey: ["admin-stats"] }); qc.invalidateQueries({ queryKey: ["admin-banned"] }); };

  async function setWriter(id: string, writer: boolean) {
    setBusy(id);
    const { error } = await supabase.rpc("admin_set_writer", { _user_id: id, _is_writer: writer });
    setBusy(null);
    if (error) { toast.error(t("roleChangeFailed")); return; }
    toast.success(writer ? t("becameWriter") : t("becameStudent"));
    refresh();
  }
  async function setSubscriber(id: string, subscriber: boolean) {
    setBusy(id);
    const { error } = await supabase.rpc("admin_set_subscriber", { _user_id: id, _is_subscriber: subscriber });
    setBusy(null);
    if (error) { toast.error(t("subChangeFailed")); return; }
    toast.success(subscriber ? t("subEnabled") : t("subDisabled"));
    qc.invalidateQueries({queryKey:["my-roles"]});
    qc.removeQueries({queryKey:["formatted-page"]});
    refresh();
  }
  async function setHidden(id: string, hidden: boolean) {
    setBusy(id);
    const { error } = await supabase.rpc("admin_set_hidden", { _user_id: id, _hidden: hidden });
    setBusy(null);
    if (error) { toast.error(t("roleChangeFailed")); return; }
    toast.success(t("hiddenChanged"));
    qc.invalidateQueries({ queryKey: ["profiles"] }); qc.invalidateQueries({ queryKey: ["visible-authors"] });
    qc.invalidateQueries({ queryKey: ["my-roles"] }); qc.invalidateQueries({ queryKey: ["lessons"] }); refresh();
  }
  async function ban(email: string) {
    if (!email.trim()) return;
    if (!confirm(t("banConfirm", { email }))) return;
    const { error } = await supabase.rpc("admin_ban", { _email: email });
    if (error) { toast.error(error.message.includes("admin") ? t("banAdminBlocked") : t("banFailed")); return; }
    toast.success(t("bannedBadge"));
    setBanEmail("");
    refresh();
  }
  async function unban(email: string) {
    const { error } = await supabase.from("banned_users").delete().eq("email", email.toLowerCase());
    if (error) { toast.error(t("unbanFailed")); return; }
    toast.success(t("unbanBtn"));
    refresh();
  }

  return (
    <div className="space-y-4 pt-3">
      <PreregistrationPanel />
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="size-4 absolute top-1/2 -translate-y-1/2 start-3 text-muted-foreground" />
          <Input className="ps-9 bg-card" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchByNameEmail")} />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-44 bg-card"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filterAll")}</SelectItem>
            <SelectItem value="student">{t("filterStudents")}</SelectItem>
            <SelectItem value="writer">{t("filterWriters")}</SelectItem>
            <SelectItem value="subscriber">{t("filterSubscribers")}</SelectItem>
            <SelectItem value="admin">{t("filterAdmins")}</SelectItem>
            <SelectItem value="hidden">{t("hiddenTag")}</SelectItem>
            <SelectItem value="banned">{t("filterBanned")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <form className="flex flex-col sm:flex-row gap-2" onSubmit={(e) => { e.preventDefault(); ban(banEmail); }}>
        <Input dir="ltr" type="email" className="bg-card" value={banEmail} onChange={(e) => setBanEmail(e.target.value)} placeholder="email@example.com" />
        <Button type="submit" variant="destructive"><Ban className="size-4" /> {t("banByEmail")}</Button>
      </form>
      {users.isLoading ? <Loader2 className="mx-auto animate-spin text-primary" /> : (
        <ul className="space-y-2">
          {filtered.map((u) => {
            const admin = u.roles.includes("admin");
            const writer = u.roles.includes("writer");
            return (
              <li key={u.id} className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
                <div className="flex-1 min-w-0 basis-full sm:basis-auto">
                  <p className="font-bold truncate flex items-center gap-2">
                    {u.full_name || t("noName")}
                    {u.banned && <Badge variant="destructive">{t("bannedBadge")}</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground truncate" dir="ltr">{u.email}</p>
                  <p className="text-xs text-muted-foreground">{t("pagesPublished", { n: u.lessons_count })}</p>
                </div>
                <Button size="icon" variant="ghost" aria-label={t("editStudentProfile")} title={t("editStudentProfile")} disabled={!profileDetails.isSuccess} onClick={() => setEdit(u)}><Pencil className="size-4" /></Button>
                {admin ? <Badge>{t("adminBadge")}</Badge> : (
                  <>
                    <div className="flex flex-wrap items-center gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <Switch aria-label={`${t("approvedWriter")} — ${u.full_name || u.email}`} checked={writer} disabled={busy === u.id}
                          onCheckedChange={v => setWriter(u.id, v)} />
                        {t("approvedWriter")}
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <Switch aria-label={`${t("subscriber")} — ${u.full_name || u.email}`} checked={u.roles.includes("subscriber")} disabled={busy === u.id}
                          onCheckedChange={v => setSubscriber(u.id, v)} />
                        {t("subscriber")}
                      </label>
                      <label className="flex items-center gap-2 text-sm"><Switch aria-label={t("hiddenTag")} checked={u.roles.includes("hidden")} disabled={busy === u.id} onCheckedChange={v => setHidden(u.id, v)} />{t("hiddenTag")}</label>
                    </div>
                    {u.banned
                      ? <Button size="sm" variant="outline" onClick={() => unban(u.email)}><Undo2 className="size-4" /> {t("unbanBtn")}</Button>
                      : <Button size="sm" variant="outline" className="text-destructive" onClick={() => ban(u.email)}><Ban className="size-4" /> {t("banBtn")}</Button>}
                  </>
                )}
              </li>
            );
          })}
          {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">{t("noUsers")}</p>}
        </ul>
      )}
      {profileDetails.isError && <p role="alert" className="text-destructive">{t("directoryFailedLoad")}</p>}
      {edit && <StudentProfileDialog userId={edit.id} profile={{ id: edit.id, full_name: edit.full_name, birth_date: null, class_stream: null, bio_link: null, ...profileDetails.data?.find(p => p.id === edit.id) } satisfies StudentProfile} adminRoles={edit.roles as Database["public"]["Enums"]["app_role"][]} onClose={() => { setEdit(null); refresh(); }} />}
    </div>
  );
}

function EditNameDialog({ user, onClose, onDone }: { user: U; onClose: () => void; onDone: () => void }) {
  const { t } = useI18n();
  const [name, setName] = useState(user.full_name ?? "");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.rpc("admin_set_name", { _user_id: user.id, _name: name });
    if (error) { toast.error(t("nameSaveFail")); return; }
    toast.success(t("nameSaved"));
    onDone(); onClose();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("editNameTitle")}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" className="w-full">{t("save")}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BannedPanel() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["admin-banned"],
    queryFn: async () => {
      const { data, error } = await supabase.from("banned_users").select("*").order("banned_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  async function unban(email: string) {
    const { error } = await supabase.from("banned_users").delete().eq("email", email);
    if (error) { toast.error(t("unbanFailed")); return; }
    toast.success(t("unbanBtn"));
    ["admin-banned", "admin-users", "admin-stats"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  }
  return (
    <ul className="space-y-2 pt-3">
      {(list.data ?? []).map((b) => (
        <li key={b.email} className="flex items-center gap-3 rounded-lg border bg-card p-3">
          <div className="flex-1 min-w-0">
            <p className="font-bold truncate" dir="ltr">{b.email}</p>
            <p className="text-xs text-muted-foreground">{t("bannedSince", { date: new Date(b.banned_at).toLocaleDateString(lang) })}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => unban(b.email)}><Undo2 className="size-4" /> {t("unbanBtn")}</Button>
        </li>
      ))}
      {list.data?.length === 0 && <p className="text-center text-muted-foreground py-8">{t("noBanned")}</p>}
    </ul>
  );
}

type L = { id: string; title: string; subject: string; content_type: string; domain: string | null; unit: string | null; image_path: string; user_id: string; created_at: string; parent_lesson_id: string | null; grouped_pages: boolean; page_number: number; order_index: number; description: string | null; resource_links: string[] };

function LessonsPanel() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [subject, setSubject] = useState("all");
  const [edit, setEdit] = useState<L | null>(null);
  const [preview, setPreview] = useState<L | null>(null);
  const data = useQuery({
    queryKey: ["admin-lessons"],
    queryFn: async () => {
      const [l, p] = await Promise.all([
        supabase.from("lessons").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, full_name"),
      ]);
      if (l.error) throw l.error;
      return { lessons: l.data as L[], names: new Map((p.data ?? []).map((x) => [x.id, x.full_name])) };
    },
  });
  const filtered = (data.data?.lessons ?? []).filter((l) =>
    (subject === "all" || l.subject === subject) && (!q.trim() || l.title.toLowerCase().includes(q.trim().toLowerCase())));
  const refresh = () => ["admin-lessons", "lessons", "admin-stats"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

  async function del(l: L) {
    if (!confirm(t("deleteLessonConfirm", { title: l.title }))) return;
    const { error } = await supabase.from("lessons").delete().eq("id", l.id);
    if (error) { toast.error(t("lessonDeleteFailed")); return; }
    await supabase.storage.from("lessons-images").remove([l.image_path]);
    toast.success(t("lessonDeleted"));
    refresh();
  }

  return (
    <div className="space-y-4 pt-3">
      <div className="flex flex-wrap gap-2">
        <Input className="flex-1 min-w-[200px] bg-card" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchLessonTitle")} />
        <Select value={subject} onValueChange={setSubject}>
          <SelectTrigger className="w-48 bg-card"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allSubjects")}</SelectItem>
            {SUBJECTS.map((s) => <SelectItem key={s.id} value={s.id}>{s.labels[lang]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <ul className="space-y-2">
        {filtered.map((l) => (
          <li key={l.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
            <div className="flex-1 min-w-0">
              <p className="font-bold truncate">{l.title}</p>
              <p className="text-xs text-muted-foreground">{subjectLabelL(l.subject, lang)} · {contentTypeLabelL(l.content_type, lang)} · {data.data?.names.get(l.user_id) || t("student")}</p>
            </div>
            <Button size="icon" variant="ghost" className="size-10 shrink-0" aria-label={t("previewLesson")} title={t("previewLesson")} onClick={() => setPreview(l)}><Eye className="size-4" /></Button>
            <Button size="icon" variant="ghost" className="size-10 shrink-0" aria-label={t("editText")} onClick={() => setEdit(l)}><Pencil className="size-4" /></Button>
            <Button size="icon" variant="ghost" className="size-10 shrink-0 text-destructive" aria-label={t("delete")} onClick={() => del(l)}><Trash2 className="size-4" /></Button>
          </li>
        ))}
        {data.isSuccess && filtered.length === 0 && <p className="text-center text-muted-foreground py-8">{t("noLessonsAdmin")}</p>}
      </ul>
      {edit && <EditLessonDialog lesson={edit} onClose={() => setEdit(null)} onDone={refresh} />}
      {preview && <BoundNotebookReader pages={orderedBookPages(groupPages((data.data?.lessons ?? []).filter(l => l.user_id === preview.user_id && l.subject === preview.subject && l.content_type === preview.content_type), preview))} initialId={preview.id} roles={["admin"]} onClose={() => setPreview(null)} />}
    </div>
  );
}

function EditLessonDialog({ lesson, onClose, onDone }: { lesson: L; onClose: () => void; onDone: () => void }) {
  const { t, lang } = useI18n();
  const [f, setF] = useState({ title: lesson.title, subject: lesson.subject, content_type: lesson.content_type, domain: lesson.domain ?? "", unit: lesson.unit ?? "" });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.title.trim()) return;
    const { error } = await supabase.from("lessons").update({
      title: f.title.trim(), subject: f.subject, content_type: f.content_type, domain: f.domain.trim() || null, unit: f.unit.trim() || null,
    }).eq("id", lesson.id);
    if (error) { toast.error(t("saveFailed")); return; }
    toast.success(t("lessonSaved"));
    onDone(); onClose();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("editLessonTitle")}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <Label>{t("titleField")}</Label>
          <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Select value={f.subject} onValueChange={(v) => setF({ ...f, subject: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{SUBJECTS.map((s) => <SelectItem key={s.id} value={s.id}>{s.labels[lang]}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={f.content_type} onValueChange={(v) => setF({ ...f, content_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CONTENT_TYPES.map((c) => <SelectItem key={c.id} value={c.id}>{c.labels[lang]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Input value={f.domain} onChange={(e) => setF({ ...f, domain: e.target.value })} placeholder={t("domainField")} />
          <Input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} placeholder={t("unitField")} />
          <Button type="submit" className="w-full">{t("save")}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AnnouncePanel() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const a = useQuery({
    queryKey: ["announcement-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_announcement").select("message, active").eq("id", 1).single();
      if (error) throw error;
      return data;
    },
  });
  const [msg, setMsg] = useState("");
  const [active, setActive] = useState(false);
  useEffect(() => { if (a.data) { setMsg(a.data.message); setActive(a.data.active); } }, [a.data]);
  async function save(nextActive = active) {
    const { error } = await supabase.from("site_announcement").update({ message: msg, active: nextActive, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) { toast.error(t("saveFailed")); return; }
    toast.success(nextActive ? t("announcementShownToast") : t("announcementHiddenToast"));
    qc.invalidateQueries({ queryKey: ["announcement"] });
    qc.invalidateQueries({ queryKey: ["announcement-admin"] });
  }
  return (
    <div className="space-y-4 pt-3 rounded-xl border bg-card p-4">
      <Label className="flex items-center gap-2"><Megaphone className="size-4" /> {t("announcementText")}</Label>
      <Textarea rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={t("announcementPlaceholder")} />
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={active} onCheckedChange={(v) => { if (v && !msg.trim()) { toast.error(t("announcementFirst")); return; } setActive(v); save(v); }} />
          {active ? t("announcementVisible") : t("announcementHidden")}
        </label>
        <Button onClick={() => save()}>{t("saveText")}</Button>
      </div>
    </div>
  );
}
