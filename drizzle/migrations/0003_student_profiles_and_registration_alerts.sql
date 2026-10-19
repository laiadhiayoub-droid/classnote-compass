ALTER TABLE public.profiles ADD COLUMN birth_date date, ADD COLUMN class_stream text, ADD COLUMN bio_link text;
CREATE FUNCTION public.validate_student_profile() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN
 IF NEW.birth_date IS NOT NULL AND NEW.birth_date > CURRENT_DATE THEN RAISE EXCEPTION 'birth date cannot be in the future'; END IF;
 NEW.class_stream := nullif(trim(NEW.class_stream), ''); NEW.bio_link := nullif(trim(NEW.bio_link), '');
 IF length(NEW.class_stream) > 120 OR length(NEW.bio_link) > 500 THEN RAISE EXCEPTION 'profile field too long'; END IF;
 IF NEW.bio_link IS NOT NULL AND NEW.bio_link !~* '^https?://[^[:space:]/?#]+[^[:space:]]*$' THEN RAISE EXCEPTION 'invalid social link'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER validate_student_profile BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.validate_student_profile();
CREATE FUNCTION public.student_directory_profiles() RETURNS TABLE(id uuid, full_name text, birth_date date, class_stream text, bio_link text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT p.id,p.full_name,p.birth_date,p.class_stream,p.bio_link FROM public.profiles p JOIN auth.users u ON u.id=p.id
 WHERE auth.uid() IS NOT NULL AND NOT public.current_user_banned() AND NOT public.has_role(p.id,'hidden')
 AND NOT EXISTS(SELECT 1 FROM public.banned_users b WHERE lower(b.email)=lower(u.email)) ORDER BY p.full_name NULLS LAST,p.id $$;
REVOKE ALL ON FUNCTION public.student_directory_profiles() FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.student_directory_profiles() TO authenticated;
CREATE OR REPLACE FUNCTION public.student_directory() RETURNS TABLE(id uuid, full_name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT d.id,d.full_name FROM public.student_directory_profiles() d $$;
CREATE FUNCTION public.admin_save_student_profile(_user_id uuid,_name text,_birth_date date,_class_stream text,_bio_link text,_roles public.app_role[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') OR public.current_user_banned() THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF length(trim(_name)) < 2 OR _roles IS NULL OR cardinality(_roles)=0 OR array_position(_roles,NULL) IS NOT NULL THEN RAISE EXCEPTION 'invalid profile'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=_user_id) THEN RAISE EXCEPTION 'unknown user'; END IF;
 IF public.has_role(_user_id,'admin') AND NOT ('admin'=ANY(_roles)) AND NOT EXISTS(SELECT 1 FROM public.user_roles WHERE role='admin' AND user_id<>_user_id) THEN RAISE EXCEPTION 'cannot remove last admin'; END IF;
 UPDATE public.profiles SET full_name=trim(_name),birth_date=_birth_date,class_stream=_class_stream,bio_link=_bio_link WHERE id=_user_id;
 DELETE FROM public.user_roles WHERE user_id=_user_id AND NOT (role=ANY(_roles));
 INSERT INTO public.user_roles(user_id,role) SELECT _user_id,r FROM unnest(_roles) r ON CONFLICT DO NOTHING;
 END $$;
REVOKE ALL ON FUNCTION public.admin_save_student_profile(uuid,text,date,text,text,public.app_role[]) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.admin_save_student_profile(uuid,text,date,text,text,public.app_role[]) TO authenticated;
CREATE TABLE public.registration_notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,created_at timestamptz NOT NULL DEFAULT now(),dismissed_at timestamptz);
GRANT SELECT,UPDATE ON public.registration_notifications TO authenticated; GRANT ALL ON public.registration_notifications TO service_role;
ALTER TABLE public.registration_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active admins read registration alerts" ON public.registration_notifications FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin') AND NOT public.current_user_banned());
CREATE POLICY "Active admins dismiss registration alerts" ON public.registration_notifications FOR UPDATE TO authenticated USING(public.has_role(auth.uid(),'admin') AND NOT public.current_user_banned()) WITH CHECK(public.has_role(auth.uid(),'admin') AND NOT public.current_user_banned());
CREATE FUNCTION public.notify_student_registration() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN INSERT INTO public.registration_notifications(user_id) VALUES(NEW.id); RETURN NEW; END $$;
CREATE TRIGGER notify_student_registration AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.notify_student_registration();
CREATE FUNCTION public.admin_student_profiles() RETURNS TABLE(id uuid,birth_date date,class_stream text,bio_link text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$ BEGIN IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') OR public.current_user_banned() THEN RAISE EXCEPTION 'forbidden'; END IF; RETURN QUERY SELECT p.id,p.birth_date,p.class_stream,p.bio_link FROM public.profiles p; END $$;
REVOKE ALL ON FUNCTION public.admin_student_profiles() FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.admin_student_profiles() TO authenticated;