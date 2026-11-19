-- Round 11: Explicit active 06B master key governance & append-only non-system batch roster notes

-- 1. Explicit active 06B master key pointer & validation state on batches
alter table public.batches
  add column if not exists active_master_key_file_id uuid references public.drive_files(id) on delete set null,
  add column if not exists active_master_key_source text check (active_master_key_source in ('assessor_upload', 'manual_text', 'drive_file', 'archive_extract')),
  add column if not exists active_master_key_validation_status text check (active_master_key_validation_status in ('valid', 'empty_or_blanko', 'encrypted_unreadable')),
  add column if not exists active_master_key_validation_summary text,
  add column if not exists active_master_key_activated_at timestamptz,
  add column if not exists active_master_key_activated_by uuid references public.assessors(id) on delete set null;

create index if not exists batches_active_master_key_idx
  on public.batches (active_master_key_file_id)
  where active_master_key_file_id is not null;

-- 2. Append-only non-system roster reconciliation notes (distinct from system audit_log)
create table if not exists public.batch_roster_notes (
  id uuid primary key default gen_random_uuid(),
  lsp_id uuid not null,
  batch_id uuid not null,
  before_count int,
  after_count int,
  summary text not null check (char_length(trim(summary)) >= 10),
  source_kind text not null check (source_kind in ('developer_remediation', 'manual_assessor_note', 'system_migration')),
  source_label text not null check (char_length(trim(source_label)) >= 5),
  reference_doc text,
  event_occurred_at timestamptz,
  recorded_by uuid references public.assessors(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (batch_id, lsp_id) references public.batches(id, lsp_id) on delete cascade
);

create index if not exists batch_roster_notes_batch_idx
  on public.batch_roster_notes (batch_id, created_at desc);
create index if not exists batch_roster_notes_lsp_idx
  on public.batch_roster_notes (lsp_id);

alter table public.batch_roster_notes enable row level security;
alter table public.batch_roster_notes force row level security;

grant select, insert on public.batch_roster_notes to authenticated;

drop policy if exists brn_select on public.batch_roster_notes;
create policy brn_select on public.batch_roster_notes for select to authenticated
  using (
    private.auth_has_role(lsp_id, array['lsp_admin','tuk_admin']::public.lsp_role[])
    or private.auth_on_batch(batch_id)
  );

drop policy if exists brn_insert on public.batch_roster_notes;
create policy brn_insert on public.batch_roster_notes for insert to authenticated
  with check (
    (
      private.auth_has_role(lsp_id, array['lsp_admin','tuk_admin']::public.lsp_role[])
      or private.auth_on_batch(batch_id)
    )
    and (recorded_by is null or recorded_by = (select auth.uid()))
  );

-- 3. Idempotent, PII-free retroactive explanation for Demo Audit R4 roster change (26 -> 23)
insert into public.batch_roster_notes (
  lsp_id, batch_id, before_count, after_count, summary,
  source_kind, source_label, reference_doc, event_occurred_at
)
select
  b.lsp_id,
  b.id,
  26,
  23,
  'Penyelarasan daftar asesi (26 → 23) pada pemindaian ulang putaran 9/10 (job 96c64849): tiga entri duplikat sementara dari pemindaian awal 18 Nov 2026 (variasi nama folder tugas dan singkatan nama) digabung ke 3 baris peserta kanonikal yang sesuai dengan 23 folder peserta otoritatif di Persyaratan/; 0 peserta nyata dihapus.',
  'developer_remediation',
  'Berdasarkan laporan remediasi developer 19 Nov 2026, bukan entri log sistem',
  '_documentations_/2026-11-19_1305_round10_remediation_report.md',
  '2026-11-19T04:59:30+00:00'::timestamptz
from public.batches b
where b.id = 'f98e5671-fbcb-42cb-a724-9f69d24f780b'
  and not exists (
    select 1 from public.batch_roster_notes n
    where n.batch_id = b.id
      and n.before_count = 26
      and n.after_count = 23
      and n.source_kind = 'developer_remediation'
  );
