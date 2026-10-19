import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarIcon, Loader2, UserRound } from "lucide-react";
import { ar, enUS, fr, es } from "date-fns/locale";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n, type StringKey } from "@/lib/i18n";
import { profileComplete, safeBioLink, type StudentProfile } from "@/lib/student-profile";
import { studentProfileQuery } from "@/lib/student-profile-query";

type Role = Database["public"]["Enums"]["app_role"];
const roleLabels: Record<Role, StringKey> = { student: "student", writer: "approvedWriter", subscriber: "subscriber", hidden: "hiddenTag", admin: "adminBadge" };

export function StudentProfileDialog({ profile, userId, required = false, adminRoles, onClose }: { profile: StudentProfile | null; userId: string; required?: boolean; adminRoles?: Role[]; onClose: () => void }) {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const [name, setName] = useState(profile?.full_name ?? "");
  const [birth, setBirth] = useState(profile?.birth_date ?? "");
  const [stream, setStream] = useState(profile?.class_stream ?? "");
  const [link, setLink] = useState(profile?.bio_link ?? "");
  const [roles, setRoles] = useState<Role[]>(adminRoles ?? []);
  const [busy, setBusy] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [error, setError] = useState(false);
  const today = format(new Date(), "yyyy-MM-dd");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (name.trim().length < 2 || (!adminRoles && (!birth || !stream.trim())) || (birth && birth > today) || (link.trim() && !safeBioLink(link)) || (adminRoles && !roles.length)) { setError(true); return; }
    setBusy(true); setError(false);
    try {
      const fields = { full_name: name.trim(), birth_date: birth || null, class_stream: stream.trim() || null, bio_link: safeBioLink(link) };
      const result = adminRoles
        ? await supabase.rpc("admin_save_student_profile", { _user_id: userId, _name: fields.full_name, _birth_date: fields.birth_date as string, _class_stream: fields.class_stream as string, _bio_link: fields.bio_link as string, _roles: roles })
        : await supabase.from("profiles").update(fields).eq("id", userId).select("id").single();
      if (result.error) throw result.error;
      await Promise.all(["student-profile", "profiles", "student-community", "admin-users", "admin-student-profiles", "my-roles", "am-admin", "visible-authors", "lessons", "admin-stats"].map(key => qc.invalidateQueries({ queryKey: [key] })));
      qc.removeQueries({ queryKey: ["formatted-page"] });
      toast.success(t("profileSaved")); onClose();
    } catch { toast.error(t("saveFailed")); } finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !required && !busy) onClose(); }}>
    <DialogContent className={`max-h-[90dvh] overflow-y-auto sm:max-w-lg ${required ? "[&>button.absolute]:hidden" : ""}`} onInteractOutside={e => { if (required || busy) e.preventDefault(); }} onEscapeKeyDown={e => { if (required || busy) e.preventDefault(); }}>
      <DialogHeader><DialogTitle className="pe-8">{t(adminRoles ? "editStudentProfile" : required ? "completeProfile" : "profileSettings")}</DialogTitle><DialogDescription>{t("profileDirectoryNotice")}</DialogDescription></DialogHeader>
      <form onSubmit={save} className="space-y-4">
        <div className="space-y-2"><Label htmlFor="profile-name">{t("fullNameLabel")}</Label><Input id="profile-name" required maxLength={120} value={name} onChange={e => setName(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="profile-birth">{t("birthDate")}</Label><div className="flex gap-2">
          <Input id="profile-birth" type="date" max={today} required={!adminRoles} value={birth} onChange={e => setBirth(e.target.value)} className="min-w-0 flex-1" />
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}><PopoverTrigger asChild><Button variant="outline" size="icon" type="button" aria-label={t("birthDate")}><CalendarIcon className="size-4" /></Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="end"><Calendar className="pointer-events-auto" locale={{ar,en:enUS,fr,es}[lang]} mode="single" captionLayout="dropdown" startMonth={new Date(1900, 0)} endMonth={new Date()} defaultMonth={birth ? parseISO(birth) : new Date(2010, 0)} selected={birth ? parseISO(birth) : undefined} disabled={{ after: new Date() }} onSelect={date => { if (date) setBirth(format(date, "yyyy-MM-dd")); setCalendarOpen(false); }} /></PopoverContent></Popover>
        </div></div>
        <div className="space-y-2"><Label htmlFor="profile-class">{t("classStream")}</Label><Input id="profile-class" required={!adminRoles} maxLength={120} value={stream} onChange={e => setStream(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="profile-link">{t("bioLink")}</Label><Input id="profile-link" type="url" dir="ltr" maxLength={500} value={link} onChange={e => setLink(e.target.value)} /></div>
        {adminRoles && <fieldset className="space-y-3"><legend className="text-sm font-medium mb-2">{t("profileRoles")}</legend><div className="grid grid-cols-2 gap-3">{(Object.keys(roleLabels) as Role[]).map(role => <label key={role} className="flex items-center gap-2 text-sm"><Checkbox checked={roles.includes(role)} onCheckedChange={checked => setRoles(old => checked ? [...old, role] : old.filter(r => r !== role))} />{t(roleLabels[role])}</label>)}</div></fieldset>}
        {error && <p role="alert" className="text-sm text-destructive">{t("invalidProfile")}</p>}
        <Button type="submit" disabled={busy} className="w-full">{busy && <Loader2 className="size-4 animate-spin" />}{t("save")}</Button>
      </form>
    </DialogContent>
  </Dialog>;
}

export function ProfileSettingsButton() {
  const { t } = useI18n();
  const { data } = useQuery(studentProfileQuery);
  const [open, setOpen] = useState(false);
  if (!data) return null;
  return <><Button size="icon" variant="ghost" aria-label={t("profileSettings")} title={t("profileSettings")} onClick={() => setOpen(true)}><UserRound className="size-5" /></Button>{open && <StudentProfileDialog profile={data.profile} userId={data.userId} onClose={() => setOpen(false)} />}</>;
}

export function ProfileCompletion() {
  const { data } = useQuery(studentProfileQuery);
  if (!data || !data.roles.includes("student") || data.roles.includes("admin") || profileComplete(data.profile)) return null;
  return <StudentProfileDialog key={data.userId} required profile={data.profile} userId={data.userId} onClose={() => {}} />;
}