import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { canAccessCommunity } from "./community";

export const communityQuery = queryOptions({
  queryKey: ["student-community"],
  staleTime: 0,
  retry: false,
  queryFn: async () => {
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return { userId: undefined, allowed: false, admin: false, students: [], suggestions: [] };
    const { data: banned, error: banError } = await supabase.rpc("current_user_banned");
    if (banError || !canAccessCommunity(auth.user.id, banned)) return { userId: auth.user.id, allowed: false, admin: false, students: [], suggestions: [] };
    const [students, suggestions, roles] = await Promise.all([
      supabase.rpc("student_directory_profiles"),
      supabase.from("suggestions").select("id,user_id,message,created_at,profiles(full_name)").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("role").eq("user_id", auth.user.id),
    ]);
    if (students.error) throw students.error;
    if (suggestions.error) throw suggestions.error;
    if (roles.error) throw roles.error;
    return { userId: auth.user.id, allowed: true, admin: roles.data.some(r => r.role === "admin"), students: students.data, suggestions: suggestions.data };
  },
});