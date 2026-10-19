import { supabase } from "@/integrations/supabase/client";

// Private lesson photos must never be converted to public bucket URLs.
export const IMAGE_URL_SECONDS = 600;
export const IMAGE_URL_STALE_MS = 480_000;
export async function signLessonImage(path: string) {
  const { data, error } = await supabase.storage.from("lessons-images").createSignedUrl(path, IMAGE_URL_SECONDS);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error("image_url_unavailable");
  return data.signedUrl;
}