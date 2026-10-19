import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { studentProfileQuery } from "@/lib/student-profile-query";
import { useI18n } from "@/lib/i18n";
export function RegistrationAlerts() {
  const { t, lang } = useI18n();
  const { data: viewer } = useQuery(studentProfileQuery);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const alerts = useQuery({ queryKey: ["registration-alerts", viewer?.userId], enabled: !!viewer?.roles.includes("admin"), refetchInterval: 15000, queryFn: async () => {
    const { data, error } = await supabase.from("registration_notifications").select("id,user_id,created_at,profiles(full_name)").is("dismissed_at", null).order("created_at", { ascending: false });
    if (error) throw error; return data;
  }});
  async function dismiss(id: string) {
    setBusy(id);
    const { error } = await supabase.from("registration_notifications").update({ dismissed_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(t("saveFailed"));
    else await qc.invalidateQueries({ queryKey: ["registration-alerts"] });
    setBusy(null);
  }
  if (!viewer?.roles.includes("admin") || !alerts.data?.length) return null;
  return <><section role="status" className="border-b bg-accent text-accent-foreground"><div className="mx-auto max-w-5xl px-4 py-3 flex flex-wrap items-center gap-3"><Bell className="size-5 shrink-0" /><p className="font-medium flex-1">{t("newRegistrations", { n: alerts.data.length })}</p><Button size="sm" variant="outline" onClick={() => setOpen(true)}>{t("reviewRegistrations")}</Button></div></section><Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle className="pe-8">{t("reviewRegistrations")}</DialogTitle></DialogHeader><ul className="divide-y">{alerts.data.map(alert => <li key={alert.id} className="py-3 flex flex-wrap gap-3 items-center"><div className="flex-1 min-w-0"><p className="font-semibold break-words">{alert.profiles?.full_name || t("noName")}</p><time dateTime={alert.created_at} className="text-xs text-muted-foreground">{new Date(alert.created_at).toLocaleDateString(lang)}</time></div><Button size="sm" variant="ghost" disabled={!!busy} onClick={() => void dismiss(alert.id)}>{busy === alert.id ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}{t("dismissRegistration")}</Button></li>)}</ul><Button asChild onClick={() => setOpen(false)}><Link to="/admin">{t("tabUsers")}</Link></Button></DialogContent></Dialog></>;
}