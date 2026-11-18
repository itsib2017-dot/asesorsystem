-- Migration 20261118000005: Full Platform Schema (Phases 0-5)
-- Tables: signatures, document_signatures, scheme_form_manifests, prompt_templates, prompt_versions,
--         drive_files, ocr_runs, name_jury_verdicts, decisions, dit_analyses, written_gradings,
--         similarity_pairs, ak05_reports + column additions to batches & assessees + signatures bucket RLS.

-- 1. Extend batches & assessees for intake, triage, and identity check
alter table public.batches
  add column if not exists tuk_name text,
  add column if not exists tuk_type text check (tuk_type in ('sewaktu','tempat_kerja','mandiri')),
  add column if not exists assessment_date date,
  add column if not exists drive_folder_url text,
  add column if not exists kelompok_sheet_url text;

alter table public.assessees
  add column if not exists pseudonym text,
  add column if not exists nik_masked text,
  add column if not exists ktp_name_ocr text,
  add column if not exists apl01_name text,
  add column if not exists surat_tugas_name text,
  add column if not exists ijazah_name text,
  add column if not exists certificate_name_confirmed text,
  add column if not exists certificate_name_confirmed_by uuid references public.assessors(id),
  add column if not exists certificate_name_confirmed_at timestamptz,
  add column if not exists completeness_status text not null default 'pending' check (completeness_status in ('pending','incomplete','complete'));

alter table public.assessors
  add column if not exists reg_no_met text;

-- 2. Assessor Signatures (P0-8 / D11)
create table if not exists public.signatures (
  id uuid primary key default gen_random_uuid(),
  assessor_id uuid not null references public.assessors(id) on delete cascade,
  storage_path text not null,
  sha256 text not null,
  mime_type text not null check (mime_type in ('image/png','image/jpeg')),
  is_active boolean not null default true,
  superseded_by uuid references public.signatures(id),
  created_at timestamptz not null default now()
);
create index if not exists signatures_assessor_idx on public.signatures (assessor_id);

create table if not exists public.document_signatures (
  id uuid primary key default gen_random_uuid(),
  lsp_id uuid not null references public.lsps(id) on delete restrict,
  signature_id uuid not null references public.signatures(id) on delete restrict,
  assessor_id uuid not null references public.assessors(id) on delete restrict,
  document_type text not null,
  document_id uuid not null,
  signed_at timestamptz not null default now()
);
create index if not exists doc_signatures_lsp_idx on public.document_signatures (lsp_id, document_id);
create index if not exists doc_signatures_sig_idx on public.document_signatures (signature_id);
create index if not exists doc_signatures_assessor_idx on public.document_signatures (assessor_id);

-- 3. Per-Scheme Manifest (D17)
create table if not exists public.scheme_form_manifests (
  id uuid primary key default gen_random_uuid(),
  lsp_id uuid not null,
  scheme_id uuid not null,
  form_key text not null,
  file_patterns text[] not null default '{}',
  required boolean not null default true,
  instrument_role text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (scheme_id, lsp_id) references public.schemes(id, lsp_id) on delete cascade,
  unique (scheme_id, form_key)
);
create index if not exists sfm_lsp_scheme_idx on public.scheme_form_manifests (lsp_id, scheme_id);

-- 4. Prompt Registry (Immutable Versions)
create table if not exists public.prompt_templates (
  key text primary key,
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.prompt_versions (
  id uuid primary key default gen_random_uuid(),
  template_key text not null references public.prompt_templates(key) on delete restrict,
  version text not null,
  source_sha256 text not null,
  template_text text not null,
  is_approved boolean not null default true,
  created_at timestamptz not null default now(),
  unique (template_key, version)
);
create index if not exists prompt_versions_key_idx on public.prompt_versions (template_key);

-- 5. Phase 1: Drive Files & Triage
create table if not exists public.drive_files (
  id uuid primary key default gen_random_uuid(),
  lsp_id uuid not null,
  batch_id uuid not null,
  assessee_id uuid references public.assessees(id) on delete set null,
  drive_file_id text not null,
  file_name text not null,
  mime_type text not null,
  drive_path text not null default '',
  doc_type text not null default 'unknown',
  classification_confidence numeric(5,4) not null default 0,
  triage_status text not null default 'unmatched' check (triage_status in ('unmatched','suggested','assigned','not_needed')),
  triage_reason text,
  extracted_text text,
  extraction_method text,
  ocr_confidence numeric(5,4),
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (batch_id, lsp_id) references public.batches(id, lsp_id) on delete cascade,
  unique (batch_id, drive_file_id)
);
create index if not exists drive_files_batch_lsp_idx on public.drive_files (batch_id, lsp_id);
create index if not exists drive_files_assessee_idx on public.drive_files (assessee_id);

-- 6. Phase 2: KTP OCR & Name Jury + AK.02 Decisions
create table if not exists public.ocr_runs (
  id uuid primary key default gen_random_uuid(),
  lsp_id uuid not null references public.lsps(id) on delete restrict,
  assessee_id uuid not null references public.assessees(id) on delete cascade,
  drive_file_id uuid references public.drive_files(id) on delete set null,
  engine text not null default 'tesseract',
  extracted_name text,
  confidence numeric(5,4) not null default 0,
  status text not null default 'done' check (status in ('pending','done','failed','rejected_non_ktp')),
  created_at timestamptz not null default now()
);
create index if not exists ocr_runs_assessee_idx on public.ocr_runs (assessee_id);
create index if not exists ocr_runs_lsp_idx on public.ocr_runs (lsp_id);

create table if not exists public.name_jury_verdicts (
  id uuid primary key default gen_random_uuid(),
  lsp_id uuid not null references public.lsps(id) on delete restrict,
  assessee_id uuid not null references public.assessees(id) on delete cascade,
  verdict text not null check (verdict in ('match','mismatch_resolved','needs_human')),
  proposed_certificate_name text,
  reasoning text not null,
  evidence jsonb not null default '[]'::jsonb,
  ocr_confidence numeric(5,4) not null default 0,
  model text not null,
  prompt_version text not null,
  confirmed_by uuid references public.assessors(id),
  confirmed_at timestamptz,
  override_reason text,
  created_at timestamptz not null default now()
);
create index if not exists njv_assessee_idx on public.name_jury_verdicts (assessee_id);
create index if not exists njv_lsp_idx on public.name_jury_verdicts (lsp_id);

create table if not exists public.decisions (
  id uuid primary key default gen_random_uuid(),
  lsp_id uuid not null,
  batch_id uuid not null,
  assessee_id uuid not null references public.assessees(id) on delete cascade,
  unit_code text not null,
  unit_title text not null,
  ai_recommendation text check (ai_recommendation in ('K','BK')),
  vatm_reasoning text,
  decision text check (decision in ('K','BK')),
  assessor_note text,
  decided_by uuid references public.assessors(id),
  decided_at timestamptz,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (batch_id, lsp_id) references public.batches(id, lsp_id) on delete cascade,
  unique (assessee_id, unit_code)
);
create index if not exists decisions_batch_lsp_idx on public.decisions (batch_id, lsp_id);
create index if not exists decisions_assessee_idx on public.decisions (assessee_id);

-- 7. Phase 3: DIT Analysis
create table if not exists public.dit_analyses (
  id uuid primary key default gen_random_uuid(),
  lsp_id uuid not null,
  batch_id uuid not null,
  assessee_id uuid not null references public.assessees(id) on delete cascade,
  model text not null,
  prompt_version text not null,
  coverage_matrix jsonb not null default '[]'::jsonb,
  gap_questions jsonb not null default '[]'::jsonb,
  question_bank jsonb not null default '[]'::jsonb,
  model_answers jsonb not null default '[]'::jsonb,
  readiness jsonb not null default '{}'::jsonb,
  official_04b jsonb not null default '{}'::jsonb,
  status text not null default 'done' check (status in ('done','needs_manual_review','failed')),
  raw_output jsonb,
  created_by uuid references public.assessors(id),
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (batch_id, lsp_id) references public.batches(id, lsp_id) on delete cascade
);
create index if not exists dit_analyses_batch_lsp_idx on public.dit_analyses (batch_id, lsp_id);
create index if not exists dit_analyses_assessee_idx on public.dit_analyses (assessee_id);

-- 8. Phase 4: Written Grading & Similarity
create table if not exists public.written_gradings (
  id uuid primary key default gen_random_uuid(),
  lsp_id uuid not null,
  batch_id uuid not null,
  assessee_id uuid not null references public.assessees(id) on delete cascade,
  form_mapping jsonb not null default '{}'::jsonb,
  item_verdicts jsonb not null default '[]'::jsonb,
  error_summary jsonb not null default '[]'::jsonb,
  vatm_unit_recommendations jsonb not null default '[]'::jsonb,
  plagiarism_report jsonb not null default '{}'::jsonb,
  model text not null,
  prompt_version text not null,
  confirmed_by uuid references public.assessors(id),
  confirmed_at timestamptz,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (batch_id, lsp_id) references public.batches(id, lsp_id) on delete cascade
);
create index if not exists written_gradings_batch_lsp_idx on public.written_gradings (batch_id, lsp_id);
create index if not exists written_gradings_assessee_idx on public.written_gradings (assessee_id);

create table if not exists public.similarity_pairs (
  id uuid primary key default gen_random_uuid(),
  lsp_id uuid not null,
  batch_id uuid not null,
  scope text not null check (scope in ('dit','written')),
  assessee_a_id uuid not null references public.assessees(id) on delete cascade,
  assessee_b_id uuid not null references public.assessees(id) on delete cascade,
  jaccard_score numeric(5,4) not null default 0,
  tfidf_cosine numeric(5,4) not null default 0,
  shared_spans jsonb not null default '[]'::jsonb,
  shared_unique_errors jsonb not null default '[]'::jsonb,
  verdict text not null default 'perlu_ditinjau' check (verdict in ('kebetulan','perlu_ditinjau','indikasi_menyalin')),
  reviewed_by uuid references public.assessors(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (batch_id, lsp_id) references public.batches(id, lsp_id) on delete cascade
);
create index if not exists sim_pairs_batch_lsp_idx on public.similarity_pairs (batch_id, lsp_id);
create index if not exists sim_pairs_a_idx on public.similarity_pairs (assessee_a_id);
create index if not exists sim_pairs_b_idx on public.similarity_pairs (assessee_b_id);

-- 9. Phase 5: FR.AK.05 Reports
create table if not exists public.ak05_reports (
  id uuid primary key default gen_random_uuid(),
  lsp_id uuid not null,
  batch_id uuid not null,
  assessor_id uuid not null references public.assessors(id) on delete restrict,
  assessor_reg_no text,
  tuk_type text not null default 'sewaktu' check (tuk_type in ('sewaktu','tempat_kerja','mandiri')),
  status text not null default 'draft' check (status in ('draft','submitted','returned','accepted')),
  rows jsonb not null default '[]'::jsonb,
  notes_positive_negative text not null default '',
  notes_rejection text not null default '',
  notes_improvement text not null default '',
  signature_id uuid references public.signatures(id) on delete restrict,
  submitted_at timestamptz,
  returned_reason text,
  reviewed_by uuid references public.assessors(id),
  reviewed_at timestamptz,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (batch_id, lsp_id) references public.batches(id, lsp_id) on delete cascade
);
create index if not exists ak05_batch_lsp_idx on public.ak05_reports (batch_id, lsp_id);
create index if not exists ak05_assessor_idx on public.ak05_reports (assessor_id);

-- 10. Touch triggers for versioned tables
do $$ declare t text; begin
  foreach t in array array['scheme_form_manifests','drive_files','decisions','dit_analyses','written_gradings','ak05_reports'] loop
    execute format('drop trigger if exists %I on public.%I; create trigger %I before update on public.%I for each row execute function public.touch_row()', t||'_touch', t, t||'_touch', t);
  end loop;
end $$;

-- 11. Enable & Force RLS on all new tables
alter table public.signatures enable row level security;            alter table public.signatures force row level security;
alter table public.document_signatures enable row level security;   alter table public.document_signatures force row level security;
alter table public.scheme_form_manifests enable row level security; alter table public.scheme_form_manifests force row level security;
alter table public.prompt_templates enable row level security;      alter table public.prompt_templates force row level security;
alter table public.prompt_versions enable row level security;       alter table public.prompt_versions force row level security;
alter table public.drive_files enable row level security;           alter table public.drive_files force row level security;
alter table public.ocr_runs enable row level security;              alter table public.ocr_runs force row level security;
alter table public.name_jury_verdicts enable row level security;    alter table public.name_jury_verdicts force row level security;
alter table public.decisions enable row level security;             alter table public.decisions force row level security;
alter table public.dit_analyses enable row level security;          alter table public.dit_analyses force row level security;
alter table public.written_gradings enable row level security;      alter table public.written_gradings force row level security;
alter table public.similarity_pairs enable row level security;      alter table public.similarity_pairs force row level security;
alter table public.ak05_reports enable row level security;          alter table public.ak05_reports force row level security;

-- 12. Grants
grant select, insert, update on public.signatures to authenticated;
grant select, insert on public.document_signatures to authenticated;
grant select, insert, update, delete on public.scheme_form_manifests to authenticated;
grant select on public.prompt_templates, public.prompt_versions to authenticated;
grant select, insert, update on public.drive_files, public.decisions, public.dit_analyses, public.written_gradings, public.ak05_reports to authenticated;
grant select, insert on public.ocr_runs, public.name_jury_verdicts, public.similarity_pairs to authenticated;
grant update on public.name_jury_verdicts, public.similarity_pairs to authenticated;

-- 13. Non-overlapping RLS Policies (no duplicate permissive SELECT policies)
create policy sig_select on public.signatures for select to authenticated
  using (assessor_id = (select auth.uid()));
create policy sig_insert on public.signatures for insert to authenticated
  with check (assessor_id = (select auth.uid()));
create policy sig_update on public.signatures for update to authenticated
  using (assessor_id = (select auth.uid())) with check (assessor_id = (select auth.uid()));

create policy doc_sig_select on public.document_signatures for select to authenticated
  using (private.auth_is_member(lsp_id));
create policy doc_sig_insert on public.document_signatures for insert to authenticated
  with check (assessor_id = (select auth.uid()) and private.auth_is_member(lsp_id));

create policy sfm_select on public.scheme_form_manifests for select to authenticated
  using (private.auth_is_member(lsp_id));
create policy sfm_insert on public.scheme_form_manifests for insert to authenticated
  with check (private.auth_has_role(lsp_id, array['lsp_admin']::public.lsp_role[]));
create policy sfm_update on public.scheme_form_manifests for update to authenticated
  using (private.auth_has_role(lsp_id, array['lsp_admin']::public.lsp_role[]))
  with check (private.auth_has_role(lsp_id, array['lsp_admin']::public.lsp_role[]));
create policy sfm_delete on public.scheme_form_manifests for delete to authenticated
  using (private.auth_has_role(lsp_id, array['lsp_admin']::public.lsp_role[]));

create policy pt_select on public.prompt_templates for select to authenticated using (true);
create policy pv_select on public.prompt_versions for select to authenticated using (true);

create policy df_select on public.drive_files for select to authenticated
  using (private.auth_has_role(lsp_id, array['lsp_admin','tuk_admin']::public.lsp_role[]) or private.auth_on_batch(batch_id));
create policy df_insert on public.drive_files for insert to authenticated
  with check (private.auth_has_role(lsp_id, array['lsp_admin','tuk_admin']::public.lsp_role[]) or private.auth_on_batch(batch_id));
create policy df_update on public.drive_files for update to authenticated
  using (private.auth_has_role(lsp_id, array['lsp_admin','tuk_admin']::public.lsp_role[]) or private.auth_on_batch(batch_id))
  with check (private.auth_has_role(lsp_id, array['lsp_admin','tuk_admin']::public.lsp_role[]) or private.auth_on_batch(batch_id));

create policy ocr_select on public.ocr_runs for select to authenticated
  using (private.auth_is_member(lsp_id));
create policy ocr_insert on public.ocr_runs for insert to authenticated
  with check (private.auth_is_member(lsp_id));

create policy njv_select on public.name_jury_verdicts for select to authenticated
  using (private.auth_is_member(lsp_id));
create policy njv_insert on public.name_jury_verdicts for insert to authenticated
  with check (private.auth_is_member(lsp_id));
create policy njv_update on public.name_jury_verdicts for update to authenticated
  using (private.auth_is_member(lsp_id)) with check (private.auth_is_member(lsp_id));

create policy dec_select on public.decisions for select to authenticated
  using (private.auth_has_role(lsp_id, array['lsp_admin','tuk_admin']::public.lsp_role[]) or private.auth_on_batch(batch_id));
create policy dec_insert on public.decisions for insert to authenticated
  with check (private.auth_has_role(lsp_id, array['lsp_admin','assessor']::public.lsp_role[]) and (private.auth_has_role(lsp_id, array['lsp_admin']::public.lsp_role[]) or private.auth_on_batch(batch_id)));
create policy dec_update on public.decisions for update to authenticated
  using (private.auth_has_role(lsp_id, array['lsp_admin']::public.lsp_role[]) or private.auth_on_batch(batch_id))
  with check (private.auth_has_role(lsp_id, array['lsp_admin']::public.lsp_role[]) or private.auth_on_batch(batch_id));

create policy dit_select on public.dit_analyses for select to authenticated
  using (private.auth_has_role(lsp_id, array['lsp_admin','tuk_admin']::public.lsp_role[]) or private.auth_on_batch(batch_id));
create policy dit_insert on public.dit_analyses for insert to authenticated
  with check (private.auth_has_role(lsp_id, array['lsp_admin','assessor']::public.lsp_role[]));
create policy dit_update on public.dit_analyses for update to authenticated
  using (private.auth_has_role(lsp_id, array['lsp_admin']::public.lsp_role[]) or private.auth_on_batch(batch_id))
  with check (private.auth_has_role(lsp_id, array['lsp_admin']::public.lsp_role[]) or private.auth_on_batch(batch_id));

create policy wg_select on public.written_gradings for select to authenticated
  using (private.auth_has_role(lsp_id, array['lsp_admin','tuk_admin']::public.lsp_role[]) or private.auth_on_batch(batch_id));
create policy wg_insert on public.written_gradings for insert to authenticated
  with check (private.auth_has_role(lsp_id, array['lsp_admin','assessor']::public.lsp_role[]));
create policy wg_update on public.written_gradings for update to authenticated
  using (private.auth_has_role(lsp_id, array['lsp_admin']::public.lsp_role[]) or private.auth_on_batch(batch_id))
  with check (private.auth_has_role(lsp_id, array['lsp_admin']::public.lsp_role[]) or private.auth_on_batch(batch_id));

create policy sim_select on public.similarity_pairs for select to authenticated
  using (private.auth_has_role(lsp_id, array['lsp_admin','tuk_admin']::public.lsp_role[]) or private.auth_on_batch(batch_id));
create policy sim_insert on public.similarity_pairs for insert to authenticated
  with check (private.auth_is_member(lsp_id));
create policy sim_update on public.similarity_pairs for update to authenticated
  using (private.auth_is_member(lsp_id)) with check (private.auth_is_member(lsp_id));

create policy ak05_select on public.ak05_reports for select to authenticated
  using (private.auth_has_role(lsp_id, array['lsp_admin','tuk_admin']::public.lsp_role[]) or assessor_id = (select auth.uid()));
create policy ak05_insert on public.ak05_reports for insert to authenticated
  with check (assessor_id = (select auth.uid()) and private.auth_is_member(lsp_id));
create policy ak05_update on public.ak05_reports for update to authenticated
  using (assessor_id = (select auth.uid()) or private.auth_has_role(lsp_id, array['lsp_admin','tuk_admin']::public.lsp_role[]))
  with check (assessor_id = (select auth.uid()) or private.auth_has_role(lsp_id, array['lsp_admin','tuk_admin']::public.lsp_role[]));

-- 14. Private Storage Bucket for Assessor Signatures
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('signatures', 'signatures', false, 2097152, array['image/png','image/jpeg'])
on conflict (id) do nothing;

drop policy if exists signatures_bucket_select on storage.objects;
drop policy if exists signatures_bucket_insert on storage.objects;
drop policy if exists signatures_bucket_update on storage.objects;
drop policy if exists signatures_bucket_delete on storage.objects;

create policy signatures_bucket_select on storage.objects for select to authenticated
  using (bucket_id = 'signatures' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy signatures_bucket_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'signatures' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy signatures_bucket_update on storage.objects for update to authenticated
  using (bucket_id = 'signatures' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'signatures' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy signatures_bucket_delete on storage.objects for delete to authenticated
  using (bucket_id = 'signatures' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 15. Seed Global Defaults into app_config (D21: config, not hardcoded)
insert into public.app_config (scope, lsp_id, scheme_id, key, value) values
  ('global', null, null, 'app.name', '"AsesorKompetensi"'::jsonb),
  ('global', null, null, 'form_mapping.06', '{"soal":"06A","kunci":"06B","jawaban":"06C"}'::jsonb),
  ('global', null, null, 'question_bank.count', '13'::jsonb),
  ('global', null, null, 'similarity.flag_thresholds', '{"exact":0.85,"near":0.65,"partial":0.45,"unconfirmed":true}'::jsonb),
  ('global', null, null, 'identity.ktp_ocr_min_confidence', '0.75'::jsonb),
  ('global', null, null, 'identity.certificate_name_rule', '"ktp_authoritative"'::jsonb),
  ('global', null, null, 'export.ak05_formats', '["pdf","docx"]'::jsonb),
  ('global', null, null, 'export.default_formats', '["docx"]'::jsonb)
on conflict (scope, lsp_id, scheme_id, key) do nothing;

-- 16. Seed Immutable Prompt Registry Templates
insert into public.prompt_templates (key, description) values
  ('dit-gap-analysis', 'RCTFA DIT FR.IA.04A coverage matrix, gap questions, and personalized question bank'),
  ('written-test-grading', 'FR.IA.06 written test grading, Ringkasan Kesalahan, VATM roll-up, and plagiarism review'),
  ('name-jury', 'KTP-authoritative certificate name verification jury (4 name sources + OCR confidence only)')
on conflict (key) do nothing;

insert into public.prompt_versions (template_key, version, source_sha256, template_text, is_approved) values
  ('dit-gap-analysis', 'v1.0.0', '65354886971cc660e6e44419fb28e8ab1fc34b90cf5b3bdc02cb6f70c01ebbc3', 'Adapted RCTFA prompt: binary K/BK only, bank separate from official FR.IA.04B, config-based counts.', true),
  ('written-test-grading', 'v1.0.0', '749304d386d626f52ea804a3dc4590f43d20c8b43ad0b3ec5affe1de8d11b452', 'Adapted Written Test Grading prompt: Benar/Sebagian/Salah + Ringkasan Kesalahan + VATM + Bersih/Waspada.', true),
  ('name-jury', 'v1.0.0', 'ktp-authoritative-name-jury-v1', 'KTP-authoritative name jury comparing KTP OCR, APL.01, surat tugas, and ijazah without NIK or images.', true)
on conflict (template_key, version) do nothing;
