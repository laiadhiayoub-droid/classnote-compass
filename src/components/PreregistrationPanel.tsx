import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MailPlus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useI18n, type StringKey } from "@/lib/i18n";
import type { Database } from "@/integrations/supabase/types";

type Role = Database["public"]["Enums"]["app_role"];
const options: { role: Role; label: StringKey }[] = [
  { role: "student", label: "student" }, { role: "subscriber", label: "subscriber" },
  { role: "writer", label: "approvedWriter" }, { role: "hidden", label: "hiddenTag" }, { role: "admin", label: "adminBadge" },
];
export function PreregistrationPanel() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [roles, setRoles] = useState<Role[]>(["student"]);
  const [busy, setBusy] = useState(false);
  const list = useQuery({ queryKey: ["admin-preregistrations"], queryFn: async () => {
    const { data, error } = await supabase.from("email_preregistrations").select("email,full_name,roles,claimed_at").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  } });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (roles.includes("admin") && !confirm(t("preregAdminConfirm", { email }))) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("admin_save_preregistration", { _email: email, _name: name, _roles: roles });
      if (error) throw error;
      setEmail(""); setName(""); setRoles(["student"]);
      await qc.invalidateQueries({ queryKey: ["admin-preregistrations"] });
      toast.success(t("preregSaved"));
    } catch { toast.error(t("preregFailed")); } finally { setBusy(false); }
  }
  async function remove(value: string) {
    if (!confirm(t("preregRemoveConfirm", { email: value }))) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("admin_remove_preregistration", { _email: value });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["admin-preregistrations"] });
    } catch { toast.error(t("deleteFailed")); } finally { setBusy(false); }
  }
  return <section className="border-y py-5 space-y-4" aria-labelledby="prereg-title">
    <h2 id="prereg-title" className="font-bold flex items-center gap-2"><MailPlus className="size-5 text-primary" />{t("preregTitle")}</h2>
    <form onSubmit={save} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="prereg-email">{t("emailLabel")}</Label><Input id="prereg-email" type="email" required dir="ltr" value={email} onChange={e => setEmail(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="prereg-name">{t("fullNameLabel")}</Label><Input id="prereg-name" required minLength={2} maxLength={200} value={name} onChange={e => setName(e.target.value)} /></div></div>
      <div className="flex flex-wrap gap-x-5 gap-y-3">{options.map(({ role, label }) => <label key={role} className="flex items-center gap-2 text-sm"><Checkbox checked={roles.includes(role)} onCheckedChange={checked => setRoles(values => checked === true ? [...values.filter(v => v !== role), role] : values.filter(v => v !== role))} />{t(label)}</label>)}</div>
      <Button type="submit" disabled={busy || !email.trim() || name.trim().length < 2 || roles.length === 0}>{busy ? <Loader2 className="size-4 animate-spin" /> : <MailPlus className="size-4" />}{t("save")}</Button>
    </form>
    {list.isError && <div role="alert" className="flex items-center gap-3"><p>{t("preregLoadFailed")}</p><Button variant="outline" onClick={() => void list.refetch()}>{t("retry")}</Button></div>}
    <ul className="divide-y">{list.data?.map(row => <li key={row.email} className="py-3 flex items-center gap-2"><div className="min-w-0 flex-1"><p className="font-medium break-words">{row.full_name}</p><p dir="ltr" className="text-sm text-muted-foreground break-all">{row.email}</p><p className="text-xs mt-1">{row.roles.map(role => t(options.find(o => o.role === role)?.label ?? "student")).join(" · ")} — {t(row.claimed_at ? "preregClaimed" : "preregPending")}</p></div>{!row.claimed_at && <><Button variant="ghost" size="icon" disabled={busy} aria-label={t("editNameAria")} onClick={() => { setEmail(row.email); setName(row.full_name); setRoles(row.roles); }}><Pencil className="size-4" /></Button><Button variant="ghost" size="icon" disabled={busy} aria-label={t("delete")} onClick={() => void remove(row.email)}><Trash2 className="size-4" /></Button></>}</li>)}</ul>
  </section>;
}