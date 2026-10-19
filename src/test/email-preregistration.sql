\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE admin_id uuid; test_id uuid := gen_random_uuid(); unverified_id uuid := gen_random_uuid(); impostor_id uuid := gen_random_uuid(); ordinary_id uuid := gen_random_uuid(); rejected boolean := false;
BEGIN
 SELECT user_id INTO admin_id FROM public.user_roles WHERE role='admin' LIMIT 1;
 IF admin_id IS NULL THEN RAISE EXCEPTION 'test needs an existing admin'; END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'email','prereg-admin-test@example.invalid','role','authenticated')::text,true);
 PERFORM public.admin_save_preregistration('  TOUR-TEST@EXAMPLE.INVALID  ','Preset Student',ARRAY['subscriber','hidden','admin']::public.app_role[]);
 IF NOT EXISTS(SELECT 1 FROM public.email_preregistrations WHERE email='tour-test@example.invalid' AND full_name='Preset Student') THEN RAISE EXCEPTION 'email normalization/name failed'; END IF;
 INSERT INTO auth.users(id,email,email_confirmed_at,raw_app_meta_data) VALUES(test_id,'tour-test@example.invalid',now(),'{"provider":"google"}');
 IF (SELECT full_name FROM public.profiles WHERE id=test_id) IS DISTINCT FROM 'Preset Student' THEN RAISE EXCEPTION 'Google preset name failed'; END IF;
 IF NOT public.has_role(test_id,'subscriber') OR NOT public.has_role(test_id,'hidden') OR NOT public.has_role(test_id,'admin') THEN RAISE EXCEPTION 'Google preset roles failed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.email_preregistrations WHERE email='tour-test@example.invalid' AND claimed_by=test_id AND claimed_at IS NOT NULL) THEN RAISE EXCEPTION 'claim not recorded'; END IF;
 UPDATE public.profiles SET full_name='Later edit' WHERE id=test_id;
 UPDATE auth.users SET last_sign_in_at=now() WHERE id=test_id;
 IF (SELECT full_name FROM public.profiles WHERE id=test_id) IS DISTINCT FROM 'Later edit' THEN RAISE EXCEPTION 'claim replay changed name'; END IF;
 PERFORM public.admin_save_preregistration('unverified-test@example.invalid','Verified Only',ARRAY['subscriber']::public.app_role[]);
 INSERT INTO auth.users(id,email,raw_app_meta_data) VALUES(unverified_id,'unverified-test@example.invalid','{"provider":"google"}');
 IF public.has_role(unverified_id,'subscriber') THEN RAISE EXCEPTION 'unverified user granted'; END IF;
 UPDATE auth.users SET email_confirmed_at=now() WHERE id=unverified_id;
 IF NOT public.has_role(unverified_id,'subscriber') THEN RAISE EXCEPTION 'verification update did not bind'; END IF;
 PERFORM public.admin_save_preregistration('impostor-test@example.invalid','Trusted Only',ARRAY['admin']::public.app_role[]);
 INSERT INTO auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) VALUES(impostor_id,'impostor-test@example.invalid',now(),'{"provider":"email"}','{"provider":"google","role":"admin"}');
 IF public.has_role(impostor_id,'admin') THEN RAISE EXCEPTION 'editable metadata escalation'; END IF;
 INSERT INTO auth.users(id,email,email_confirmed_at,raw_app_meta_data) VALUES(ordinary_id,'ordinary-test@example.invalid',now(),'{"provider":"google"}');
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',ordinary_id,'email','ordinary-test@example.invalid','role','authenticated')::text,true);
 BEGIN
   PERFORM public.admin_save_preregistration('forbidden-test@example.invalid','Forbidden',ARRAY['admin']::public.app_role[]);
 EXCEPTION WHEN OTHERS THEN rejected := true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'non-admin assignment permitted'; END IF;
 IF EXISTS(SELECT 1 FROM public.email_preregistrations WHERE email='forbidden-test@example.invalid') THEN RAISE EXCEPTION 'non-admin created registration'; END IF;
 RAISE NOTICE 'Verified Google binding, role assignment, one-time consumption, verification gating, forgery blocking and admin-only assignment passed';
END $$;
ROLLBACK;