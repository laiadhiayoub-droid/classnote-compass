import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
export const studentProfileQuery = queryOptions({
  queryKey: ["student-profile"], retry: false,
  queryFn: async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return null;
    const [profile, roles, banned] = await Promise.all([
      supabase.from("profiles").select("id,full_name,birth_date,class_stream,bio_link").eq("id", auth.user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", auth.user.id),
      supabase.rpc("current_user_banned"),
    ]);
    if (profile.error || roles.error || banned.error) throw profile.error || roles.error || banned.error;
    if (banned.data !== false) return null;
    return { profile: profile.data, userId: auth.user.id, roles: roles.data.map(r => r.role) };
  },
});