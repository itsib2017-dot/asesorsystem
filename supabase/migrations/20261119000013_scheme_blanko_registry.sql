-- Round 14: Per-Scheme Form Registry, Versioned .docx Blanko Storage & Zero-Hardcoding Seed
-- Adds blanko template metadata/versioning on scheme_form_manifests,
-- creates private LSP-scoped storage bucket `scheme-blankos` with RLS,
-- seeds the 6 official AK3U blankos for existing AK3U schemes,
-- and seeds the ICT-PM sample scheme in the demo LSP if present.

-- 1. Extend scheme_form_manifests with form display name, version (required by touch_row trigger), & versioned template columns
alter table public.scheme_form_manifests
  add column if not exists version int not null default 1,
  add column if not exists form_name text not null default '',
  add column if not exists template_storage_path text,
  add column if not exists template_file_name text,
  add column if not exists template_mime_type text,
  add column if not exists template_sha256 text,
  add column if not exists template_version int not null default 0,
  add column if not exists template_uploaded_at timestamptz,
  add column if not exists template_uploaded_by uuid references public.assessors(id) on delete set null;

-- 2. Private storage bucket `scheme-blankos` (10 MB limit, .docx only)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'scheme-blankos',
  'scheme-blankos',
  false,
  10485760,
  array['application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists scheme_blankos_bucket_select on storage.objects;
drop policy if exists scheme_blankos_bucket_insert on storage.objects;
drop policy if exists scheme_blankos_bucket_update on storage.objects;
drop policy if exists scheme_blankos_bucket_delete on storage.objects;

create policy scheme_blankos_bucket_select on storage.objects for select to authenticated
  using (
    bucket_id = 'scheme-blankos'
    and case
      when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then private.auth_is_member(((storage.foldername(name))[1])::uuid)
      else false
    end
  );

create policy scheme_blankos_bucket_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'scheme-blankos'
    and case
      when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then private.auth_has_role(((storage.foldername(name))[1])::uuid, array['lsp_admin']::public.lsp_role[])
      else false
    end
  );

create policy scheme_blankos_bucket_update on storage.objects for update to authenticated
  using (
    bucket_id = 'scheme-blankos'
    and case
      when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then private.auth_has_role(((storage.foldername(name))[1])::uuid, array['lsp_admin']::public.lsp_role[])
      else false
    end
  )
  with check (
    bucket_id = 'scheme-blankos'
    and case
      when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then private.auth_has_role(((storage.foldername(name))[1])::uuid, array['lsp_admin']::public.lsp_role[])
      else false
    end
  );

create policy scheme_blankos_bucket_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'scheme-blankos'
    and case
      when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then private.auth_has_role(((storage.foldername(name))[1])::uuid, array['lsp_admin']::public.lsp_role[])
      else false
    end
  );

-- 3. Seed existing AK3U schemes with the 6 official AK3U blanko templates + full form manifest
with ak3u_forms(form_key, form_name, file_patterns, required, instrument_role, sort_order, storage_path, file_name, sha256, tpl_version) as (
  values
    ('apl01', 'FR.APL.01 — Permohonan Sertifikasi Kompetensi', array['apl01','apl.01','apl 01','permohonan'], true, 'administrasi', 1, null, null, null, 0),
    ('apl02', 'FR.APL.02 — Asesmen Mandiri', array['apl02','apl.02','apl 02','asesmen mandiri'], true, 'administrasi', 2, null, null, null, 0),
    ('ak01', 'FR.AK.01 — Persetujuan Asesmen dan Kerahasiaan', array['ak01','ak.01','ak 01','persetujuan asesmen'], true, 'administrasi', 3, 'builtin://ak3u/FR.AK.01.PERSETUJUAN_ASESMEN.docx', 'FR.AK.01.PERSETUJUAN_ASESMEN.docx', '098df571c9868cadbe29ed0a0115f217a9b61f1457daaafa7931069abaa51db7', 1),
    ('ak02', 'FR.AK.02 — Rekaman Asesmen Kompetensi', array['ak02','ak.02','ak 02','rekaman asesmen'], true, 'keputusan', 4, 'builtin://ak3u/FR.AK.02.REKAMAN_ASESMEN.docx', 'FR.AK.02.REKAMAN_ASESMEN.docx', '51249bc408256a4ab2d755d457a2432741b03dd21abaff076cf5a9e8fb5dc31c', 1),
    ('ak05', 'FR.AK.05 — Laporan Asesmen', array['ak05','ak.05','ak 05','laporan asesmen'], true, 'laporan', 5, 'builtin://ak3u/FR.AK.05.LAPORAN_ASESMEN.docx', 'FR.AK.05.LAPORAN_ASESMEN.docx', '8465194a55c4e92f22d8e1ee27bbedfd1a72717e958fc3447a19544c03c9413d', 1),
    ('04a', 'FR.IA.04A — Daftar Instruksi Terstruktur (DIT)', array['04a','ia.04a','ia 04a','dit'], true, 'dit', 6, 'builtin://ak3u/FR.IA.04A.DIT.docx', 'FR.IA.04A.DIT.docx', 'b9e594f70c833fc1e6bfd991069e9de70eb4135dd466dcd84ad1e5464b74f514', 1),
    ('04b', 'FR.IA.04B — Penilaian Proyek Singkat', array['04b','ia.04b','ia 04b','presentasi'], true, 'presentation', 7, 'builtin://ak3u/FR.IA.04B.PENILAIAN_PROYEK_SINGKAT.docx', 'FR.IA.04B.PENILAIAN_PROYEK_SINGKAT.docx', 'f7db689cdccebd557f58aa79601377f78edc6dd5b63e150f73ae26a9b3b2ecac', 1),
    ('06a', 'FR.IA.06A — Pertanyaan Tertulis Esai', array['06a','ia.06a','ia 06a'], true, 'written_soal', 8, null, null, null, 0),
    ('06b', 'FR.IA.06B — Kunci Jawaban Tertulis Esai', array['06b','ia.06b','ia 06b','kunci'], true, 'written_kunci', 9, null, null, null, 0),
    ('06c', 'FR.IA.06C — Lembar Jawaban Pertanyaan Tertulis', array['06c','ia.06c','ia 06c','jawaban'], true, 'written_jawaban', 10, 'builtin://ak3u/FR.IA.06C.LEMBAR_JAWABAN_TERTULIS.docx', 'FR.IA.06C.LEMBAR_JAWABAN_TERTULIS.docx', '0847c3de8484ed7889ccf54784f50e92752ede0df2753c17e619d08bd147e9c5', 1),
    ('09', 'FR.IA.09 — Daftar Pertanyaan Wawancara', array['09','ia.09','ia 09','wawancara'], false, 'interview', 11, null, null, null, 0)
)
insert into public.scheme_form_manifests (
  lsp_id, scheme_id, form_key, form_name, file_patterns, required, instrument_role, sort_order,
  template_storage_path, template_file_name, template_mime_type, template_sha256, template_version, template_uploaded_at
)
select
  s.lsp_id,
  s.id,
  f.form_key,
  f.form_name,
  f.file_patterns,
  f.required,
  f.instrument_role,
  f.sort_order,
  f.storage_path,
  f.file_name,
  case when f.storage_path is not null then 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' else null end,
  f.sha256,
  f.tpl_version,
  case when f.storage_path is not null then now() else null end
from public.schemes s
cross join ak3u_forms f
where upper(trim(s.code)) = 'AK3U'
on conflict (scheme_id, form_key) do update
  set form_name = case when public.scheme_form_manifests.form_name = '' then excluded.form_name else public.scheme_form_manifests.form_name end,
      sort_order = excluded.sort_order,
      template_storage_path = coalesce(public.scheme_form_manifests.template_storage_path, excluded.template_storage_path),
      template_file_name = coalesce(public.scheme_form_manifests.template_file_name, excluded.template_file_name),
      template_mime_type = coalesce(public.scheme_form_manifests.template_mime_type, excluded.template_mime_type),
      template_sha256 = coalesce(public.scheme_form_manifests.template_sha256, excluded.template_sha256),
      template_version = case when public.scheme_form_manifests.template_version > 0 then public.scheme_form_manifests.template_version else excluded.template_version end,
      template_uploaded_at = coalesce(public.scheme_form_manifests.template_uploaded_at, excluded.template_uploaded_at);

-- 4. Idempotently seed ICT-PM sample scheme in demo tenant (LSP-K3-ID2) if present
do $$
declare
  v_demo_lsp uuid := 'b03afb00-9266-467d-823e-44a7830a4077';
  v_scheme_id uuid;
begin
  if exists (select 1 from public.lsps where id = v_demo_lsp) then
    insert into public.schemes (lsp_id, code, name, manifest)
    values (
      v_demo_lsp,
      'ICT-PM',
      'Okupasi ICT Project Manager (SKM/1522/00008/2/2024/3)',
      $json${
        "questionCounts": {
          "official04bCount": 4,
          "written06aCount": 5,
          "questionBankCount": 5
        },
        "decisionRule": "VATM",
        "decisionRuleRef": "SKKNI Bidang Manajemen Proyek TIK (Kepmenaker No. 349 Tahun 2014)",
        "prerequisites": [
          "Minimal Sarjana (S1) bidang Teknik Informatika / Sistem Informasi / Manajemen dengan pengalaman proyek TIK minimal 2 tahun",
          "Memiliki sertifikat pelatihan Manajemen Proyek TIK atau portofolio kepemimpinan proyek"
        ],
        "registrationRequirements": [
          "KTP",
          "Ijazah Terakhir",
          "Daftar Riwayat Hidup (CV)",
          "Portofolio Proyek TIK & Surat Tugas",
          "Pas Foto Terbaru"
        ],
        "units": [
          { "code": "J.620900.001.02", "title": "Menyusun Perencanaan Proyek TIK (Project Charter & WBS)" },
          { "code": "J.620900.002.02", "title": "Mengelola Jadwal, Biaya, dan Sumber Daya Proyek TIK" },
          { "code": "J.620900.003.02", "title": "Mengelola Risiko, Kualitas, dan Perubahan Lingkup Proyek TIK" },
          { "code": "J.620900.004.02", "title": "Melakukan Pemantauan, Pelaporan, dan Penutupan Proyek TIK" }
        ],
        "kelompokPekerjaan": [
          {
            "kpIndex": 1,
            "title": "Kelompok Pekerjaan 1 — Inisiasi & Perencanaan Proyek TIK",
            "units": [
              { "no": 1, "code": "J.620900.001.02", "title": "Menyusun Perencanaan Proyek TIK (Project Charter & WBS)" },
              { "no": 2, "code": "J.620900.002.02", "title": "Mengelola Jadwal, Biaya, dan Sumber Daya Proyek TIK" }
            ],
            "aspects": [
              {
                "kpIndex": 1,
                "no": 1,
                "unitCode": "J.620900.001.02",
                "unitTitle": "Menyusun Perencanaan Proyek TIK (Project Charter & WBS)",
                "lingkup": "Penyusunan Project Charter & Work Breakdown Structure (WBS)",
                "question": "Bagaimana Anda menurunkan tujuan bisnis sponsor proyek TIK ke dalam Project Charter dan struktur WBS yang terukur?",
                "kukRef": "1.1 Project Charter dan WBS disusun sesuai ruang lingkup dan kebutuhan pemangku kepentingan."
              },
              {
                "kpIndex": 1,
                "no": 2,
                "unitCode": "J.620900.002.02",
                "unitTitle": "Mengelola Jadwal, Biaya, dan Sumber Daya Proyek TIK",
                "lingkup": "Estimasi Jalur Kritis (Critical Path) & Anggaran Proyek",
                "question": "Metode apa yang Anda gunakan untuk menentukan jalur kritis, alokasi tim teknis, dan baseline anggaran proyek TIK?",
                "kukRef": "2.2 Jadwal induk, RACI, dan rencana anggaran disepakati sebelum fase eksekusi."
              }
            ]
          },
          {
            "kpIndex": 2,
            "title": "Kelompok Pekerjaan 2 — Pengendalian Risiko, Mutu & Penutupan Proyek",
            "units": [
              { "no": 1, "code": "J.620900.003.02", "title": "Mengelola Risiko, Kualitas, dan Perubahan Lingkup Proyek TIK" },
              { "no": 2, "code": "J.620900.004.02", "title": "Melakukan Pemantauan, Pelaporan, dan Penutupan Proyek TIK" }
            ],
            "aspects": [
              {
                "kpIndex": 2,
                "no": 1,
                "unitCode": "J.620900.003.02",
                "unitTitle": "Mengelola Risiko, Kualitas, dan Perubahan Lingkup Proyek TIK",
                "lingkup": "Pengendalian Change Request & Mitigasi Risiko Teknis",
                "question": "Saat muncul permintaan perubahan fitur di tengah sprint/fase produksi, bagaimana mekanisme Change Control Board dan penilaian dampaknya?",
                "kukRef": "3.1 Perubahan ruang lingkup dievaluasi dampak biaya, jadwal, dan risikonya sebelum disetujui."
              },
              {
                "kpIndex": 2,
                "no": 2,
                "unitCode": "J.620900.004.02",
                "unitTitle": "Melakukan Pemantauan, Pelaporan, dan Penutupan Proyek TIK",
                "lingkup": "Pengukuran Earned Value (EVM) & Serah Terima Proyek",
                "question": "Bagaimana Anda mengukur kinerja jadwal/biaya (SPI/CPI) serta memastikan Berita Acara Serah Terima (BAST) dan lessons learned terdokumentasi?",
                "kukRef": "4.2 Laporan kinerja dan dokumen penutupan proyek disahkan oleh sponsor proyek."
              }
            ]
          }
        ],
        "writtenQuestions": [
          { "no": 1, "unitCode": "J.620900.001.02", "question": "Jelaskan komponen wajib dalam Project Charter dan perbedaannya dengan Project Management Plan." },
          { "no": 2, "unitCode": "J.620900.002.02", "question": "Uraikan cara menghitung Earned Value (EV), Cost Performance Index (CPI), dan Schedule Performance Index (SPI)." },
          { "no": 3, "unitCode": "J.620900.002.02", "question": "Bagaimana strategi crashing dan fast-tracking diterapkan saat proyek mengalami keterlambatan pada critical path?" },
          { "no": 4, "unitCode": "J.620900.003.02", "question": "Jelaskan proses manajemen risiko proyek TIK mulai dari Risk Register hingga penetapan contingency reserve." },
          { "no": 5, "unitCode": "J.620900.004.02", "question": "Sebutkan tahapan formal administrative closure dan verifikasi deliverables sebelum penandatanganan BAST." }
        ],
        "interviewQuestions": [
          { "no": 1, "unitCode": "J.620900.001.02", "question": "Ceritakan proyek TIK terakhir yang Anda pimpin: bagaimana Anda menyepakati scope baseline dengan klien?" },
          { "no": 2, "unitCode": "J.620900.002.02", "question": "Bagaimana Anda menangani konflik alokasi engineer senior yang dibutuhkan dua workstream bersamaan?" },
          { "no": 3, "unitCode": "J.620900.003.02", "question": "Risiko teknis terbesar apa yang pernah terjadi di proyek Anda dan bagaimana mitigasi nyatanya?" },
          { "no": 4, "unitCode": "J.620900.004.02", "question": "Bagaimana proses serah terima operasional dan dokumentasi lessons learned dilakukan bersama tim?" }
        ],
        "docColumns": ["APL.01", "APL.02", "KTP", "Ijazah", "CV", "Portofolio", "04A", "06C"],
        "branding": {
          "leftLogoAlt": "BNSP",
          "rightLogoAlt": "LSP TIK — ICT Project Manager"
        },
        "formSuffixMapping": {
          "soal": "06A",
          "kunci": "06B",
          "jawaban": "06C"
        }
      }$json$::jsonb
    )
    on conflict (lsp_id, code) do update
      set name = excluded.name,
          manifest = excluded.manifest
    returning id into v_scheme_id;

    insert into public.scheme_form_manifests (
      lsp_id, scheme_id, form_key, form_name, file_patterns, required, instrument_role, sort_order,
      template_storage_path, template_file_name, template_mime_type, template_sha256, template_version, template_uploaded_at
    )
    values
      (v_demo_lsp, v_scheme_id, 'apl01', 'FR.APL.01 — Permohonan Sertifikasi ICT PM', array['apl01','apl.01','permohonan'], true, 'administrasi', 1, null, null, null, null, 0, null),
      (v_demo_lsp, v_scheme_id, 'apl02', 'FR.APL.02 — Asesmen Mandiri ICT PM', array['apl02','apl.02','asesmen mandiri'], true, 'administrasi', 2, null, null, null, null, 0, null),
      (v_demo_lsp, v_scheme_id, 'berita_acara', 'Kelengkapan Asesmen — Berita Acara & Daftar Hadir', array['berita acara','daftar hadir','kelengkapan asesmen'], true, 'administrasi', 3, null, null, null, null, 0, null),
      (v_demo_lsp, v_scheme_id, 'muk_portofolio', 'MUK Verifikasi Portofolio Proyek TIK', array['verifikasi portofolio','portofolio proyek','project charter','wbs','bast'], true, 'portofolio', 4, null, null, null, null, 0, null),
      (v_demo_lsp, v_scheme_id, '04a', 'MUK Kegiatan Terstruktur (FR.IA.04A)', array['04a','kegiatan terstruktur','ia.04a'], true, 'dit', 5, 'builtin://ict-pm/FR.IA.04A.KEGIATAN_TERSTRUKTUR_ICT_PM.docx', 'FR.IA.04A.KEGIATAN_TERSTRUKTUR_ICT_PM.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '1aa4ae5f0759ad03e55a9981b7fa28ea753a2ff0a08726944765b0cb5d875f5f', 1, now()),
      (v_demo_lsp, v_scheme_id, '04b', 'Penilaian Proyek & Presentasi ICT PM (FR.IA.04B)', array['04b','ia.04b','paparan proyek'], true, 'presentation', 6, 'builtin://ict-pm/FR.IA.04B.PENILAIAN_PROYEK_ICT_PM.docx', 'FR.IA.04B.PENILAIAN_PROYEK_ICT_PM.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '2cc277cddf68c107f50d9f8af6715ab111046da608908fb182c42dcdbc8f9b1b', 1, now()),
      (v_demo_lsp, v_scheme_id, '06a', 'Soal Tertulis ICT PM (FR.IA.06A)', array['06a','ia.06a','soal ict'], true, 'written_soal', 7, null, null, null, null, 0, null),
      (v_demo_lsp, v_scheme_id, '06b', 'Kunci Jawaban ICT PM (FR.IA.06B)', array['06b','ia.06b','kunci ict'], true, 'written_kunci', 8, null, null, null, null, 0, null),
      (v_demo_lsp, v_scheme_id, '06c', 'Lembar Jawaban Tertulis ICT PM (FR.IA.06C)', array['06c','ia.06c','jawaban ict'], true, 'written_jawaban', 9, 'builtin://ict-pm/FR.IA.06C.LEMBAR_JAWABAN_ICT_PM.docx', 'FR.IA.06C.LEMBAR_JAWABAN_ICT_PM.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'e056f677ff0262f70edfa6c40ad17e859893497b87dcd3cf9fc1cbc514f30549', 1, now()),
      (v_demo_lsp, v_scheme_id, '09', 'Wawancara Klarifikasi Portofolio ICT PM (FR.IA.09)', array['09','ia.09','wawancara'], false, 'interview', 10, null, null, null, null, 0, null),
      (v_demo_lsp, v_scheme_id, 'ak02', 'FR.AK.02 — Rekaman Asesmen ICT PM', array['ak02','ak.02','rekaman asesmen'], true, 'keputusan', 11, 'builtin://ict-pm/FR.AK.02.REKAMAN_ASESMEN_ICT_PM.docx', 'FR.AK.02.REKAMAN_ASESMEN_ICT_PM.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '04aae062f762d0f07567bfad78795658f1582496b39f04085c54dbffb29d2cb3', 1, now()),
      (v_demo_lsp, v_scheme_id, 'ak05', 'FR.AK.05 — Laporan Asesmen ICT PM', array['ak05','ak.05','laporan asesmen'], true, 'laporan', 12, 'builtin://ict-pm/FR.AK.05.LAPORAN_ASESMEN_ICT_PM.docx', 'FR.AK.05.LAPORAN_ASESMEN_ICT_PM.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '378ab152550fc9ff4047d631fb32ca3eeeebf5a5f3e8e2953a52d15e05bbbb46', 1, now())
    on conflict (scheme_id, form_key) do update
      set form_name = excluded.form_name,
          file_patterns = excluded.file_patterns,
          required = excluded.required,
          instrument_role = excluded.instrument_role,
          sort_order = excluded.sort_order,
          template_storage_path = coalesce(public.scheme_form_manifests.template_storage_path, excluded.template_storage_path),
          template_file_name = coalesce(public.scheme_form_manifests.template_file_name, excluded.template_file_name),
          template_mime_type = coalesce(public.scheme_form_manifests.template_mime_type, excluded.template_mime_type),
          template_sha256 = coalesce(public.scheme_form_manifests.template_sha256, excluded.template_sha256),
          template_version = case when public.scheme_form_manifests.template_version > 0 then public.scheme_form_manifests.template_version else excluded.template_version end,
          template_uploaded_at = coalesce(public.scheme_form_manifests.template_uploaded_at, excluded.template_uploaded_at);
  end if;
end $$;
