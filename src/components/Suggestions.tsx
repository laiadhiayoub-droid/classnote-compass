import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Lightbulb, Loader2, Trash2, Search } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";

export function SuggestionButton() {
  const { t } = useI18n();
  return <Button variant="ghost" size="sm" className="h-10 shrink-0 gap-1.5 px-2" asChild>
    <Link to="/suggestions"><Lightbulb className="size-4" />{t("tabSuggestions")}</Link>
  </Button>;
}

type StudentRow = { id: string; email: string; full_name: string | null; roles: string[]; banned: boolean; lessons_count: number };

export function SuggestionsPanel() {
  const { lang, t } = useI18n();
  const qc = useQueryClient();
  const [showStudents, setShowStudents] = useState(false);
  const [q, setQ] = useState("");
  const suggestions = useQuery({ queryKey: ["admin-suggestions"], queryFn: async () => {
    const { data, error } = await supabase.from("suggestions").select("id,message,created_at,user_id,profiles(full_name)").order("created_at", { ascending: false });
    if (error) throw error; return data;
  }});
  const students = useQuery({ queryKey: ["admin-users"], enabled: showStudents, queryFn: async () => {
    const { data, error } = await supabase.rpc("admin_list_users_full");
    if (error) throw error; return data as unknown as StudentRow[];
  }});
  async function remove(id: string) {
    const { error } = await supabase.from("suggestions").delete().eq("id", id);
    if (error) { toast.error(t("deleteFailed")); return; }
    qc.invalidateQueries({ queryKey: ["admin-suggestions"] });
  }
  const filteredStudents = (students.data ?? []).filter((u) => {
    const term = q.trim().toLowerCase();
    return !term || u.email?.toLowerCase().includes(term) || u.full_name?.toLowerCase().includes(term);
  });
  return <section className="space-y-4 pt-3">
    <label className="flex items-center gap-3 text-sm"><Switch checked={showStudents} onCheckedChange={setShowStudents} />{t("showAllStudents")}</label>
    {showStudents && <>
      <div className="relative max-w-sm">
        <Search className="size-4 absolute top-1/2 -translate-y-1/2 start-3 text-muted-foreground" />
        <Input className="ps-9 bg-card" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchByNameEmail")} />
      </div>
      <ul className="divide-y border-y">
        {filteredStudents.map(u => <li key={u.id} className="py-3 flex flex-wrap items-center gap-2">
          <span className="font-medium">{u.full_name || t("noName")}</span>
          <span className="text-muted-foreground text-sm" dir="ltr">{u.email}</span>
          <span className="flex flex-wrap gap-1">
            {u.roles.includes("admin") && <Badge variant="secondary" className="text-[10px]">{t("adminBadge")}</Badge>}
            {u.roles.includes("writer") && <Badge variant="secondary" className="text-[10px]">{t("approvedWriter")}</Badge>}
            {u.roles.includes("subscriber") && <Badge variant="secondary" className="text-[10px]">{t("subscriber")}</Badge>}
            {u.roles.includes("hidden") && <Badge variant="outline" className="text-[10px]">{t("hiddenTag")}</Badge>}
            {u.banned && <Badge variant="destructive" className="text-[10px]">{t("bannedBadge")}</Badge>}
          </span>
          <span className="text-xs text-muted-foreground ms-auto">{t("pagesPublished", { n: u.lessons_count })}</span>
        </li>)}
        {students.isSuccess && filteredStudents.length === 0 && <li className="py-6 text-center text-muted-foreground">{t("noUsers")}</li>}
      </ul>
    </>}
    {suggestions.isLoading && <Loader2 className="animate-spin size-5" />}
    {suggestions.isError && <p role="alert">{t("suggestionsFailedLoad")}</p>}
    {suggestions.data?.length === 0 && <p className="py-8 text-center text-muted-foreground">{t("noSuggestions")}</p>}
    <ul className="space-y-3">{suggestions.data?.map(s => <li key={s.id} className="border rounded-lg bg-card p-4 flex gap-3">
      <div className="min-w-0 flex-1"><p className="font-bold">{s.profiles?.full_name || t("student")}</p><time className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString(lang)}</time><p className="whitespace-pre-wrap break-words mt-2">{s.message}</p></div>
      <Button variant="ghost" size="icon" aria-label={t("delete")} onClick={() => remove(s.id)}><Trash2 className="size-4" /></Button>
    </li>)}</ul>
  </section>;
}
