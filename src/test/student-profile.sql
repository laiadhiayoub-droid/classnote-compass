\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE admin_id uuid; admin_email text; rejected boolean := false;
BEGIN
 SELECT r.user_id INTO admin_id FROM public.user_roles r WHERE r.role='admin' LIMIT 1;
 admin_email := 'profile-regression@example.invalid';
 IF admin_id IS NULL THEN RAISE EXCEPTION 'existing admin required'; END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'email',admin_email,'role','authenticated')::text,true);
 PERFORM public.admin_save_student_profile(admin_id,'Profile regression','2000-01-02','2AS languages','https://instagram.com/student',ARRAY['admin','student']::public.app_role[]);
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=admin_id AND birth_date='2000-01-02' AND class_stream='2AS languages' AND bio_link='https://instagram.com/student') THEN RAISE EXCEPTION 'admin profile write failed'; END IF;
 PERFORM public.admin_save_student_profile(admin_id,'Profile regression','2000-01-02','2AS languages',NULL,ARRAY['admin','student','hidden']::public.app_role[]);
 IF EXISTS(SELECT 1 FROM public.student_directory_profiles() WHERE id=admin_id) THEN RAISE EXCEPTION 'hidden user leaked'; END IF;
 BEGIN
  PERFORM public.admin_save_student_profile(admin_id,'Profile regression',CURRENT_DATE+1,'2AS languages',NULL,ARRAY['admin']::public.app_role[]);
 EXCEPTION WHEN OTHERS THEN rejected := true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'future birth date accepted'; END IF;
 rejected := false;
 BEGIN
  PERFORM public.admin_save_student_profile(admin_id,'Profile regression',NULL,NULL,'javascript:alert(1)',ARRAY['admin']::public.app_role[]);
 EXCEPTION WHEN OTHERS THEN rejected := true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'unsafe social link accepted'; END IF;
 PERFORM set_config('request.jwt.claims','{}',true);
 rejected := false;
 BEGIN
  PERFORM public.admin_save_student_profile(admin_id,'Escalation',NULL,NULL,NULL,ARRAY['admin']::public.app_role[]);
 EXCEPTION WHEN OTHERS THEN rejected := true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'unauthenticated admin write allowed'; END IF;
 IF EXISTS(SELECT 1 FROM public.student_directory_profiles()) THEN RAISE EXCEPTION 'signed-out directory access'; END IF;
 RAISE NOTICE 'Profile writes, hidden exclusion, future-date rejection, URL validation, admin authentication and signed-out directory checks passed';
END $$;
ROLLBACK;