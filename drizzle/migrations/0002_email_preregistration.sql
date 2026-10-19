CREATE TABLE public.email_preregistrations (
 email text PRIMARY KEY,
 full_name text NOT NULL,
 roles public.app_role[] NOT NULL DEFAULT '{student}',
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 claimed_by uuid,
 claimed_at timestamptz,
 CONSTRAINT normalized_email CHECK (email = lower(trim(email)))
);
GRANT SELECT ON public.email_preregistrations TO authenticated;
GRANT ALL ON public.email_preregistrations TO service_role;
ALTER TABLE public.email_preregistrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active admins read preregistrations" ON public.email_preregistrations FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') AND NOT public.current_user_banned());
CREATE OR REPLACE FUNCTION public.admin_save_preregistration(_email text, _name text, _roles public.app_role[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE normalized text := lower(trim(_email));
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') OR public.current_user_banned() THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF normalized !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR length(trim(_name)) < 2 OR length(_name) > 200 OR coalesce(cardinality(_roles),0) = 0 OR array_position(_roles,NULL) IS NOT NULL THEN RAISE EXCEPTION 'invalid preregistration'; END IF;
 IF EXISTS(SELECT 1 FROM auth.users WHERE lower(email) = normalized) THEN RAISE EXCEPTION 'account already registered'; END IF;
 INSERT INTO public.email_preregistrations(email, full_name, roles, created_by) VALUES(normalized,trim(_name),_roles,auth.uid())
 ON CONFLICT(email) DO UPDATE SET full_name=excluded.full_name, roles=excluded.roles, created_by=excluded.created_by WHERE email_preregistrations.claimed_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'already claimed'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.admin_remove_preregistration(_email text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') OR public.current_user_banned() THEN RAISE EXCEPTION 'forbidden'; END IF;
 DELETE FROM public.email_preregistrations WHERE email=lower(trim(_email)) AND claimed_at IS NULL;
END $$;
REVOKE ALL ON FUNCTION public.admin_save_preregistration(text,text,public.app_role[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_remove_preregistration(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_preregistration(text,text,public.app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_remove_preregistration(text) TO authenticated;
CREATE OR REPLACE FUNCTION public.claim_google_preregistration() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pending public.email_preregistrations%ROWTYPE;
BEGIN
 IF NEW.email_confirmed_at IS NULL OR NEW.email IS NULL THEN RETURN NEW; END IF;
 IF NOT (coalesce(NEW.raw_app_meta_data->>'provider','') = 'google' OR EXISTS(SELECT 1 FROM auth.identities WHERE user_id=NEW.id AND provider='google')) THEN RETURN NEW; END IF;
 IF EXISTS(SELECT 1 FROM public.banned_users WHERE email=lower(trim(NEW.email))) THEN RETURN NEW; END IF;
 SELECT * INTO pending FROM public.email_preregistrations WHERE email=lower(trim(NEW.email)) AND claimed_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RETURN NEW; END IF;
 INSERT INTO public.profiles(id,full_name) VALUES(NEW.id,pending.full_name) ON CONFLICT(id) DO UPDATE SET full_name=excluded.full_name;
 INSERT INTO public.user_roles(user_id,role) SELECT NEW.id, unnest(pending.roles) ON CONFLICT(user_id,role) DO NOTHING;
 UPDATE public.email_preregistrations SET claimed_by=NEW.id,claimed_at=now() WHERE email=pending.email;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.claim_google_preregistration() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER on_google_preregistration AFTER INSERT OR UPDATE OF email_confirmed_at,last_sign_in_at ON auth.users FOR EACH ROW EXECUTE FUNCTION public.claim_google_preregistration();