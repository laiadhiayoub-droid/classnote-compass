CREATE OR REPLACE FUNCTION public.student_directory()
RETURNS TABLE(id uuid, full_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.full_name FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND NOT public.current_user_banned()
    AND NOT public.has_role(p.id, 'hidden')
  ORDER BY p.full_name NULLS LAST, p.id
$$;
REVOKE ALL ON FUNCTION public.student_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.student_directory() TO authenticated;
CREATE POLICY "Students read visible suggestion threads" ON public.suggestions
FOR SELECT TO authenticated USING (
  auth.uid() IS NOT NULL AND NOT public.current_user_banned()
  AND (user_id = auth.uid() OR NOT public.has_role(user_id, 'hidden'))
);
CREATE POLICY "Banned accounts blocked from suggestions" ON public.suggestions
AS RESTRICTIVE FOR ALL TO authenticated
USING (NOT public.current_user_banned())
WITH CHECK (NOT public.current_user_banned());