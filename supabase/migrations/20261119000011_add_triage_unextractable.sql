-- Round 10 (Cacat 4): Distinguish unextractable archives/files from unmatched triage items
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname
    INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'drive_files'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%triage_status%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.drive_files DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.drive_files
  ADD CONSTRAINT drive_files_triage_status_check
  CHECK (triage_status IN ('unmatched', 'suggested', 'assigned', 'not_needed', 'unextractable'));
